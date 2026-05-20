'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Check if the error message suggests a connection/fetch failure
  const isConnectionError = isOffline ||
    error.message?.includes('fetch') ||
    error.message?.includes('network') ||
    error.message?.includes('Failed to fetch') ||
    error.message?.includes('NetworkError');

  if (isConnectionError) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center px-4 text-center">
        <Image
          src="/Going offline-bro.svg"
          alt="Connection Error"
          width={320}
          height={320}
          className="mb-4"
        />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">You are offline</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 max-w-md">
          Check your internet connection and try again.
        </p>
        <button
          onClick={reset}
          className="mt-6 px-6 py-2.5 rounded-xl bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-semibold text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center px-4 text-center">
      <Image
        src="/500 Internal Server Error-cuate.svg"
        alt="Server Error"
        width={320}
        height={320}
        className="mb-4"
      />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Something went wrong</h1>
      <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 max-w-md">
        An unexpected error occurred. Please try again.
      </p>
      <div className="flex gap-3 mt-6">
        <button
          onClick={reset}
          className="px-6 py-2.5 rounded-xl bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-semibold text-sm transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/markets"
          className="px-6 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 font-semibold text-sm transition-colors"
        >
          Back to Markets
        </Link>
      </div>
    </div>
  );
}
