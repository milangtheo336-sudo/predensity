import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-auth';

const RPC_URLS: Record<string, string> = {
  mainnet: 'https://mainnet.hashio.io/api',
  testnet: 'https://testnet.hashio.io/api',
};

const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
const TARGET_RPC = RPC_URLS[HEDERA_NETWORK] || RPC_URLS.testnet;

/**
 * Read-only JSON-RPC methods we are willing to forward to Hashio.
 *
 * We intentionally DO NOT allow `eth_sendRawTransaction`, `eth_sendTransaction`,
 * `eth_sign`, `eth_signTransaction`, `personal_*`, `miner_*`, `admin_*`,
 * `debug_*`, or `txpool_*` through this proxy. Wallets that need to broadcast
 * a signed tx can talk to a public RPC directly — this proxy exists so the
 * client UI can make cheap read calls without exposing our API-key-bearing
 * RPC endpoint (if one is ever configured) and without being abused as an
 * open relay for arbitrary JSON-RPC methods.
 */
const METHOD_ALLOWLIST = new Set<string>([
  'eth_chainId',
  'eth_blockNumber',
  'eth_call',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionCount',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
  'eth_getLogs',
  'eth_getFilterLogs',
  'net_version',
  'net_listening',
  'web3_clientVersion',
]);

const MAX_BODY_BYTES = 64 * 1024; // 64 KiB — plenty for eth_call/eth_getLogs
const MAX_BATCH_SIZE = 20;

function rpcError(code: number, message: string, id: unknown = null, status = 400) {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { code, message }, id },
    { status }
  );
}

function validateCall(call: unknown): { ok: true; id: unknown } | { ok: false; message: string; id: unknown } {
  if (!call || typeof call !== 'object') {
    return { ok: false, message: 'Each RPC call must be an object', id: null };
  }
  const { method, id } = call as { method?: unknown; id?: unknown };
  if (typeof method !== 'string') {
    return { ok: false, message: 'Missing or invalid method', id: id ?? null };
  }
  if (!METHOD_ALLOWLIST.has(method)) {
    return { ok: false, message: `Method not allowed: ${method}`, id: id ?? null };
  }
  return { ok: true, id: id ?? null };
}

export async function POST(request: NextRequest) {
  // Rate limit: generous for read traffic, but enough to stop a runaway loop
  // or an attacker using this as a free RPC relay. 120/min/IP/route.
  const limited = rateLimit(request, { maxRequests: 120, windowMs: 60_000 });
  if (limited) return limited;

  // Cap body size — prevents a malicious client from forcing a massive
  // upstream POST via the declared Content-Length.
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) {
    return rpcError(-32600, 'Request body too large', null, 413);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return rpcError(-32700, 'Could not read request body', null, 400);
  }
  if (raw.length > MAX_BODY_BYTES) {
    return rpcError(-32600, 'Request body too large', null, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return rpcError(-32700, 'Parse error', null, 400);
  }

  // Validate single call or batch.
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return rpcError(-32600, 'Empty batch', null, 400);
    }
    if (body.length > MAX_BATCH_SIZE) {
      return rpcError(-32600, `Batch too large (max ${MAX_BATCH_SIZE})`, null, 400);
    }
    for (const call of body) {
      const v = validateCall(call);
      if (!v.ok) return rpcError(-32601, v.message, v.id, 400);
    }
  } else {
    const v = validateCall(body);
    if (!v.ok) return rpcError(-32601, v.message, v.id, 400);
  }

  try {
    const response = await fetch(TARGET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });

    // Stream the upstream JSON back verbatim — don't re-serialize in a way
    // that would strip valid fields the client depends on.
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return rpcError(-32603, error?.message || 'RPC proxy error', null, 502);
  }
}
