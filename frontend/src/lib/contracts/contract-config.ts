// Contract configuration for multi-category prediction markets on Arc

import { Category } from '../types/categories';

export interface ContractConfig {
  address: string;
  abi: any[];
  category: Category;
}

// Staking token configuration — USDC on Arc
export const STAKING_TOKEN_CONFIG = {
  // USDC on Arc Testnet
  testnet: process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000',
  // USDC on Arc Mainnet
  mainnet: process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000',
  // Native mode (not used on Arc — always USDC)
  none: '0x0000000000000000000000000000000000000000',
};

// Current staking mode: always USDC on Arc
export const STAKING_MODE: 'none' | 'testnet' | 'mainnet' =
  (process.env.NEXT_PUBLIC_STAKING_MODE as 'none' | 'testnet' | 'mainnet') || 'testnet';

// Get the active staking token address (EVM format)
export function getStakingTokenAddress(): `0x${string}` {
  return STAKING_TOKEN_CONFIG[STAKING_MODE] as `0x${string}`;
}

// Whether contracts are in ERC-20 token mode (always true on Arc)
export function isTokenMode(): boolean {
  return STAKING_MODE !== 'none';
}

// Staking currency display info
export function getStakingCurrency(): { symbol: string; decimals: number; name: string } {
  return { symbol: 'USDC', decimals: 6, name: 'USD Coin' };
}

// Deployed contract addresses (EVM format) on Arc
export const CONTRACT_ADDRESSES: Record<string, string> = {
  [Category.CRYPTO]: process.env.NEXT_PUBLIC_CRYPTO_CONTRACT_ADDRESS || '',
  [Category.POLITICS]: process.env.NEXT_PUBLIC_POLITICS_CONTRACT_ADDRESS || '',
  [Category.SPORTS]: process.env.NEXT_PUBLIC_SPORTS_CONTRACT_ADDRESS || '',
  [Category.TECHNOLOGY]: process.env.NEXT_PUBLIC_TECH_CONTRACT_ADDRESS || '',
  [Category.FINANCE]: '',
};

// Helper to get contract address by category
export function getContractAddress(category: Category): `0x${string}` {
  return CONTRACT_ADDRESSES[category] as `0x${string}`;
}

// Helper to check if category is deployed
export function isCategoryDeployed(category: Category): boolean {
  return !!CONTRACT_ADDRESSES[category];
}

// Immutable startTimestamp for each deployed contract (set at deployment, never changes).
// On-chain bucket index = Math.floor((targetTimestamp - startTimestamp) / 86400)
export const CONTRACT_START_TIMESTAMPS: Record<string, number> = {
  [Category.CRYPTO]: Number(process.env.NEXT_PUBLIC_CRYPTO_START_TIMESTAMP) || 0,
  [Category.POLITICS]: Number(process.env.NEXT_PUBLIC_POLITICS_START_TIMESTAMP) || 0,
  [Category.SPORTS]: Number(process.env.NEXT_PUBLIC_SPORTS_START_TIMESTAMP) || 0,
  [Category.TECHNOLOGY]: Number(process.env.NEXT_PUBLIC_TECH_START_TIMESTAMP) || 0,
  [Category.FINANCE]: 0,
};

// Compute the correct on-chain bucket index for a given targetTimestamp and category.
export function getOnChainBucket(targetTimestamp: number, category: string): number {
  const start = CONTRACT_START_TIMESTAMPS[category] || 0;
  if (start === 0 || targetTimestamp < start) return 0;
  return Math.floor((targetTimestamp - start) / 86400);
}

// Network configuration for Arc
export const NETWORK_CONFIG = {
  testnet: {
    chainId: 5042002,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.arc.network',
    explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://testnet.arcscan.app',
    explorerApiUrl: process.env.EXPLORER_API_URL || 'https://testnet.arcscan.app/api',
  },
  mainnet: {
    chainId: 5042002, // Update when mainnet launches
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.arc.network',
    explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://arcscan.app',
    explorerApiUrl: process.env.EXPLORER_API_URL || 'https://arcscan.app/api',
  },
};

export const CURRENT_NETWORK: 'testnet' | 'mainnet' =
  (process.env.NEXT_PUBLIC_NETWORK as 'testnet' | 'mainnet') || 'testnet';

export function getCurrentNetworkConfig() {
  return NETWORK_CONFIG[CURRENT_NETWORK];
}

// Backward compat aliases (some files still reference these)
export const CONTRACT_IDS = CONTRACT_ADDRESSES;
export function getContractId(category: Category): string {
  return CONTRACT_ADDRESSES[category];
}

// Legacy token ID references — on Arc we just use EVM addresses
export const STAKING_TOKEN_IDS = {
  testnet: STAKING_TOKEN_CONFIG.testnet,
  mainnet: STAKING_TOKEN_CONFIG.mainnet,
  none: '',
};

export function getStakingTokenId(): string {
  return STAKING_TOKEN_IDS[STAKING_MODE] || STAKING_TOKEN_CONFIG[STAKING_MODE];
}
