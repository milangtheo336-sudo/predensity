'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function UnavailablePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center px-4 text-center">
      <Image
        src="/503 Error Service Unavailable-bro.svg"
        alt="Service Unavailable"
        width={320}
        height={320}
        className="mb-4"
      />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Service Unavailable</h1>
      <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 max-w-md">
        The service is temporarily unavailable. Please try again in a few minutes.
      </p>
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-xl bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-semibold text-sm transition-colors"
        >
          Retry
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
