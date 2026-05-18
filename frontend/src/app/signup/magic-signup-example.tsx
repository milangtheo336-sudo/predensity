'use client';

/**
 * Example Sign-Up Page with Magic Link (Replaces Clerk)
 * 
 * This shows how to implement the complete sign-up flow.
 * Copy this logic to your actual signup page.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithMagic } from '@/lib/magic';

export default function MagicSignUpExample() {
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'creating-wallet'>('email');
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Authenticate with Magic Link
      setStep('email');
      const { address: magicEOAAddress, email: userEmail } = await loginWithMagic(email);
      
      console.log('Magic Link authenticated:', magicEOAAddress);

      // Step 2: Create non-custodial wallet
      setStep('creating-wallet');
      const walletResponse = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: magicEOAAddress, // Use Magic EOA as userId
          email: userEmail,
          phoneNumber: phoneNumber || undefined,
          magicEOAAddress,
        }),
      });

      if (!walletResponse.ok) {
        const error = await walletResponse.json();
        throw new Error(error.error || 'Wallet creation failed');
      }

      const { wallet } = await walletResponse.json();
      console.log('Proxy wallet created:', wallet.proxyWalletAddress);

      // Step 3: Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Sign up error:', error);
      alert(error instanceof Error ? error.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Create Your Account</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign up with email. You'll control your funds via Magic Link.
          </p>
        </div>
        
        <form onSubmit={handleSignUp} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number (Optional - for M-Pesa)
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+254712345678"
              className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
              disabled={loading}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 p-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              step === 'email' ? 'Sending magic link...' : 'Creating wallet...'
            ) : (
              'Sign Up'
            )}
          </button>
        </form>
        
        <div className="space-y-3">
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <h4 className="font-medium text-green-900 mb-1">Non-Custodial Wallet</h4>
            <p className="text-sm text-green-800">
              You control your funds. We never have access to your private keys.
            </p>
          </div>

          <div className="text-xs text-gray-500">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  );
}
