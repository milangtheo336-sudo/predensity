'use client';

import React from 'react';
import { MarketPageSkeleton } from '@/components/page-skeleton';

// Keep export for any remaining references — now delegates to the proper skeleton
export function PredictionCardSkeleton() {
  return <MarketPageSkeleton />;
}
