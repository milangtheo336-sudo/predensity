// Contract configuration for multi-category prediction markets on Arc

import { Category } from '../types/categories';

export interface ContractConfig {
  address: string;
  abi: any[];
  category: Category;
}

// Staking token configuration — USDC on Arc chain
// Arc uses USDC as its native gas token, so USDC is a first-class citizen
export const STAKING_TOKEN_CONFIG = {
  // USDC on Arc (update after deployment)
  mainnet: process.env.NEXT_PUBLIC_USDC_ADDRESS || '',
  // Native mode disabled — Arc always uses USDC
  none: '0x0000000000000000000000000000000000000000',
};

// Current staking mode: always USDC on Arc
export const STAKING_MODE: 'none' | 'mainnet' =
  (process.env.NEXT_PUBLIC_STAKING_MODE as 'none' | 'mainnet') || 'mainnet';

// Get the active staking token address (EVM format)
export function getStakingTokenAddress(): string {
  return STAKING_TOKEN_CONFIG[STAKING_MODE];
}

// Whether contracts are in ERC-20 token mode (USDC) vs native
export function isTokenMode(): boolean {
  return STAKING_MODE !== 'none';
}

// Staking currency display info — always USDC on Arc
export function getStakingCurrency(): { symbol: string; decimals: number; name: string } {
  return { symbol: 'USDC', decimals: 6, name: 'USD Coin' };
}

// Deployed contract addresses (EVM format)
// Update these after deploying to Arc chain
export const CONTRACT_ADDRESSES = {
  [Category.CRYPTO]: process.env.NEXT_PUBLIC_CRYPTO_CONTRACT_ADDRESS || '',
  [Category.POLITICS]: process.env.NEXT_PUBLIC_POLITICS_CONTRACT_ADDRESS || '',
  [Category.SPORTS]: process.env.NEXT_PUBLIC_SPORTS_CONTRACT_ADDRESS || '',
  [Category.TECHNOLOGY]: process.env.NEXT_PUBLIC_TECH_CONTRACT_ADDRESS || '',
  [Category.FINANCE]: '',
};

// Helper to get contract address by category (EVM format)
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

// =========================================================================
// CLOB SYSTEM CONTRACTS (Politics, Sports, Technology, International)
// MarketManager: multi-outcome markets, split/merge/resolve/redeem
// ExchangeSettlement: dual-mode operator + EIP-712 signed trades
// =========================================================================
export const CLOB_CONTRACTS = {
  marketManager: {
    address: process.env.NEXT_PUBLIC_CLOB_MARKET_MANAGER_ADDRESS || '',
  },
  exchange: {
    address: process.env.NEXT_PUBLIC_CLOB_EXCHANGE_ADDRESS || '',
  },
};

export function getClobMarketManagerAddress(): string {
  return CLOB_CONTRACTS.marketManager.address;
}

export function getClobExchangeAddress(): string {
  return CLOB_CONTRACTS.exchange.address;
}

// Network configuration — Arc chain
export const NETWORK_CONFIG = {
  mainnet: {
    chainId: 5042002, // Arc Testnet chain ID
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.arc.network',
    explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://testnet.arcscan.app',
    explorerApiUrl: process.env.EXPLORER_API_URL || 'https://testnet.arcscan.app/api',
  },
};

// Current network
export const CURRENT_NETWORK: 'mainnet' = 'mainnet';

export function getCurrentNetworkConfig() {
  return NETWORK_CONFIG[CURRENT_NETWORK];
}

// Challenge market contract address (1v1 parimutuel)
export const CHALLENGE_MARKET_ADDRESS = process.env.NEXT_PUBLIC_CHALLENGE_MARKET_ADDRESS || '';
export function getChallengeMarketAddress(): `0x${string}` {
  return CHALLENGE_MARKET_ADDRESS as `0x${string}`;
}

// Backward compat aliases (some files still reference these)
export const CONTRACT_IDS = CONTRACT_ADDRESSES;
export function getContractId(category: Category): string {
  return CONTRACT_ADDRESSES[category];
}

// Legacy token ID references — on Arc we just use EVM addresses
export const STAKING_TOKEN_IDS = {
  mainnet: STAKING_TOKEN_CONFIG.mainnet,
  none: '',
};

export function getStakingTokenId(): string {
  return STAKING_TOKEN_IDS[STAKING_MODE] || STAKING_TOKEN_CONFIG[STAKING_MODE];
}
