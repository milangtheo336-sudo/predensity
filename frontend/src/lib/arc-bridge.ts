import type { EIP1193Provider } from 'viem';

// Chain identifiers used by @circle-fin/app-kit
const CHAIN_IDS_TESTNET: Record<string, string> = {
  arc: 'Arc_Testnet',
  ethereum: 'Ethereum_Sepolia',
  base: 'Base_Sepolia',
  arbitrum: 'Arbitrum_Sepolia',
  optimism: 'Optimism_Sepolia',
  polygon: 'Polygon_Amoy_Testnet',
  avalanche: 'Avalanche_Fuji',
};

const CHAIN_IDS_MAINNET: Record<string, string> = {
  arc: 'Arc',
  ethereum: 'Ethereum',
  base: 'Base',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  polygon: 'Polygon',
  avalanche: 'Avalanche',
};

function getChainIdentifier(chainId: string): string {
  const isTestnet = process.env.NEXT_PUBLIC_NETWORK === 'testnet' ||
    !process.env.NEXT_PUBLIC_NETWORK;
  const map = isTestnet ? CHAIN_IDS_TESTNET : CHAIN_IDS_MAINNET;
  return map[chainId] || map['ethereum'];
}

// EVM chain IDs for wallet_switchEthereumChain
export const EVM_CHAIN_IDS: Record<string, number> = {
  ethereum: 11155111,  // Sepolia
  base: 84532,         // Base Sepolia
  arbitrum: 421614,    // Arbitrum Sepolia
  optimism: 11155420,  // OP Sepolia
  polygon: 80002,      // Amoy
  avalanche: 43113,    // Fuji
};

export interface BridgeResult {
  txHash: string;
  amount: string;
  sourceChain: string;
  explorerUrl?: string;
}

export async function bridgeUSDCToArc(
  provider: EIP1193Provider,
  sourceChainId: string,
  amount: string,
  destinationAddress: string,
): Promise<BridgeResult> {
  const { AppKit } = await import('@circle-fin/app-kit');
  const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2');

  const kit = new AppKit();
  const adapter = await createViemAdapterFromProvider({ provider });

  const sourceChain = getChainIdentifier(sourceChainId);
  const destChain = getChainIdentifier('arc');

  const result = await kit.bridge({
    from: { adapter, chain: sourceChain as any },
    to: { adapter, chain: destChain as any, address: destinationAddress },
    amount,
  });

  return {
    txHash: (result as any).txHash || '',
    amount,
    sourceChain: sourceChainId,
    explorerUrl: (result as any).explorerUrl,
  };
}

export interface SwapResult {
  txHash: string;
  amountIn: string;
  amountOut: string;
  tokenIn: string;
  tokenOut: string;
  explorerUrl?: string;
}

/**
 * Swap a token to USDC on Arc using Arc AppKit.
 * Requires the user's wallet to be connected to Arc chain.
 * Supported pairs (testnet): EURC→USDC, cirBTC→USDC
 */
export async function swapToUSDCOnArc(
  provider: EIP1193Provider,
  tokenIn: string,
  amountIn: string,
  kitKey: string,
): Promise<SwapResult> {
  const { AppKit } = await import('@circle-fin/app-kit');
  const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2');

  const kit = new AppKit();
  const adapter = await createViemAdapterFromProvider({ provider });
  const arcChain = getChainIdentifier('arc');

  const result = await kit.swap({
    from: { adapter, chain: arcChain as any },
    tokenIn: tokenIn.toUpperCase(),
    tokenOut: 'USDC',
    amountIn,
    config: {
      kitKey,
    },
  });

  return {
    txHash: (result as any).txHash || '',
    amountIn,
    amountOut: (result as any).amountOut || amountIn,
    tokenIn: tokenIn.toUpperCase(),
    tokenOut: 'USDC',
    explorerUrl: (result as any).explorerUrl,
  };
}

/**
 * Bridge a token from source chain to Arc, then swap to USDC if needed.
 * For USDC: just bridge. For EURC: bridge then swap.
 */
export async function bridgeAndSwapToArc(
  provider: EIP1193Provider,
  sourceChainId: string,
  tokenId: string,
  amount: string,
  destinationAddress: string,
  kitKey?: string,
): Promise<BridgeResult & { swapResult?: SwapResult }> {
  const bridgeResult = await bridgeUSDCToArc(provider, sourceChainId, amount, destinationAddress);

  if (tokenId !== 'usdc' && kitKey) {
    const arcChainId = getArcEvmChainId();
    const hexChainId = '0x' + arcChainId.toString(16);
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch { /* may already be on Arc */ }

    const swapResult = await swapToUSDCOnArc(provider, tokenId, amount, kitKey);
    return { ...bridgeResult, swapResult };
  }

  return bridgeResult;
}

function getArcEvmChainId(): number {
  const isTestnet = process.env.NEXT_PUBLIC_NETWORK === 'testnet' || !process.env.NEXT_PUBLIC_NETWORK;
  return isTestnet ? 5042002 : 5042002; // update mainnet chain ID when available
}

export async function switchWalletChain(
  provider: EIP1193Provider,
  chainId: string,
): Promise<void> {
  const evmChainId = EVM_CHAIN_IDS[chainId];
  if (!evmChainId) return;

  const hexChainId = '0x' + evmChainId.toString(16);
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    });
  } catch (err: any) {
    if (err.code === 4902) {
      throw new Error(`Please add the ${chainId} network to your wallet first.`);
    }
    throw err;
  }
}
