/**
 * Server-side viem clients for Arc chain.
 * Used by API routes to read/write on-chain state.
 */

import { createPublicClient, createWalletClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getCurrentNetworkConfig } from './contracts/contract-config';

const networkConfig = getCurrentNetworkConfig();

export const arcChain = defineChain({
  id: networkConfig.chainId,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [networkConfig.rpcUrl] } },
  blockExplorers: { default: { name: 'ArcScan', url: networkConfig.explorerUrl } },
});

// Public client for read-only calls
export const publicClient = createPublicClient({
  chain: arcChain,
  transport: http(networkConfig.rpcUrl),
});

// Operator wallet client for state-changing transactions
export function getOperatorWalletClient() {
  const operatorKey = process.env.OPERATOR_PRIVATE_KEY || process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
  if (!operatorKey) {
    throw new Error('OPERATOR_PRIVATE_KEY not configured');
  }
  const key = operatorKey.startsWith('0x') ? operatorKey : `0x${operatorKey}`;
  const account = privateKeyToAccount(key as `0x${string}`);

  return createWalletClient({
    account,
    chain: arcChain,
    transport: http(networkConfig.rpcUrl),
  });
}

// Get operator address
export function getOperatorAddress(): `0x${string}` {
  const operatorKey = process.env.OPERATOR_PRIVATE_KEY || process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
  if (!operatorKey) return '0x0000000000000000000000000000000000000000';
  const key = operatorKey.startsWith('0x') ? operatorKey : `0x${operatorKey}`;
  const account = privateKeyToAccount(key as `0x${string}`);
  return account.address;
}

// Explorer API base URL
export const EXPLORER_API_URL = networkConfig.explorerApiUrl;

// Verify a transaction on Arc block explorer or via RPC
export async function verifyTransaction(txHash: `0x${string}`) {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  return {
    success: receipt.status === 'success',
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    logs: receipt.logs,
  };
}
