/**
 * Hook for non-custodial DPM betting
 * User signs every transaction with Magic Link
 */

import { useState } from 'react';
import { ethers } from 'ethers';
import { sendTransaction, waitForTransaction, approveToken, getTokenBalance } from '@/lib/magic';
import { CONTRACT_IDS, CONTRACT_ADDRESSES, STAKING_TOKEN_CONFIG, STAKING_MODE } from '@/lib/contracts/contract-config';
import { Category } from '@/lib/types/categories';

// Custom Hedera provider that disables ENS (same as in magic.ts)
class HederaProvider extends ethers.providers.JsonRpcProvider {
  async getResolver(name: string): Promise<null> {
    return null;
  }
  async resolveName(name: string): Promise<string | null> {
    if (ethers.utils.isAddress(name)) {
      return name;
    }
    return null;
  }
}

// ABI for placeBetWithToken function
const PLACE_BET_ABI = new ethers.utils.Interface([
  'function placeBetWithToken(uint256 targetTimestamp, uint256 priceMin, uint256 priceMax, uint256 tokenAmount) external returns (uint256)',
]);

export function useNonCustodialBetting() {
  const [isPlacing, setIsPlacing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  /**
   * Place a bet on DPM market (non-custodial)
   * 
   * @param category Market category (crypto, politics, sports, technology)
   * @param targetTimestamp When the prediction resolves
   * @param priceMin Minimum price in range
   * @param priceMax Maximum price in range
   * @param stakeUsdc Stake amount in USDC
   * @param asset Asset symbol (for crypto markets)
   * @param userId User's Magic Link issuer (DID)
   * @returns Transaction hash and bet ID
   */
  const placeBet = async (
    category: Category,
    targetTimestamp: number,
    priceMin: string,
    priceMax: string,
    stakeUsdc: string,
    asset: string,
    userId: string
  ): Promise<{ txHash: string; betId?: string; onChainBetId?: number }> => {
    try {
      setIsPlacing(true);
      console.log('[placeBet] Starting bet placement...', { category, stakeUsdc, userId });

      const contractId = CONTRACT_IDS[category];
      const contractAddress = CONTRACT_ADDRESSES[category];
      const tokenAddress = STAKING_TOKEN_CONFIG[STAKING_MODE]; // Use EVM address format

      if (!contractId || !contractAddress || !tokenAddress) {
        console.error('[placeBet] Contract not configured:', { contractId, contractAddress, tokenAddress });
        throw new Error('Contract not configured for this category');
      }

      console.log('[placeBet] Contract config:', { contractId, contractAddress, tokenAddress });

      // Convert stake to token units (6 decimals for USDC)
      const tokenAmount = ethers.utils.parseUnits(stakeUsdc, 6);
      console.log('[placeBet] Token amount:', tokenAmount.toString());

      // Convert prices based on category
      let priceMinBN, priceMaxBN;
      if (category === 'crypto') {
        // Crypto prices use 8 decimals
        priceMinBN = ethers.utils.parseUnits(priceMin, 8);
        priceMaxBN = ethers.utils.parseUnits(priceMax, 8);
      } else {
        // Other categories use raw values
        priceMinBN = ethers.BigNumber.from(priceMin);
        priceMaxBN = ethers.BigNumber.from(priceMax);
      }

      console.log('[placeBet] Price range:', { min: priceMinBN.toString(), max: priceMaxBN.toString() });

      // Get user address first
      const { getMagicProvider } = await import('@/lib/magic');
      const magicProvider = getMagicProvider();
      
      console.log('[placeBet] Getting user address...');
      const accounts = await magicProvider.request({ method: 'eth_accounts' });
      console.log('[placeBet] Accounts response:', accounts);
      
      const userAddress = accounts[0];
      
      if (!userAddress) {
        console.error('[placeBet] No account found in eth_accounts response');
        throw new Error('No account found. Please log in again.');
      }

      console.log('[placeBet] User address:', userAddress);

      // Check token balance
      console.log('[placeBet] Checking token balance...');
      console.log('[placeBet] Token address:', tokenAddress);
      console.log('[placeBet] User address for balance check:', userAddress);
      
      try {
        const balance = await getTokenBalance(tokenAddress, userAddress);
        console.log('[placeBet] Token balance:', ethers.utils.formatUnits(balance, 6), 'USDC');
        
        if (ethers.BigNumber.from(balance).lt(tokenAmount)) {
          throw new Error(`Insufficient USDC balance. You have ${ethers.utils.formatUnits(balance, 6)} USDC`);
        }
      } catch (balanceError) {
        console.error('[placeBet] Balance check failed:', balanceError);
        // The user's Magic Link wallet doesn't have USDC on-chain
        // Their balance is in the custodial managed wallet
        throw new Error(
          'Your USDC is in the custodial wallet. Non-custodial betting requires USDC in your Magic Link wallet on-chain. ' +
          'Please contact support to enable non-custodial betting, or use the custodial betting system.'
        );
      }

      // Check allowance
      console.log('[placeBet] Checking token allowance...');
      const tokenAbi = ['function allowance(address owner, address spender) view returns (uint256)'];
      
      // Use Hedera provider directly to avoid ENS issues
      const hederaProvider = new HederaProvider('https://testnet.hashio.io/api');
      const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, hederaProvider);
      const allowance = await tokenContract.allowance(userAddress, contractAddress);
      console.log('[placeBet] Current allowance:', ethers.utils.formatUnits(allowance, 6), 'USDC');

      // Approve if needed
      if (allowance.lt(tokenAmount)) {
        setIsApproving(true);
        console.log('[placeBet] Approving USDC spending...');
        
        // Approve a large amount to avoid future approvals (1M USDC)
        const approvalAmount = ethers.utils.parseUnits('1000000', 6);
        const approveTxHash = await approveToken(tokenAddress, contractAddress, approvalAmount.toString());
        
        console.log('[placeBet] Approval transaction:', approveTxHash);
        await waitForTransaction(approveTxHash, 1);
        console.log('[placeBet] Approval confirmed');
        setIsApproving(false);
      } else {
        console.log('[placeBet] Sufficient allowance, skipping approval');
      }

      // Encode the bet transaction
      const betData = PLACE_BET_ABI.encodeFunctionData('placeBetWithToken', [
        targetTimestamp.toString(),
        priceMinBN,
        priceMaxBN,
        tokenAmount,
      ]);

      console.log('[placeBet] Placing bet...');
      
      // User signs and sends transaction
      const txHash = await sendTransaction(
        contractAddress,
        betData,
        undefined, // no native token value
        1500000 // gas limit
      );

      console.log('[placeBet] Bet transaction:', txHash);
      setTxHash(txHash);

      // Wait for confirmation
      await waitForTransaction(txHash, 1);
      console.log('[placeBet] Bet confirmed on-chain');

      // Submit to backend for recording
      console.log('[placeBet] Recording bet in backend...');
      const response = await fetch('/api/bet/place-non-custodial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          category,
          targetTimestamp,
          priceMin,
          priceMax,
          stakeUsdc,
          asset,
          transactionHash: txHash,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[placeBet] Backend recording failed:', error);
        throw new Error(error.error || 'Failed to record bet');
      }

      const result = await response.json();
      console.log('[placeBet] Bet recorded successfully:', result);
      
      return {
        txHash,
        betId: result.betId,
        onChainBetId: result.onChainBetId,
      };
    } catch (error) {
      console.error('[placeBet] Error:', error);
      throw error;
    } finally {
      setIsPlacing(false);
      setIsApproving(false);
    }
  };

  return {
    placeBet,
    isPlacing,
    isApproving,
    txHash,
  };
}
