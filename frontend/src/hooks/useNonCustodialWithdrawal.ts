/**
 * Hook for non-custodial withdrawals
 * User signs every withdrawal with Magic Link
 */

import { useState } from 'react';
import { ethers } from 'ethers';
import { sendTransaction, waitForTransaction, getTokenBalance } from '@/lib/magic';
import { STAKING_TOKEN_IDS, STAKING_MODE } from '@/lib/contracts/contract-config';

// ERC-20 transfer ABI
const TRANSFER_ABI = new ethers.utils.Interface([
  'function transfer(address to, uint256 amount) external returns (bool)',
]);

export function useNonCustodialWithdrawal() {
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  /**
   * Withdraw USDC to external address (non-custodial)
   * 
   * @param destinationAddress EVM address to send USDC to
   * @param amountUsdc Amount in USDC (e.g., "10.50")
   * @param userId User's Magic Link issuer (DID)
   * @returns Transaction hash
   */
  const withdraw = async (
    destinationAddress: string,
    amountUsdc: string,
    userId: string
  ): Promise<{ txHash: string }> => {
    try {
      setIsWithdrawing(true);

      const tokenId = STAKING_TOKEN_IDS[STAKING_MODE];
      if (!tokenId) {
        throw new Error('USDC token not configured');
      }

      // Validate destination address
      if (!ethers.utils.isAddress(destinationAddress)) {
        throw new Error('Invalid destination address');
      }

      // Convert amount to token units (6 decimals for USDC)
      const tokenAmount = ethers.utils.parseUnits(amountUsdc, 6);

      // Check balance
      const balance = await getTokenBalance(tokenId);
      if (ethers.BigNumber.from(balance).lt(tokenAmount)) {
        throw new Error(`Insufficient USDC balance. You have ${ethers.utils.formatUnits(balance, 6)} USDC`);
      }

      // Encode the transfer transaction
      const transferData = TRANSFER_ABI.encodeFunctionData('transfer', [
        destinationAddress,
        tokenAmount,
      ]);

      console.log('Withdrawing USDC...');
      
      // User signs and sends transaction
      const txHash = await sendTransaction(
        tokenId,
        transferData,
        undefined, // no native token value
        200000 // gas limit
      );

      console.log('Withdrawal transaction:', txHash);
      setTxHash(txHash);

      // Wait for confirmation
      await waitForTransaction(txHash, 1);
      console.log('Withdrawal confirmed on-chain');

      // Submit to backend for balance update
      const response = await fetch('/api/wallet/withdraw-non-custodial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          destinationAddress,
          amountUsdc,
          transactionHash: txHash,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update balance');
      }

      return { txHash };
    } finally {
      setIsWithdrawing(false);
    }
  };

  return {
    withdraw,
    isWithdrawing,
    txHash,
  };
}
