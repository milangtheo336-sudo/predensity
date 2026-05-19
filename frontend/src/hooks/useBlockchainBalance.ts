/**
 * Hook to read USDC balance from Hedera blockchain
 * Replaces custodial balance tracking with on-chain balance
 * Supports optimistic updates for immediate UI feedback
 * 
 * Balance is fetched:
 * - On component mount
 * - After user actions (deposit, withdraw, bet) via window.refreshBalance()
 * - Cached in localStorage to prevent flickering
 */

import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { getStakingTokenId } from '@/lib/contracts/contract-config';

// Cache key for localStorage
const BALANCE_CACHE_KEY = 'predensity_balance_cache';

interface BalanceCache {
  address: string;
  balance: string;
  timestamp: number;
}

export function useBlockchainBalance(userAddress: string | undefined) {
  // Load cached balance immediately
  const getCachedBalance = (): string => {
    if (typeof window === 'undefined' || !userAddress) return '0';
    try {
      const cached = localStorage.getItem(BALANCE_CACHE_KEY);
      if (cached) {
        const data: BalanceCache = JSON.parse(cached);
        // Use cache if it's for the same address and less than 5 minutes old
        if (data.address === userAddress && Date.now() - data.timestamp < 300000) {
          return data.balance;
        }
      }
    } catch (e) {
      console.error('[useBlockchainBalance] Cache read error:', e);
    }
    return '0';
  };

  const [balance, setBalance] = useState(getCachedBalance());
  const [optimisticBalance, setOptimisticBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Use refs to access current values in callbacks
  const balanceRef = useRef(balance);
  const optimisticBalanceRef = useRef(optimisticBalance);
  
  useEffect(() => {
    balanceRef.current = balance;
    optimisticBalanceRef.current = optimisticBalance;
  }, [balance, optimisticBalance]);

  // Cache balance to localStorage
  const cacheBalance = (address: string, balanceValue: string) => {
    if (typeof window === 'undefined') return;
    try {
      const cache: BalanceCache = {
        address,
        balance: balanceValue,
        timestamp: Date.now(),
      };
      localStorage.setItem(BALANCE_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error('[useBlockchainBalance] Cache write error:', e);
    }
  };

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
      
      // Adjust balance by amount (for deposits/withdrawals/bets)
      (window as any).adjustBalance = (amount: number) => {
        console.log('[useBlockchainBalance] Adjusting balance by:', amount);
        const currentBal = parseFloat(optimisticBalanceRef.current || balanceRef.current);
        const newBal = Math.max(0, currentBal + amount);
        console.log('[useBlockchainBalance] New balance:', newBal, 'from', currentBal);
        setOptimisticBalance(newBal.toString());
        // Clear optimistic balance after 10 seconds and fetch real balance
        setTimeout(() => {
          console.log('[useBlockchainBalance] Clearing optimistic balance, fetching real balance');
          setOptimisticBalance(null);
          setRefreshTrigger(prev => prev + 1);
        }, 10000);
      };
    }
  }, []); // Empty deps - functions use refs

  useEffect(() => {
    if (!userAddress) {
      setBalance('0');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchBalance = async () => {
      // Don't show loading if we have cached balance
      const hasCachedBalance = balance !== '0';
      if (!hasCachedBalance) {
        setIsLoading(true);
      }
      
      try {
        console.log('[useBlockchainBalance] Fetching balance for address:', userAddress);
        const tokenId = getStakingTokenId();
        const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
        const mirrorNodeUrl = network === 'mainnet' 
          ? 'https://mainnet-public.mirrornode.hedera.com'
          : 'https://testnet.mirrornode.hedera.com';

        let balanceFormatted = '0';
        try {
          const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${userAddress}/tokens`);
          if (response.ok) {
            const data = await response.json();
            const tokenRecord = data.tokens?.find((t: any) => t.token_id === tokenId);
            if (tokenRecord) {
              const decimals = parseInt(tokenRecord.decimals || '6', 10);
              // Format balance using its decimals
              balanceFormatted = (parseInt(tokenRecord.balance, 10) / Math.pow(10, decimals)).toString();
            }
          } else {
            console.warn('[useBlockchainBalance] Mirror node returned status:', response.status);
          }
        } catch (e) {
          console.error('[useBlockchainBalance] Mirror node fetch failed:', e);
        }

        if (isMounted) {
          console.log('[useBlockchainBalance] Balance fetched via Mirror Node:', {
            address: userAddress,
            balance: balanceFormatted,
          });
          setBalance(balanceFormatted);
          cacheBalance(userAddress, balanceFormatted); // Cache the balance
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[useBlockchainBalance] Error fetching balance:', err);
        if (isMounted) {
          // On error, keep the current balance (don't reset to 0)
          // This prevents flickering when network requests fail
          // Only log the error, don't show to user
          console.log('[useBlockchainBalance] Using cached balance due to network error');
          setError(null); // Don't show error to user
          setIsLoading(false);
        }
      }
    };

    // Initial fetch on mount or when refreshTrigger changes
    fetchBalance();

    // No automatic interval - balance only updates on user actions
    // (deposit, withdraw, bet placement trigger refreshTrigger)

    return () => {
      isMounted = false;
    };
  }, [userAddress, refreshTrigger, balance]); // Fetch only on mount or manual refresh

  // Use optimistic balance if available, otherwise use real balance
  const displayBalance = optimisticBalance !== null ? optimisticBalance : balance;
  
  console.log('[useBlockchainBalance] Display balance:', {
    displayBalance,
    optimisticBalance,
    balance,
    isOptimistic: optimisticBalance !== null,
  });
  
  return {
    balance: parseFloat(displayBalance),
    balanceString: displayBalance,
    isLoading,
    error,
  };
}
