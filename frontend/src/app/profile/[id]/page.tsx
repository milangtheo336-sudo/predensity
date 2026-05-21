'use client';

import { useParams, redirect } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { PortfolioPageContent } from '@/app/my-bets/page';

export default function PublicProfilePage() {
  const params = useParams();
  const profileUserId = params.id as string;
  const { user, isSignedIn, isLoaded } = useUser();

  // Wait for Clerk to load before deciding
  if (!isLoaded) return null;

  // If viewing own profile, redirect to my-bets
  if (isSignedIn && user?.id === profileUserId) {
    redirect('/my-bets');
  }

  return <PortfolioPageContent publicViewUserId={profileUserId} />;
}
