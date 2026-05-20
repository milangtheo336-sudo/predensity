'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center px-4 text-center">
      <Image
        src="/403 Error Forbidden-bro.svg"
        alt="Forbidden"
        width={320}
        height={320}
        className="mb-4"
      />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Access Denied</h1>
      <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 max-w-md">
        You do not have permission to access this page.
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
