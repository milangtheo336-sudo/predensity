import { HederaMainnet, HederaTestnet } from '@buidlerlabs/hashgraph-react-wallets/chains';

const configuredNetwork = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

export const hederaChain = configuredNetwork === 'mainnet' ? HederaMainnet : HederaTestnet;
