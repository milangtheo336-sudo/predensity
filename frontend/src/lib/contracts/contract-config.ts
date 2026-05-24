// Contract configuration for multi-category prediction markets

import { Category } from '../types/categories';

export interface ContractConfig {
  address: string;
  abi: any[];
  category: Category;
}

// Staking token configuration
// address(0) = native HBAR mode, otherwise ERC-20 token address
export const STAKING_TOKEN_CONFIG = {
  // USDC on Hedera Testnet (Test USDC token 0.0.8229951)
  testnet: '0x00000000000000000000000000000000007d943f',
  // USDC on Hedera Mainnet (HTS token 0.0.456858)
  mainnet: '0x000000000000000000000000000000000006f89a',
  // Native HBAR mode (no staking token)
  none: '0x0000000000000000000000000000000000000000',
};

// Staking token Hedera IDs (0.0.X format) for ContractId.fromString()
// EVM addresses above are for function arguments; these are for contract calls
export const STAKING_TOKEN_IDS = {
  testnet: '0.0.8229951',
  mainnet: '0.0.456858',
  none: '',
};

// Current staking mode: 'none' for HBAR, 'testnet'/'mainnet' for USDC
// Reads from env var on Vercel (mainnet), defaults to testnet for local dev
export const STAKING_MODE: 'none' | 'testnet' | 'mainnet' =
  (process.env.NEXT_PUBLIC_STAKING_MODE as 'none' | 'testnet' | 'mainnet') || 'testnet';

// Get the active staking token address (EVM format, for function arguments)
export function getStakingTokenAddress(): string {
  return STAKING_TOKEN_CONFIG[STAKING_MODE];
}

// Get the active staking token Hedera ID (0.0.X format, for ContractId.fromString)
export function getStakingTokenId(): string {
  return STAKING_TOKEN_IDS[STAKING_MODE];
}

// Whether contracts are in ERC-20 token mode (USDC) vs native HBAR
export function isTokenMode(): boolean {
  return STAKING_MODE !== 'none';
}

// Staking currency display info
export function getStakingCurrency(): { symbol: string; decimals: number; name: string } {
  if (isTokenMode()) {
    return { symbol: 'USDC', decimals: 6, name: 'USD Coin' };
  }
  return { symbol: 'HBAR', decimals: 8, name: 'HBAR' };
}

// Deployed contract addresses (EVM format) -- USDC Token Mode
// Reads from env vars on Vercel (mainnet), defaults to testnet for local dev
export const CONTRACT_ADDRESSES = {
  [Category.CRYPTO]: process.env.NEXT_PUBLIC_CRYPTO_CONTRACT_ADDRESS || '0x00000000000000000000000000000000007e8166',
  [Category.POLITICS]: process.env.NEXT_PUBLIC_POLITICS_CONTRACT_ADDRESS || '0xA6fcFd8010C0e135aB53936a125e7d57f58edcD8',
  [Category.SPORTS]: process.env.NEXT_PUBLIC_SPORTS_CONTRACT_ADDRESS || '0x8f62C698a26888424b5170a11610Fa5Fd7DF540b',
  [Category.TECHNOLOGY]: process.env.NEXT_PUBLIC_TECH_CONTRACT_ADDRESS || '0x76bFfEff52b9c515fF2CAdF471Df6915A6766dB8',
  [Category.INTERNATIONAL]: '', // Not yet deployed
};

// Hedera Contract IDs (0.0.X format) for each category -- USDC Token Mode
// Reads from env vars on Vercel (mainnet), defaults to testnet for local dev
export const CONTRACT_IDS = {
  [Category.CRYPTO]: process.env.NEXT_PUBLIC_CRYPTO_CONTRACT_ID || '0.0.8290662',
  [Category.POLITICS]: process.env.NEXT_PUBLIC_POLITICS_CONTRACT_ID || '0.0.8232724',
  [Category.SPORTS]: process.env.NEXT_PUBLIC_SPORTS_CONTRACT_ID || '0.0.8232726',
  [Category.TECHNOLOGY]: process.env.NEXT_PUBLIC_TECH_CONTRACT_ID || '0.0.8232727',
  [Category.INTERNATIONAL]: '', // Not yet deployed
};

// Helper to get contract address by category (EVM format)
export function getContractAddress(category: Category): `0x${string}` {
  return CONTRACT_ADDRESSES[category] as `0x${string}`;
}

// Helper to get contract ID by category (Hedera format)
export function getContractId(category: Category): string {
  return CONTRACT_IDS[category];
}

// Helper to check if category is deployed
export function isCategoryDeployed(category: Category): boolean {
  return !!CONTRACT_ADDRESSES[category] && !!CONTRACT_IDS[category];
}

// Immutable startTimestamp for each deployed contract (set at deployment, never changes).
// On-chain bucket index = Math.floor((targetTimestamp - startTimestamp) / 86400)
// Reads from env vars on Vercel (mainnet), defaults to testnet for local dev
export const CONTRACT_START_TIMESTAMPS: Record<string, number> = {
  [Category.CRYPTO]: Number(process.env.NEXT_PUBLIC_CRYPTO_START_TIMESTAMP) || 1773940168,
  [Category.POLITICS]: Number(process.env.NEXT_PUBLIC_POLITICS_START_TIMESTAMP) || 1773586860,
  [Category.SPORTS]: Number(process.env.NEXT_PUBLIC_SPORTS_START_TIMESTAMP) || 1773586872,
  [Category.TECHNOLOGY]: Number(process.env.NEXT_PUBLIC_TECH_START_TIMESTAMP) || 1773586888,
  [Category.INTERNATIONAL]: 0,
};

// Compute the correct on-chain bucket index for a given targetTimestamp and category.
// Mirrors the Solidity: (targetTs - startTimestamp) / SECONDS_PER_DAY
export function getOnChainBucket(targetTimestamp: number, category: string): number {
  const start = CONTRACT_START_TIMESTAMPS[category] || 0;
  if (start === 0 || targetTimestamp < start) return 0;
  return Math.floor((targetTimestamp - start) / 86400);
}

// Network configuration
export const NETWORK_CONFIG = {
  testnet: {
    chainId: '296',
    rpcUrl: 'https://testnet.hashio.io/api',
    explorerUrl: 'https://hashscan.io/testnet',
  },
  mainnet: {
    chainId: '295',
    rpcUrl: 'https://mainnet.hashio.io/api',
    explorerUrl: 'https://hashscan.io/mainnet',
  },
};

// Current network -- reads from env var, defaults to testnet for local dev
export const CURRENT_NETWORK: 'testnet' | 'mainnet' =
  (process.env.NEXT_PUBLIC_HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet';

export function getCurrentNetworkConfig() {
  return NETWORK_CONFIG[CURRENT_NETWORK];
}
