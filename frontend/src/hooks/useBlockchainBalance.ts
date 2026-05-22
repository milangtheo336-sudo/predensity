/**
 * Hook to read USDC balance from Hedera blockchain
 * Replaces custodial balance tracking with on-chain balance
 */

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getTokenBalance } from '@/lib/magic';
import { getStakingTokenAddress } from '@/lib/contracts/contract-config';

export function useBlockchainBalance(userAddress: string | undefined) {
  const [balance, setBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress) {
      setBalance('0');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchBalance = async () => {
      try {
        const tokenAddress = getStakingTokenAddress();
        const balanceWei = await getTokenBalance(tokenAddress, userAddress);
        
        if (isMounted) {
          const balanceFormatted = ethers.utils.formatUnits(balanceWei, 6); // USDC has 6 decimals
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

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userAddress]);

  return {
    balance: parseFloat(balance),
    balanceString: balance,
    isLoading,
    error,
  };
}
