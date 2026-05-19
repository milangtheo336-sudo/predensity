/**
 * Proxy Wallet Setup Component
 * 
 * One-time setup for users:
 * 1. Create proxy wallet (backend deploys, user pays nothing)
 * 2. Approve proxy wallet to spend USDC (ONE Magic Link popup)
 * 3. After that, betting is seamless (no more popups)
 */

'use client';

import { useState } from 'react';
import { useProxyWalletBetting } from '@/hooks/useProxyWalletBetting';
import { approveToken, getUserInfo } from '@/lib/magic';
import { STAKING_TOKEN_CONFIG, STAKING_MODE } from '@/lib/contracts/contract-config';
import { ethers } from 'ethers';

export function ProxyWalletSetup() {
  const { proxyWalletAddress, needsSetup, isLoading, createProxyWallet } = useProxyWalletBetting();
  const [isApproving, setIsApproving] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async () => {
    try {
      setError(null);

      // Step 1: Create proxy wallet
      console.log('[ProxyWalletSetup] Creating proxy wallet...');
      const walletAddress = await createProxyWallet();
      console.log('[ProxyWalletSetup] Proxy wallet created:', walletAddress);

      // Step 2: Approve proxy wallet to spend USDC
      console.log('[ProxyWalletSetup] Approving USDC spending...');
      setIsApproving(true);

      const tokenAddress = STAKING_TOKEN_CONFIG[STAKING_MODE];
      const approvalAmount = ethers.utils.parseUnits('1000000', 6); // 1M USDC

      await approveToken(tokenAddress, walletAddress, approvalAmount.toString());

      console.log('[ProxyWalletSetup] Setup complete!');
      setSetupComplete(true);
    } catch (err: any) {
      console.error('[ProxyWalletSetup] Error:', err);
      setError(err.message || 'Setup failed');
    } finally {
      setIsApproving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-900">Checking wallet setup...</p>
      </div>
    );
  }

  if (!needsSetup && proxyWalletAddress) {
    return (
      <div className="p-4 bg-green-50 rounded-lg">
        <p className="text-sm text-green-900">Wallet ready for betting</p>
        <p className="text-xs text-green-700 mt-1 font-mono">{proxyWalletAddress}</p>
      </div>
    );
  }

  if (setupComplete) {
    return (
      <div className="p-4 bg-green-50 rounded-lg">
        <p className="text-sm text-green-900 font-medium">Setup complete!</p>
        <p className="text-xs text-green-700 mt-1">You can now place bets seamlessly</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-yellow-50 rounded-lg space-y-3">
      <div>
        <p className="text-sm font-medium text-yellow-900">One-time wallet setup required</p>
        <p className="text-xs text-yellow-700 mt-1">
          This enables seamless betting without wallet popups
        </p>
      </div>

      {error && (
        <div className="p-2 bg-red-100 rounded text-xs text-red-900">
          {error}
        </div>
      )}

      <button
        onClick={handleSetup}
        disabled={isApproving}
        className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 text-sm font-medium"
      >
        {isApproving ? 'Setting up...' : 'Set up wallet'}
      </button>

      <div className="text-xs text-yellow-700 space-y-1">
        <p>What happens:</p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li>We create a smart contract wallet for you (free)</li>
          <li>You approve it to use your USDC (one popup)</li>
          <li>After that, betting is seamless (no more popups)</li>
        </ol>
      </div>
    </div>
  );
}
