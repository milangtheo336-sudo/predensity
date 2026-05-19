/**
 * Hook for proxy wallet betting (Polymarket-style)
 * 
 * User signs messages with Magic Link (no popup after initial setup)
 * Backend executes transactions through proxy wallet
 * User still controls funds - proxy wallet is owned by user's Magic Link address
 */

import { useState, useEffect } from 'react';
import { signMessage, getUserInfo } from '@/lib/magic';
import { Category } from '@/lib/types/categories';

export function useProxyWalletBetting() {
  const [proxyWalletAddress, setProxyWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  /**
   * Check if user has a proxy wallet
   */
  const checkProxyWallet = async () => {
    try {
      setIsLoading(true);
      const userInfo = await getUserInfo();
      
      if (!userInfo?.publicAddress) {
        console.log('[useProxyWalletBetting] No user address');
        return;
      }

      const response = await fetch(`/api/proxy-wallet/create?userAddress=${userInfo.publicAddress}`);
      const data = await response.json();

      if (data.exists) {
        setProxyWalletAddress(data.proxyWalletAddress);
        setNeedsSetup(false);
        console.log('[useProxyWalletBetting] Proxy wallet found:', data.proxyWalletAddress);
      } else {
        setNeedsSetup(true);
        console.log('[useProxyWalletBetting] No proxy wallet found');
      }
    } catch (error) {
      console.error('[useProxyWalletBetting] Error checking proxy wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Create a proxy wallet for the user
   */
  const createProxyWallet = async (): Promise<string> => {
    try {
      setIsLoading(true);
      const userInfo = await getUserInfo();
      
      if (!userInfo?.publicAddress) {
        throw new Error('No user address found');
      }

      console.log('[useProxyWalletBetting] Creating proxy wallet...');

      const response = await fetch('/api/proxy-wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: userInfo.publicAddress }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create proxy wallet');
      }

      const data = await response.json();
      setProxyWalletAddress(data.proxyWalletAddress);
      setNeedsSetup(false);

      console.log('[useProxyWalletBetting] Proxy wallet created:', data.proxyWalletAddress);

      return data.proxyWalletAddress;
    } catch (error: any) {
      console.error('[useProxyWalletBetting] Error creating proxy wallet:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Place a bet using proxy wallet (gasless for user)
   */
  const placeBet = async (
    category: Category,
    targetTimestamp: number,
    priceMin: string,
    priceMax: string,
    stakeUsdc: string,
    asset: string,
    userId: string
  ): Promise<{ txHash: string }> => {
    try {
      setIsPlacing(true);

      // Get user info
      const userInfo = await getUserInfo();
      if (!userInfo?.publicAddress) {
        throw new Error('No user address found');
      }

      // Check if proxy wallet exists
      if (!proxyWalletAddress) {
        throw new Error('No proxy wallet found. Please set up your wallet first.');
      }

      console.log('[useProxyWalletBetting] Placing bet...', { category, stakeUsdc });

      // Create message to sign
      const message = `Place Bet on Predensity\n\nBet Details: ${JSON.stringify({
        category,
        targetTimestamp,
        priceMin,
        priceMax,
        stakeUsdc,
        asset,
        timestamp: Date.now(),
      })}`;

      console.log('[useProxyWalletBetting] Signing message...');

      // Sign message with Magic Link (uses personal_sign, no popup)
      const signature = await signMessage(message);

      console.log('[useProxyWalletBetting] Signature obtained, submitting bet...');

      // Submit to backend
      const response = await fetch('/api/proxy-wallet/place-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: userInfo.publicAddress,
          proxyWalletAddress,
          signature,
          message,
          category,
          targetTimestamp,
          priceMin,
          priceMax,
          stakeUsdc,
          asset,
          userId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to place bet');
      }

      const result = await response.json();
      console.log('[useProxyWalletBetting] Bet placed successfully:', result.txHash);

      return { txHash: result.txHash };
    } catch (error: any) {
      console.error('[useProxyWalletBetting] Error placing bet:', error);
      throw error;
    } finally {
      setIsPlacing(false);
    }
  };

  // Check for proxy wallet on mount
  useEffect(() => {
    checkProxyWallet();
  }, []);

  return {
    proxyWalletAddress,
    needsSetup,
    isLoading,
    isPlacing,
    createProxyWallet,
    placeBet,
    checkProxyWallet,
  };
}
