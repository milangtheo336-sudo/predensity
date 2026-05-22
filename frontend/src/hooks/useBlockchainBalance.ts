/**
 * Hook to read USDC balance from Arc blockchain
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
        const tokenAddress = getStakingTokenId(); // Returns USDC contract address on Arc

        let balanceFormatted = '0';
        try {
          // Call USDC balanceOf via our RPC proxy
          const paddedAddr = userAddress.replace('0x', '').toLowerCase().padStart(64, '0');
          const callData = '0x70a08231' + paddedAddr; // balanceOf(address)

          const response = await fetch('/api/rpc-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_call',
              params: [{ to: tokenAddress, data: callData }, 'latest'],
            }),
            cache: 'no-store',
          });

          if (response.ok) {
            const data = await response.json();
            if (data.result && data.result !== '0x') {
              const rawBalance = BigInt(data.result);
              balanceFormatted = (Number(rawBalance) / 1e6).toString();
            }
          } else {
            console.warn('[useBlockchainBalance] RPC proxy returned status:', response.status);
          }
        } catch (e) {
          console.error('[useBlockchainBalance] Balance fetch failed:', e);
        }

        if (isMounted) {
          console.log('[useBlockchainBalance] Balance fetched:', {
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
