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

export function useBlockchainBalance(userAddress: string | undefined) {
  const [balance, setBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Use refs to access current values in callbacks
  const balanceRef = useRef(balance);
  
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  // Expose functions globally for immediate balance updates
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Listen for custom broadcast events so all hook instances sync simultaneously
      const handleSync = () => setRefreshTrigger(prev => prev + 1);
      const handleExact = (e: any) => {
        if (e.detail && e.detail.exactBalance !== undefined) {
          setBalance(e.detail.exactBalance.toString());
        }
      };
      
      window.addEventListener('predensity_sync_balance', handleSync);
      window.addEventListener('predensity_exact_balance', handleExact);
      
      // Mount the global dispatch function just once
      if (!(window as any).adjustBalance) {
        const dispatchSync = () => {
          console.log('[useBlockchainBalance] Broadcasting real-time sync...');
          window.dispatchEvent(new Event('predensity_sync_balance'));
          setTimeout(() => window.dispatchEvent(new Event('predensity_sync_balance')), 2000);
          setTimeout(() => window.dispatchEvent(new Event('predensity_sync_balance')), 4000);
          setTimeout(() => window.dispatchEvent(new Event('predensity_sync_balance')), 7000);
          setTimeout(() => window.dispatchEvent(new Event('predensity_sync_balance')), 11000);
        };
        
        const dispatchExact = (exactValue: number) => {
          console.log('[useBlockchainBalance] Fast-forwarding balance with backend truth:', exactValue);
          window.dispatchEvent(new CustomEvent('predensity_exact_balance', { detail: { exactBalance: exactValue } }));
          // Still poll once after 5s just for long-term consistency in case of edge issues
          setTimeout(() => window.dispatchEvent(new Event('predensity_sync_balance')), 5000);
        };

        (window as any).adjustBalance = dispatchSync;
        (window as any).refreshBalance = dispatchSync;
        (window as any).updateBalanceOptimistic = dispatchSync;
        (window as any).refreshBalanceWithExact = dispatchExact;
      }
      
      return () => {
        window.removeEventListener('predensity_sync_balance', handleSync);
        window.removeEventListener('predensity_exact_balance', handleExact);
      };
    }
  }, []); // Empty deps

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
          // Hedera rejects unknown query params so we can't use ?t=Date.now().
          // To aggressively bust browser/Next.js caching, we randomly fluctuate the limit parameter!
          const randomLimit = 90 + Math.floor(Math.random() * 10);
          const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${userAddress}/tokens?limit=${randomLimit}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
          });
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

  console.log('[useBlockchainBalance] Display balance:', balance);
  
  return {
    balance: parseFloat(balance),
    balanceString: balance,
    isLoading,
    error,
  };
}
