/**
 * Hook to read USDC balance from Hedera blockchain
 * Replaces custodial balance tracking with on-chain balance
 * Supports optimistic updates for immediate UI feedback
 */

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getTokenBalance } from '@/lib/magic';
import { getStakingTokenAddress } from '@/lib/contracts/contract-config';

export function useBlockchainBalance(userAddress: string | undefined) {
  const [balance, setBalance] = useState('0');
  const [optimisticBalance, setOptimisticBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Expose functions globally for immediate balance updates
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Immediate refresh from blockchain
      (window as any).refreshBalance = () => {
        console.log('[useBlockchainBalance] Manual refresh triggered');
        setRefreshTrigger(prev => prev + 1);
      };
      
      // Optimistic update - show new balance immediately
      (window as any).updateBalanceOptimistic = (newBalance: number) => {
        console.log('[useBlockchainBalance] Optimistic update:', newBalance);
        setOptimisticBalance(newBalance.toString());
        // Clear optimistic balance after 10 seconds and fetch real balance
        setTimeout(() => {
          setOptimisticBalance(null);
          setRefreshTrigger(prev => prev + 1);
        }, 10000);
      };
      
      // Adjust balance by amount (for deposits/withdrawals)
      (window as any).adjustBalance = (amount: number) => {
        console.log('[useBlockchainBalance] Adjusting balance by:', amount);
        const currentBal = parseFloat(optimisticBalance || balance);
        const newBal = Math.max(0, currentBal + amount);
        setOptimisticBalance(newBal.toString());
        // Clear optimistic balance after 10 seconds and fetch real balance
        setTimeout(() => {
          setOptimisticBalance(null);
          setRefreshTrigger(prev => prev + 1);
        }, 10000);
      };
    }
  }, [balance, optimisticBalance]);

  useEffect(() => {
    if (!userAddress) {
      setBalance('0');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchBalance = async () => {
      try {
        console.log('[useBlockchainBalance] Fetching balance for address:', userAddress);
        const tokenAddress = getStakingTokenAddress();
        const balanceWei = await getTokenBalance(tokenAddress, userAddress);
        
        if (isMounted) {
          const balanceFormatted = ethers.utils.formatUnits(balanceWei, 6); // USDC has 6 decimals
          console.log('[useBlockchainBalance] Balance fetched:', {
            address: userAddress,
            balance: balanceFormatted,
            balanceWei: balanceWei.toString(),
          });
          setBalance(balanceFormatted);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[useBlockchainBalance] Error fetching balance:', err);
        if (isMounted) {
          // If balance fetch fails, assume 0 (user might not have associated token yet)
          // This is expected for new wallets that haven't associated USDC yet
          setBalance('0');
          setError(null); // Don't show error to user, just default to 0
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchBalance();

    // Refresh balance every 30 seconds (Mirror Node queries are free)
    const interval = setInterval(fetchBalance, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userAddress, refreshTrigger]); // Add refreshTrigger as dependency

  // Use optimistic balance if available, otherwise use real balance
  const displayBalance = optimisticBalance !== null ? optimisticBalance : balance;
  
  return {
    balance: parseFloat(displayBalance),
    balanceString: displayBalance,
    isLoading,
    error,
  };
}
