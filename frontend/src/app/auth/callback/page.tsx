'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMagic, getDIDToken, getUserInfo } from '@/lib/magic';
import { useMagic } from '@/context/MagicContext';

export default function AuthCallback() {
  const [status, setStatus] = useState('Processing...');
  const router = useRouter();
  const { refreshUser } = useMagic();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const magic = getMagic();
        
        // Check if this is actually an OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        const hasOAuthParams = urlParams.has('code') || urlParams.has('state');
        
        if (!hasOAuthParams) {
          router.push('/');
          return;
        }
        
        setStatus('Completing authentication...');
        
        // Finish the OAuth flow
        const result = await magic.oauth2.getRedirectResult();
        
        // Clear the OAuth flag
        sessionStorage.removeItem('magic-oauth-initiated');
        const returnUrl = sessionStorage.getItem('magic-oauth-return-url') || '/markets';
        sessionStorage.removeItem('magic-oauth-return-url');
        
        setStatus('Creating your wallet...');
        
        // Extract wallet address from OAuth result
        let walletAddress = result.magic?.userMetadata?.publicAddress || 
                           result.magic?.userMetadata?.wallets?.ethereum?.publicAddress ||
                           result.magic?.wallets?.ethereum?.publicAddress;
        
        const email = result.magic?.userMetadata?.email;
        const issuer = result.magic?.userMetadata?.issuer;
        
        // If still no wallet address, try to get it from the issuer DID
        if (!walletAddress && issuer) {
          const match = issuer.match(/0x[a-fA-F0-9]{40}/);
          if (match) {
            walletAddress = match[0];
          }
        }
        
        if (!email || !walletAddress || !issuer) {
          throw new Error(`Incomplete user info`);
        }
        
        // Get DID token for backend auth
        const didToken = await getDIDToken();
        
        // Create wallet
        const response = await fetch('/api/wallet/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${didToken}`,
          },
          body: JSON.stringify({
            userId: issuer,
            email: email,
            magicEOAAddress: walletAddress,
          }),
        });

        const data = await response.json();
        
        // Whether wallet was created or already exists, set user data
        // Set user data in sessionStorage for immediate UI update
        sessionStorage.setItem('magic-auth-completed', 'true');
        sessionStorage.setItem('magic-user-email', email);
        sessionStorage.setItem('magic-user-address', walletAddress);
        sessionStorage.setItem('magic-user-issuer', issuer);
        
        // Cache full user object
        const userData = {
          email,
          publicAddress: walletAddress,
          issuer,
        };
        sessionStorage.setItem('magic-user-cache', JSON.stringify(userData));

        if (!response.ok && response.status !== 409) {
          throw new Error(data.error || 'Failed to create wallet');
        }

        setStatus('Success! Redirecting...');
        
        // Refresh user in context - this will pick up the cached data
        await refreshUser();
        
        // Small delay to ensure context updates propagate
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Navigate to markets page
        router.push(returnUrl);
      } catch (err) {
        if (err instanceof Error && err.message.includes('MISSING_PKCE_METADATA')) {
          setStatus('Session expired. Please try signing in again.');
          setTimeout(() => { router.push('/'); }, 3000);
        } else {
          setStatus('Authentication failed. Redirecting...');
          setTimeout(() => { router.push('/'); }, 2000);
        }
      }
    };

    handleCallback();
  }, [router, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <div className="mb-8">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#1a73e8]"></div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{status}</h2>
        <p className="text-gray-400">Please wait while we set up your account.</p>
      </div>
    </div>
  );
}
