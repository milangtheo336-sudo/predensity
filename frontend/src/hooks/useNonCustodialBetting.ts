/**
 * Hook for non-custodial DPM betting
 * User signs every transaction with Magic Link
 */

import { useState } from 'react';
import { ethers } from 'ethers';
import { sendTransaction, waitForTransaction, approveToken, getTokenBalance } from '@/lib/magic';
import { CONTRACT_IDS, CONTRACT_ADDRESSES, STAKING_TOKEN_IDS, STAKING_MODE } from '@/lib/contracts/contract-config';
import { Category } from '@/lib/types/categories';

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

      const contractId = CONTRACT_IDS[category];
      const contractAddress = CONTRACT_ADDRESSES[category];
      const tokenId = STAKING_TOKEN_IDS[STAKING_MODE];

      if (!contractId || !contractAddress || !tokenId) {
        throw new Error('Contract not configured for this category');
      }

      // Convert stake to token units (6 decimals for USDC)
      const tokenAmount = ethers.utils.parseUnits(stakeUsdc, 6);

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

      // Check token balance
      const balance = await getTokenBalance(tokenId);
      if (ethers.BigNumber.from(balance).lt(tokenAmount)) {
        throw new Error(`Insufficient USDC balance. You have ${ethers.utils.formatUnits(balance, 6)} USDC`);
      }

      // Check allowance
      const tokenAbi = ['function allowance(address owner, address spender) view returns (uint256)'];
      const { getMagicProvider } = await import('@/lib/magic');
      const provider = new ethers.providers.Web3Provider(getMagicProvider());
      const tokenContract = new ethers.Contract(tokenId, tokenAbi, provider);
      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();
      const allowance = await tokenContract.allowance(userAddress, contractAddress);

      // Approve if needed
      if (allowance.lt(tokenAmount)) {
        setIsApproving(true);
        console.log('Approving USDC spending...');
        
        // Approve a large amount to avoid future approvals (1M USDC)
        const approvalAmount = ethers.utils.parseUnits('1000000', 6);
        const approveTxHash = await approveToken(tokenId, contractAddress, approvalAmount.toString());
        
        console.log('Approval transaction:', approveTxHash);
        await waitForTransaction(approveTxHash, 1);
        console.log('Approval confirmed');
        setIsApproving(false);
      }

      // Encode the bet transaction
      const betData = PLACE_BET_ABI.encodeFunctionData('placeBetWithToken', [
        targetTimestamp.toString(),
        priceMinBN,
        priceMaxBN,
        tokenAmount,
      ]);

      console.log('Placing bet...');
      
      // User signs and sends transaction
      const txHash = await sendTransaction(
        contractAddress,
        betData,
        undefined, // no native token value
        1500000 // gas limit
      );

      console.log('Bet transaction:', txHash);
      setTxHash(txHash);

      // Wait for confirmation
      await waitForTransaction(txHash, 1);
      console.log('Bet confirmed on-chain');

      // Submit to backend for recording
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
        throw new Error(error.error || 'Failed to record bet');
      }

      const result = await response.json();
      
      return {
        txHash,
        betId: result.betId,
        onChainBetId: result.onChainBetId,
      };
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
