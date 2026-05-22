import { useCallback } from 'react';
import { useReadContract } from '@buidlerlabs/hashgraph-react-wallets';
import CryptoPredictionMarketABI from '../../abi/CryptoPredictionMarket.json';
import { ethers } from 'ethers';
import { Category } from '@/lib/types/categories';
import { getContractAddress, getStakingCurrency } from '@/lib/contracts/contract-config';

interface SimulatePlaceBetResult {
  fee: ethers.BigNumber;
  stakeNet: ethers.BigNumber;
  sharpnessBps: ethers.BigNumber;
  timeBps: ethers.BigNumber;
  qualityBps: ethers.BigNumber;
  weight: ethers.BigNumber;
  bucket: ethers.BigNumber;
  isValid: boolean;
  errorMessage: string;
}

interface BetSimulation {
  fee: string;
  stakeNet: string;
  sharpnessBps: string;
  timeBps: string;
  qualityBps: string;
  weight: string;
  bucket: string;
  isValid: boolean;
  errorMessage: string;
}

interface Bet {
  bettor: string;
  targetTimestamp: string;
  priceMin: string;
  priceMax: string;
  stake: string;
  qualityBps: string;
  weight: string;
  finalized: boolean;
  claimed: boolean;
  actualPrice: string;
  won: boolean;
  // DPM fields
  entryBandWeight: string;
  exited: boolean;
}

interface BucketInfo {
  totalBets: string;
  totalWinningWeight: string;
  nextProcessIndex: string;
  aggregationComplete: boolean;
}

interface ContractStats {
  totalBets: string;
  totalFees: string;
  contractBalance: string;
}

// DPM info returned by getDPMInfo(betId)
interface DPMInfo {
  rawExitValue: string;
  exitFee: string;
  netExitPayout: string;
  canExit: boolean;
  exitPoolRemaining: string;
}

// Potential profit breakdown for a bet
interface PotentialProfit {
  exitValue: string;       // what you'd get selling now (net of exit fee)
  exitFee: string;         // the 0.8% exit fee amount
  canExit: boolean;        // whether early exit is available
  exitPoolRemaining: string; // remaining exit liquidity in the bucket
  holdMultiplier: string;  // estimated payout multiplier if you hold to resolution
  holdEstimate: string;    // estimated resolution payout in wei
}

