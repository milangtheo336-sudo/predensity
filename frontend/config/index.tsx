import { defineChain } from 'viem';

const isTestnet =
  process.env.NEXT_PUBLIC_NETWORK === 'testnet' || !process.env.NEXT_PUBLIC_NETWORK;

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://testnet.arcscan.app',
    },
  },
});

export const arcMainnet = defineChain({
  id: 5042002, // update when mainnet chain ID is available
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://arcscan.app',
    },
  },
});

export const arcChain = isTestnet ? arcTestnet : arcMainnet;
