'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function PredictionCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-16 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
          <div className="h-4 w-24 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
        </div>

        <div className="flex items-center space-x-3">
          <div className="w-16 h-16 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/4 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
            <div className="h-4 w-1/2 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Resolution Time Selection Skeleton */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 dark:bg-neutral-800 rounded-full animate-shimmer" />
            <div className="h-4 w-40 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-100 dark:bg-neutral-900 p-4 rounded-lg space-y-2">
              <div className="h-4 w-12 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer mx-auto" />
              <div className="h-8 w-24 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer mx-auto" />
              <div className="h-3 w-16 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer mx-auto" />
            </div>
            <div className="bg-gray-100 dark:bg-neutral-900 p-4 rounded-lg space-y-2">
              <div className="h-4 w-12 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer mx-auto" />
              <div className="h-8 w-24 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer mx-auto" />
              <div className="h-3 w-16 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer mx-auto" />
            </div>
          </div>
        </div>

        {/* Price Range Selector Skeleton */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-4 w-20 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
          </div>
          <div className="relative h-40 bg-gray-100 dark:bg-neutral-900 rounded-lg">
            <div className="flex items-end justify-between h-full space-x-0.5 p-2">
              {Array.from({ length: 30 }).map((_, index) => (
                <div
                  key={index}
                  className="flex-1 bg-gray-200 dark:bg-neutral-800 rounded-t animate-shimmer"
                  style={{
                    height: `${Math.random() * 60 + 20}%`,
                    minHeight: '8px',
                    animationDelay: `${index * 0.05}s`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <div className="h-3 w-12 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
            <div className="h-3 w-12 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
            <div className="h-3 w-12 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-4 w-16 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
              <div className="h-10 bg-gray-100 dark:bg-neutral-900 rounded animate-shimmer" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-16 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
              <div className="h-10 bg-gray-100 dark:bg-neutral-900 rounded animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Multipliers Section Skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
          <div className="p-3 bg-gray-100 dark:bg-neutral-900 rounded-lg space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
                <div className="h-4 w-20 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-gray-100 dark:border-white/5 -mx-6" />

        {/* Deposit Amount Skeleton */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 dark:bg-neutral-800 rounded-full animate-shimmer" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
          </div>
          <div className="bg-gray-100 dark:bg-neutral-900 p-4 rounded-lg space-y-2">
            <div className="h-10 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
            <div className="flex justify-end gap-2">
              <div className="h-4 w-24 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
            </div>
          </div>
          <div className="flex justify-between py-3 px-4 border border-gray-200 dark:border-white/5 rounded-lg">
            <div className="h-4 w-24 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
            <div className="h-4 w-20 bg-gray-200 dark:bg-neutral-800 rounded animate-shimmer" />
          </div>
        </div>

        {/* Submit Button Skeleton */}
        <div className="h-12 bg-gray-200 dark:bg-neutral-800 rounded-lg animate-shimmer" />
      </CardContent>
    </Card>
  );
}
