import { HederaMainnet, HederaTestnet } from '@buidlerlabs/hashgraph-react-wallets/chains';

const configuredNetwork = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

// Override mainnet RPC to proxy through our API to avoid CORS issues.
// mainnet.hashio.io/api blocks cross-origin browser requests.
const HederaMainnetProxy = {
  ...HederaMainnet,
  rpcUrls: {
    default: {
      http: ['/api/rpc-proxy'],
    },
  },
};

export const hederaChain = configuredNetwork === 'mainnet' ? HederaMainnetProxy : HederaTestnet;
