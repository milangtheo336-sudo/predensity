
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-auth';
import { getCurrentNetworkConfig } from '@/lib/contracts/contract-config';

const TARGET_RPC = getCurrentNetworkConfig().rpcUrl;

/**
 * Read-only JSON-RPC proxy for the Arc chain.
 * Prevents exposing API-key-bearing RPC endpoints and blocks write methods.
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

const MAX_BODY_BYTES = 64 * 1024;
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
  const limited = rateLimit(request, { maxRequests: 120, windowMs: 60_000 });
  if (limited) return limited;

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

  if (Array.isArray(body)) {
    if (body.length === 0) return rpcError(-32600, 'Empty batch', null, 400);
    if (body.length > MAX_BATCH_SIZE) return rpcError(-32600, `Batch too large (max ${MAX_BATCH_SIZE})`, null, 400);
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

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return rpcError(-32603, error?.message || 'RPC proxy error', null, 502);
  }
}
