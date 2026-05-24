import { NextRequest, NextResponse } from 'next/server';

const RPC_URLS: Record<string, string> = {
  mainnet: 'https://mainnet.hashio.io/api',
  testnet: 'https://testnet.hashio.io/api',
};

const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
const TARGET_RPC = RPC_URLS[HEDERA_NETWORK] || RPC_URLS.testnet;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(TARGET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: error.message || 'RPC proxy error' }, id: null },
      { status: 502 }
    );
  }
}
