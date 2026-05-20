'use client';

import { useState } from 'react';
import { useMagic } from '@/context/MagicContext';
import { getDIDToken } from '@/lib/magic';

interface SessionKeySetupProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function SessionKeySetup({ onComplete, onSkip }: SessionKeySetupProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [maxAmount, setMaxAmount] = useState('100');
  const [dailyLimit, setDailyLimit] = useState('1000');
  const [duration, setDuration] = useState('30'); // days
  const { user } = useMagic();

  const handleCreateSessionKey = async () => {
    if (!user) {
      setError('Please sign in first');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const operatorAddress = process.env.NEXT_PUBLIC_TREASURY_EVM_ADDRESS || '';
      
      // Create delegation message
      const delegationMessage = {
        delegate: operatorAddress,
        maxAmount: parseFloat(maxAmount),
        dailyLimit: parseFloat(dailyLimit),
        duration: parseInt(duration) * 24 * 60 * 60, // convert days to seconds
        nonce: Date.now(),
      };

      // Get Magic instance
      const magic = (await import('@/lib/magic')).getMagic();
      
      // User signs the delegation message
      const messageString = JSON.stringify(delegationMessage);
      const signature = await magic.wallet.signMessage(messageString);

      // Send to backend
      const didToken = await getDIDToken();
      const response = await fetch('/api/wallet/session-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${didToken}`,
        },
        body: JSON.stringify({
          userId: user.issuer,
          signature,
          delegationMessage,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create session key');
      }

      onComplete();
    } catch (err) {
      console.error('[session-key-setup] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create session key');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-black border border-white/10 rounded-3xl p-8 max-w-md w-full">
        <h2 className="text-2xl font-semibold text-white mb-2">Enable Instant Betting</h2>
        <p className="text-gray-400 text-sm mb-6">
          Sign once to authorize instant bets. You can revoke this anytime.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Max per bet (USDC)
            </label>
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="100"
              min="1"
              max="10000"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum USDC per single bet</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Daily limit (USDC)
            </label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1000"
              min="1"
              max="100000"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum USDC per day</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Duration (days)
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">How long this authorization lasts</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-300">
              <p className="font-medium mb-1">What this means:</p>
              <ul className="space-y-1 text-blue-400">
                <li>• Place bets instantly without popups</li>
                <li>• Withdrawals still require your signature</li>
                <li>• You can revoke this anytime</li>
                <li>• Your funds stay in your wallet</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          {onSkip && (
            <button
              onClick={onSkip}
              disabled={isCreating}
              className="flex-1 px-6 py-3 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-white/10 rounded-xl font-medium transition-all disabled:opacity-50"
            >
              Skip for now
            </button>
          )}
          <button
            onClick={handleCreateSessionKey}
            disabled={isCreating}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Enable Instant Betting'}
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          Withdrawals always require your signature with 24-hour delay for security
        </p>
      </div>
    </div>
  );
}
