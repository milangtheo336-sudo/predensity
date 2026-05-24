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
        console.log('[auth-callback] Starting OAuth callback processing...');
        console.log('[auth-callback] Current URL:', window.location.href);
        console.log('[auth-callback] OAuth initiated flag:', sessionStorage.getItem('magic-oauth-initiated'));
        
        const magic = getMagic();
        
        console.log('[auth-callback] Magic instance:', !!magic);
        console.log('[auth-callback] OAuth2 extension:', !!magic.oauth2);
        
        // Check if this is actually an OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        const hasOAuthParams = urlParams.has('code') || urlParams.has('state');
        
        console.log('[auth-callback] Has OAuth params:', hasOAuthParams);
        console.log('[auth-callback] URL params:', Object.fromEntries(urlParams.entries()));
        
        if (!hasOAuthParams) {
          console.log('[auth-callback] No OAuth params found, redirecting to home');
          router.push('/');
          return;
        }
        
        setStatus('Completing authentication...');
        
        // Finish the OAuth flow
        console.log('[auth-callback] Calling getRedirectResult...');
        const result = await magic.oauth2.getRedirectResult();
        console.log('[auth-callback] Full OAuth result:', JSON.stringify(result, null, 2));
        
        // Clear the OAuth flag
        sessionStorage.removeItem('magic-oauth-initiated');
        const returnUrl = sessionStorage.getItem('magic-oauth-return-url') || '/';
        sessionStorage.removeItem('magic-oauth-return-url');
        
        setStatus('Creating your wallet...');
        
        // Extract wallet address from OAuth result
        // Check multiple possible locations for the wallet address
        let walletAddress = result.magic?.userMetadata?.publicAddress || 
                           result.magic?.userMetadata?.wallets?.ethereum?.publicAddress ||
                           result.magic?.wallets?.ethereum?.publicAddress;
        
        const email = result.magic?.userMetadata?.email;
        const issuer = result.magic?.userMetadata?.issuer;
        
        console.log('[auth-callback] Extracted data:', { email, walletAddress, issuer });
        console.log('[auth-callback] userMetadata:', result.magic?.userMetadata);
        
        // If still no wallet address, try to get it from the issuer DID
        if (!walletAddress && issuer) {
          // Extract address from DID (format: did:ethr:0x...)
          const match = issuer.match(/0x[a-fA-F0-9]{40}/);
          if (match) {
            walletAddress = match[0];
            console.log('[auth-callback] Extracted wallet from DID:', walletAddress);
          }
        }
        
        if (!email || !walletAddress || !issuer) {
          throw new Error(`Incomplete user info: email=${email}, walletAddress=${walletAddress}, issuer=${issuer}`);
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

        if (!response.ok) {
          const data = await response.json();
          
          // If wallet already exists, that's fine
          if (response.status === 409) {
            console.log('[auth-callback] Wallet already exists, redirecting...');
            setStatus('Redirecting...');
            
            // Set a flag that we just completed auth
            sessionStorage.setItem('magic-auth-completed', 'true');
            
            // Force a hard reload to ensure Magic context refreshes
            window.location.replace(returnUrl);
            return;
          }
          
          throw new Error(data.error || 'Failed to create wallet');
        }

        console.log('[auth-callback] Wallet created successfully, redirecting...');
        setStatus('Success! Redirecting...');
        
        // Set a flag that we just completed auth
        sessionStorage.setItem('magic-auth-completed', 'true');
        
        // Force a hard reload to ensure Magic context refreshes
        window.location.replace(returnUrl);
      } catch (err) {
        console.error('[auth-callback] Error:', err);
        console.error('[auth-callback] Error details:', {
          name: err instanceof Error ? err.name : 'Unknown',
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        
        // If it's a PKCE error, it means the OAuth session was lost
        // This can happen if the user refreshed or the session expired
        if (err instanceof Error && err.message.includes('MISSING_PKCE_METADATA')) {
          setStatus('Session expired. Please try signing in again.');
          setTimeout(() => { window.location.href = '/'; }, 3000);
        } else {
          setStatus('Authentication failed. Redirecting...');
          setTimeout(() => { window.location.href = '/'; }, 2000);
        }
      }
    };

    handleCallback();
  }, [router]);

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
