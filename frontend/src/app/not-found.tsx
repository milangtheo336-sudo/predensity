'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center px-4 text-center">
      <div className="w-72 h-72 sm:w-96 sm:h-96">
        <DotLottieReact src="/404-not-found.lottie" loop autoplay style={{ width: '100%', height: '100%' }} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-4">Page Not Found</h1>
      <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/markets"
        className="mt-6 px-6 py-2.5 rounded-xl bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-semibold text-sm transition-colors"
      >
        Back to Markets
      </Link>
    </div>
  );
}
