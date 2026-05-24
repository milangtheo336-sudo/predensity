'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMagic } from '@/context/MagicContext';
import { getDIDToken } from '@/lib/magic';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { login, refreshUser } = useMagic();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Step 1: Login with Magic Link
      await login(email);
      
      // Step 2: Get DID token for backend auth
      const didToken = await getDIDToken();
      
      // Step 3: Create wallet (backend deploys proxy wallet)
      const response = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${didToken}`,
        },
        body: JSON.stringify({
          userId: (await import('@/lib/magic').then(m => m.getUserInfo()))?.issuer,
          email,
          phoneNumber: phoneNumber || undefined,
          magicEOAAddress: (await import('@/lib/magic').then(m => m.getUserInfo()))?.publicAddress,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        
        // If wallet already exists, that's fine
        if (response.status === 409) {
          await refreshUser();
          router.push('/');
          return;
        }
        
        throw new Error(data.error || 'Failed to create wallet');
      }

      await refreshUser();
      router.push('/');
    } catch (err) {
      console.error('[auth] Error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">predensity</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to start trading predictions
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-2">
                Phone Number (Optional)
              </label>
              <input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="+254712345678"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Required for M-Pesa deposits
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Signing in...' : 'Sign in with Magic Link'}
          </button>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              We'll send a magic link to your email.
              <br />
              No password required.
            </p>
          </div>
        </form>

        <div className="mt-8 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="font-medium mb-2">Non-Custodial Security</p>
          <p>
            Your funds are secured by Magic Link's MPC network. We never have access to your
            private keys. You maintain full control of your assets.
          </p>
        </div>
      </div>
    </div>
  );
}