export function useBetSimulation(category?: Category) {
  const { readContract } = useReadContract();

  const getContractAddressForCategory = useCallback((cat?: Category): `0x${string}` => {
    if (cat) {
      return getContractAddress(cat) as `0x${string}`;
    }
    return getContractAddress(Category.CRYPTO) as `0x${string}`;
  }, []);

  const simulatePlaceBet = useCallback(
    async (
      targetTimestamp: string,
      priceMin: string,
      priceMax: string,
      stakeAmount?: string,
      targetCategory?: Category
    ): Promise<BetSimulation | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        // Use provided stake or default to 1 HBAR
        const stake = stakeAmount && parseFloat(stakeAmount) > 0 ? stakeAmount : '1';

        // Contract expects basis points (1% = 100 BPS, so $0.15 = 1500 BPS)
        const priceMinBps = Math.round(parseFloat(priceMin) * 10000);
        const priceMaxBps = Math.round(parseFloat(priceMax) * 10000);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'simulatePlaceBet',
          args: [
            targetTimestamp,
            priceMinBps,
            priceMaxBps,
            ethers.utils.parseUnits(stake, getStakingCurrency().decimals)
          ],
        }) as SimulatePlaceBetResult;

        if (result) {
          return {
            fee: result.fee.toString(),
            stakeNet: result.stakeNet.toString(),
            sharpnessBps: result.sharpnessBps.toString(),
            timeBps: result.timeBps.toString(),
            qualityBps: result.qualityBps.toString(),
            weight: result.weight.toString(),
            bucket: result.bucket.toString(),
            isValid: result.isValid,
            errorMessage: result.errorMessage
          };
        }

        return null;
      } catch (error) {
        console.error('simulatePlaceBet error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  const getBet = useCallback(
    async (betId: string, targetCategory?: Category): Promise<Bet | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'getBet',
          args: [betId],
        }) as any;

        if (result) {
          const targetTimestamp = result.targetTimestamp || result[1];
          const priceMin = result.priceMin || result[2];
          const priceMax = result.priceMax || result[3];
          const stake = result.stake || result[4];
          const qualityBps = result.qualityBps || result[5];
          const weight = result.weight || result[6];
          const actualPrice = result.actualPrice || result[9];

          if (!targetTimestamp || !priceMin || !priceMax || !stake) {
            return null;
          }

          const entryBandWeight = result.entryBandWeight || result[11];
          const exited = result.exited !== undefined ? result.exited : (result[12] || false);

          return {
            bettor: result.bettor || result[0] || '',
            targetTimestamp: targetTimestamp.toString(),
            priceMin: priceMin.toString(),
            priceMax: priceMax.toString(),
            stake: stake.toString(),
            qualityBps: qualityBps ? qualityBps.toString() : '0',
            weight: weight ? weight.toString() : '0',
            finalized: result.finalized !== undefined ? result.finalized : (result[7] || false),
            claimed: result.claimed !== undefined ? result.claimed : (result[8] || false),
            actualPrice: actualPrice ? actualPrice.toString() : '0',
            won: result.won !== undefined ? result.won : (result[10] || false),
            entryBandWeight: entryBandWeight ? entryBandWeight.toString() : '0',
            exited,
          };
        }

        return null;
      } catch (error) {
        console.error('getBet error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  const getBucketInfo = useCallback(
    async (bucket: string, targetCategory?: Category): Promise<BucketInfo | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'getBucketInfo',
          args: [bucket],
        }) as any;

        if (result) {
          return {
            totalBets: (result.totalBets || result[0] || result.value0).toString(),
            totalWinningWeight: (result.totalWinningWeight || result[1] || result.value1).toString(),
            nextProcessIndex: (result.nextProcessIndex || result[2] || result.value2).toString(),
            aggregationComplete: result.aggregationComplete !== undefined ? result.aggregationComplete : (result[3] || result.value3),
          };
        }

        return null;
      } catch (error) {
        console.error('getBucketInfo error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  const getResolvedValue = useCallback(
    async (timestamp: string, targetCategory?: Category): Promise<string | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'getResolvedValue',
          args: [timestamp],
        });

        return result ? result.toString() : null;
      } catch (error) {
        console.error('getResolvedValue error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  const getStats = useCallback(
    async (targetCategory?: Category): Promise<ContractStats | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'getStats',
          args: [],
        }) as any;

        if (result) {
          return {
            totalBets: (result.totalBets || result[0]).toString(),
            totalFees: (result.totalFees || result[1]).toString(),
            contractBalance: (result.contractBalance || result[2]).toString(),
          };
        }

        return null;
      } catch (error) {
        console.error('getStats error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  const isTrustedOracle = useCallback(
    async (address: string, targetCategory?: Category): Promise<boolean> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'trustedOracles',
          args: [address],
        });

        return result ? Boolean(result) : false;
      } catch (error) {
        console.error('isTrustedOracle error:', error);
        return false;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  const getRequiredConfirmations = useCallback(
    async (targetCategory?: Category): Promise<string | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'requiredConfirmations',
          args: [],
        });

        return result ? result.toString() : null;
      } catch (error) {
        console.error('getRequiredConfirmations error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  // -- DPM Functions --

  // Get full DPM info for a bet (exit value, fee, can-exit status, pool remaining)
  const getDPMInfo = useCallback(
    async (betId: string, targetCategory?: Category): Promise<DPMInfo | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'getDPMInfo',
          args: [betId],
        }) as any;

        if (result) {
          return {
            rawExitValue: (result.rawExitValue || result[0]).toString(),
            exitFee: (result.exitFee || result[1]).toString(),
            netExitPayout: (result.netExitPayout || result[2]).toString(),
            canExit: result.canExit !== undefined ? result.canExit : (result[3] || false),
            exitPoolRemaining: (result.exitPoolRemaining || result[4]).toString(),
          };
        }

        return null;
      } catch (error) {
        console.error('getDPMInfo error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  // Get raw exit value for a bet (before exit fee)
  const getExitValue = useCallback(
    async (betId: string, targetCategory?: Category): Promise<string | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'getExitValue',
          args: [betId],
        });

        return result ? result.toString() : null;
      } catch (error) {
        console.error('getExitValue error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  // Get adaptive liquidity parameter K for a bucket
  const getK = useCallback(
    async (bucket: string, targetCategory?: Category): Promise<string | null> => {
      try {
        const contractAddress = getContractAddressForCategory(targetCategory || category);

        const result = await readContract({
          address: contractAddress,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'getK',
          args: [bucket],
        });

        return result ? result.toString() : null;
      } catch (error) {
        console.error('getK error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  // Compute potential profit: combines DPM exit info with hold-to-resolution estimate
  const getPotentialProfit = useCallback(
    async (betId: string, targetCategory?: Category): Promise<PotentialProfit | null> => {
      try {
        const cat = targetCategory || category;
        const contractAddress = getContractAddressForCategory(cat);

        // Fetch DPM info and bet data in parallel
        const [dpmResult, betResult] = await Promise.all([
          readContract({
            address: contractAddress,
            abi: CryptoPredictionMarketABI.abi,
            functionName: 'getDPMInfo',
            args: [betId],
          }) as Promise<any>,
          readContract({
            address: contractAddress,
            abi: CryptoPredictionMarketABI.abi,
            functionName: 'getBet',
            args: [betId],
          }) as Promise<any>,
        ]);

        if (!dpmResult || !betResult) return null;

        const netExitPayout = ethers.BigNumber.from(dpmResult.netExitPayout || dpmResult[2]);
        const exitFee = ethers.BigNumber.from(dpmResult.exitFee || dpmResult[1]);
        const canExit = dpmResult.canExit !== undefined ? dpmResult.canExit : (dpmResult[3] || false);
        const exitPoolRemaining = ethers.BigNumber.from(dpmResult.exitPoolRemaining || dpmResult[4]);

        const stake = ethers.BigNumber.from(betResult.stake || betResult[4]);
        const weight = ethers.BigNumber.from(betResult.weight || betResult[6]);
        const targetTimestamp = betResult.targetTimestamp || betResult[1];

        // Estimate hold-to-resolution payout: (weight / totalWeight) * totalStaked
        // Fetch bucket info for the estimate
        let holdMultiplier = '1.00';
        let holdEstimate = stake.toString();

        try {
          const bucket = await readContract({
            address: contractAddress,
            abi: CryptoPredictionMarketABI.abi,
            functionName: 'bucketIndex',
            args: [targetTimestamp.toString()],
          });

          if (bucket) {
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

              // If totalWeight > 0, estimate payout assuming this bet wins
              if (!totalWeight.isZero() && !weight.isZero()) {
                const estimated = weight.mul(totalStaked).div(totalWeight);
                holdEstimate = estimated.toString();
                // Multiplier = estimated / stake
                if (!stake.isZero()) {
                  const mult = estimated.mul(100).div(stake).toNumber() / 100;
                  holdMultiplier = mult.toFixed(2);
                }
              }
            }
          }
        } catch {
          // Bucket info fetch failed, use defaults
        }

        return {
          exitValue: netExitPayout.toString(),
          exitFee: exitFee.toString(),
          canExit,
          exitPoolRemaining: exitPoolRemaining.toString(),
          holdMultiplier,
          holdEstimate,
        };
      } catch (error) {
        console.error('getPotentialProfit error:', error);
        return null;
      }
    },
    [readContract, category, getContractAddressForCategory]
  );

  return {
    simulatePlaceBet,
    getBet,
    getBucketInfo,
    getResolvedValue,
    getStats,
    isTrustedOracle,
    getRequiredConfirmations,
    // DPM functions
    getDPMInfo,
    getExitValue,
    getK,
    getPotentialProfit,
  };
}
