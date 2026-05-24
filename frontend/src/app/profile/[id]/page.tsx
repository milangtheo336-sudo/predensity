'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, redirect } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/header';

export default function PublicProfilePage() {
  const params = useParams();
  const profileUserId = params.id as string;
  const { user, isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white dark:bg-black">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // If viewing own profile, redirect to my-bets
  if (isSignedIn && user?.id === profileUserId) {
    redirect('/my-bets');
  }

  // Render the my-bets page with publicViewUserId via URL search param
  // We redirect to my-bets with a query param that triggers public view
  if (typeof window !== 'undefined') {
    window.location.href = `/my-bets?viewUser=${profileUserId}`;
  }
  return null;
}
