'use client';

import React from 'react';

export function PredictionCardSkeleton() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <img src="/predensity-logo.png" alt="Predensity" className="w-32 h-32 object-contain animate-pulse" />
    </div>
  );
}
