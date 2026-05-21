import { useCallback } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { getContractAddress } from '@/lib/contracts/contract-config';
import { Category } from '@/lib/types/categories';

interface WriteContractParams {
  contractId?: string;
  address?: `0x${string}`;
  abi: any;
  functionName: string;
  args: any[];
  metaArgs?: { gas?: number; value?: bigint };
}

interface WatchCallbacks {
  onSuccess?: (receipt: any) => void;
  onError?: (...args: any[]) => any;
}

export function useContractWriteCompat() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const writeContract = useCallback(
    async (params: WriteContractParams): Promise<string> => {
      if (!walletClient) throw new Error('Wallet not connected');
      const address = params.address || (params.contractId as `0x${string}`);
      const hash = await walletClient.writeContract({
        address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
        gas: params.metaArgs?.gas ? BigInt(params.metaArgs.gas) : undefined,
        value: params.metaArgs?.value,
      });
      return hash;
    },
    [walletClient]
  );

  const watch = useCallback(
    (hash: string, callbacks: WatchCallbacks) => {
      if (!publicClient) return;
      publicClient
        .waitForTransactionReceipt({ hash: hash as `0x${string}` })
        .then((receipt) => callbacks.onSuccess?.(receipt))
        .catch((err) => callbacks.onError?.(err));
    },
    [publicClient]
  );

  return { writeContract, watch };
}

export function useReadContractCompat() {
  const publicClient = usePublicClient();

  const readContract = useCallback(
    async (params: { address: `0x${string}`; abi: any; functionName: string; args: any[] }) => {
      if (!publicClient) throw new Error('No public client');
      return publicClient.readContract(params);
    },
    [publicClient]
  );

  return { readContract };
}
