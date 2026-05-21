import { useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import CryptoPredictionMarketABI from '../../abi/CryptoPredictionMarket.json';
import { ethers } from 'ethers';
import { Category } from '@/lib/types/categories';
import { getContractAddress } from '@/lib/contracts/contract-config';

export interface MultiplierBreakdown {
  sharpnessBps: string;
  timeBps: string;
  qualityBps: string;
  weight: string;
  fee: string;
  stakeNet: string;
  estimatedMultiplier: string;
  estimatedPayout: string;
}

export function useContractMultipliers(category?: Category) {
  const publicClient = usePublicClient();

  const readContract = useCallback(
    async (params: { address: `0x${string}`; abi: any; functionName: string; args: any[] }) => {
      if (!publicClient) throw new Error('No public client');
      return publicClient.readContract(params);
    },
    [publicClient]
  );

  const getContractAddressForCategory = useCallback((cat?: Category): `0x${string}` => {
    if (cat) {
      return getContractAddress(cat) as `0x${string}`;
    }
    return getContractAddress(Category.CRYPTO) as `0x${string}`;
  }, []);

  const getSharpnessMultiplier = useCallback(
    async (priceMin: string, priceMax: string, targetCategory?: Category): Promise<string | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'getSharpnessMultiplier',
          args: [priceMin, priceMax],
        });

        return result ? result.toString() : null;
      } catch (error) {
        console.error('getSharpnessMultiplier error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  const getTimeMultiplier = useCallback(
    async (targetTimestamp: string, targetCategory?: Category): Promise<string | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'getTimeMultiplier',
          args: [targetTimestamp],
        });

        return result ? result.toString() : null;
      } catch (error) {
        console.error('getTimeMultiplier error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  // Get a full multiplier breakdown with estimated profit for a potential bet.
  // This calls simulatePlaceBet + getBucketInfo to compute the hold-to-resolution multiplier.
  const getMultiplierBreakdown = useCallback(
    async (
      targetTimestamp: string,
      priceMin: string,
      priceMax: string,
      stakeAmount: string,
      targetCategory?: Category
    ): Promise<MultiplierBreakdown | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const stake = stakeAmount && parseFloat(stakeAmount) > 0 ? stakeAmount : '1';
        const priceMinBps = Math.round(parseFloat(priceMin) * 10000);
        const priceMaxBps = Math.round(parseFloat(priceMax) * 10000);

        const simResult = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'simulatePlaceBet',
          args: [
            targetTimestamp,
            priceMinBps,
            priceMaxBps,
            ethers.utils.parseEther(stake),
          ],
        }) as any;

        if (!simResult || !simResult.isValid) return null;

        const fee = ethers.BigNumber.from(simResult.fee);
        const stakeNet = ethers.BigNumber.from(simResult.stakeNet);
        const weight = ethers.BigNumber.from(simResult.weight);
        const bucket = ethers.BigNumber.from(simResult.bucket);

        // Fetch bucket info to estimate payout multiplier
        let estimatedMultiplier = '1.00';
        let estimatedPayout = stakeNet.toString();

        try {
          const bucketInfo = await readContract({
            address: contractAddress,
            abi: CryptoPredictionMarketABI.abi,
            functionName: 'getBucketInfo',
            args: [bucket.toString()],
          }) as any;

          if (bucketInfo) {
            const totalStaked = ethers.BigNumber.from(
              bucketInfo.totalStaked || bucketInfo[0] || bucketInfo.value0 || '0'
            );
            const totalWeight = ethers.BigNumber.from(
              bucketInfo.totalWinningWeight || bucketInfo[1] || bucketInfo.value1 || '0'
            );

            // Estimate: if this bet wins, payout = weight * (totalStaked + stakeNet) / (totalWeight + weight)
            // This accounts for the new bet being added to the pool
            const newTotalStaked = totalStaked.add(stakeNet);
            const newTotalWeight = totalWeight.add(weight);

            if (!newTotalWeight.isZero() && !weight.isZero()) {
              const estimated = weight.mul(newTotalStaked).div(newTotalWeight);
              estimatedPayout = estimated.toString();
              const stakeWei = ethers.utils.parseEther(stake);
              if (!stakeWei.isZero()) {
                const mult = estimated.mul(100).div(stakeWei).toNumber() / 100;
                estimatedMultiplier = mult.toFixed(2);
              }
            }
          }
        } catch {
          // Bucket info unavailable, use defaults
        }

        return {
          sharpnessBps: simResult.sharpnessBps.toString(),
          timeBps: simResult.timeBps.toString(),
          qualityBps: simResult.qualityBps.toString(),
          weight: weight.toString(),
          fee: fee.toString(),
          stakeNet: stakeNet.toString(),
          estimatedMultiplier,
          estimatedPayout,
        };
      } catch (error) {
        console.error('getMultiplierBreakdown error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  return {
    getSharpnessMultiplier,
    getTimeMultiplier,
    getMultiplierBreakdown,
  };
}
