'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMagic, getDIDToken, getUserInfo } from '@/lib/magic';

export default function AuthCallback() {
  const [status, setStatus] = useState('Processing...');
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const magic = getMagic();
        
        // Finish the OAuth flow
        await magic.oauth.getRedirectResult();
        
        setStatus('Creating your wallet...');
        
        // Get user info
        const userInfo = await getUserInfo();
        if (!userInfo) {
          throw new Error('Failed to get user info');
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
            userId: userInfo.issuer,
            email: userInfo.email,
            magicEOAAddress: userInfo.publicAddress,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          
          // If wallet already exists, that's fine
          if (response.status === 409) {
            setStatus('Redirecting...');
            router.push('/');
            return;
          }
          
          throw new Error(data.error || 'Failed to create wallet');
        }

        setStatus('Success! Redirecting...');
        router.push('/');
      } catch (err) {
        console.error('[auth-callback] Error:', err);
        setStatus('Authentication failed. Redirecting...');
        setTimeout(() => router.push('/auth'), 2000);
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
