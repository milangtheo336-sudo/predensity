'use client';

import React from 'react';

export function PredictionCardSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center">
      <img src="/predensity-logo.png" alt="Predensity" className="w-32 h-32 object-contain animate-pulse hidden dark:block" />
      <img src="/white the loading predensity logo.png" alt="Predensity" className="w-32 h-32 object-contain animate-pulse dark:hidden" />
      <span className="mt-4 text-gray-900 dark:text-white text-lg font-semibold tracking-wide">predensity</span>
    </div>
  );
}
