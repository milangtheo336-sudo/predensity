'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Profile pages redirect to the portfolio page.
// This route exists so shared links have a clean URL
// and the layout.tsx OG meta tags work per user.
export default function ProfileRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/my-bets'); }, [router]);
  return null;
}
