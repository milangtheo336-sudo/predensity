'use client';

/**
 * Reusable page-level skeleton — shown by Next.js loading.tsx files
 * while a page is streaming in. Matches the app's header + content layout
 * so there's no layout shift when the real page arrives.
 */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      {/* Header skeleton */}
      <div className="h-16 border-b border-gray-100 dark:border-neutral-900 bg-white dark:bg-black flex items-center px-6 gap-4 flex-shrink-0">
        <div className="w-28 h-6 rounded-md bg-gray-200 dark:bg-neutral-800 animate-pulse" />
        <div className="flex-1" />
        <div className="w-20 h-8 rounded-full bg-gray-200 dark:bg-neutral-800 animate-pulse" />
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-neutral-800 animate-pulse" />
      </div>

      {/* Content skeleton */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        {/* Title */}
        <div className="w-48 h-7 rounded-lg bg-gray-200 dark:bg-neutral-800 animate-pulse mb-6" />

        {/* Rows */}
        <div className="space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 p-5 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="w-32 h-3 rounded bg-gray-200 dark:bg-neutral-700 mb-3" />
              <div className="w-full h-4 rounded bg-gray-200 dark:bg-neutral-700 mb-2" />
              <div className="w-3/4 h-4 rounded bg-gray-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/** Skeleton for the market detail page — wider layout with chart area */
export function MarketPageSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      {/* Header skeleton */}
      <div className="h-16 border-b border-gray-100 dark:border-neutral-900 bg-white dark:bg-black flex items-center px-6 gap-4 flex-shrink-0">
        <div className="w-28 h-6 rounded-md bg-gray-200 dark:bg-neutral-800 animate-pulse" />
        <div className="flex-1" />
        <div className="w-20 h-8 rounded-full bg-gray-200 dark:bg-neutral-800 animate-pulse" />
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-neutral-800 animate-pulse" />
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left — market info */}
          <div className="flex-1 space-y-4">
            {/* Hero image */}
            <div className="w-full h-48 rounded-2xl bg-gray-200 dark:bg-neutral-800 animate-pulse" />
            {/* Title */}
            <div className="w-3/4 h-6 rounded-lg bg-gray-200 dark:bg-neutral-800 animate-pulse" />
            <div className="w-1/2 h-4 rounded bg-gray-200 dark:bg-neutral-800 animate-pulse" />
            {/* Chart area */}
            <div className="w-full h-40 rounded-xl bg-gray-100 dark:bg-neutral-900 animate-pulse" />
            {/* Stats row */}
            <div className="flex gap-3">
              {[1,2,3].map(i => (
                <div key={i} className="flex-1 h-16 rounded-xl bg-gray-100 dark:bg-neutral-900 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          </div>

          {/* Right — bet panel */}
          <div className="w-full lg:w-80 space-y-3">
            <div className="w-full h-64 rounded-2xl bg-gray-100 dark:bg-neutral-900 animate-pulse" />
            <div className="w-full h-12 rounded-xl bg-gray-200 dark:bg-neutral-800 animate-pulse" />
          </div>
        </div>
      </main>
    </div>
  );
}

/** Skeleton for my-bets / portfolio page */
export function BetsPageSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      <div className="h-16 border-b border-gray-100 dark:border-neutral-900 bg-white dark:bg-black flex items-center px-6 gap-4 flex-shrink-0">
        <div className="w-28 h-6 rounded-md bg-gray-200 dark:bg-neutral-800 animate-pulse" />
        <div className="flex-1" />
        <div className="w-20 h-8 rounded-full bg-gray-200 dark:bg-neutral-800 animate-pulse" />
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-neutral-800 animate-pulse" />
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-5xl">
        {/* Stats bar */}
        <div className="flex gap-3 mb-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex-1 h-20 rounded-xl bg-gray-100 dark:bg-neutral-900 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        {/* Chart */}
        <div className="w-full h-32 rounded-xl bg-gray-100 dark:bg-neutral-900 animate-pulse mb-6" />
        {/* Bet rows */}
        <div className="rounded-2xl border border-gray-100 dark:border-neutral-800 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 dark:border-neutral-800 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-neutral-800 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-3/4 h-3 rounded bg-gray-200 dark:bg-neutral-800" />
                <div className="w-1/2 h-3 rounded bg-gray-200 dark:bg-neutral-700" />
              </div>
              <div className="w-16 h-4 rounded bg-gray-200 dark:bg-neutral-800" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/** Skeleton for simple text pages (privacy, terms) */
export function TextPageSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      <div className="h-16 border-b border-gray-100 dark:border-neutral-900 bg-white dark:bg-black flex items-center px-6 gap-4 flex-shrink-0">
        <div className="w-28 h-6 rounded-md bg-gray-200 dark:bg-neutral-800 animate-pulse" />
        <div className="flex-1" />
        <div className="w-20 h-8 rounded-full bg-gray-200 dark:bg-neutral-800 animate-pulse" />
      </div>
      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl space-y-4">
        <div className="w-48 h-8 rounded-lg bg-gray-200 dark:bg-neutral-800 animate-pulse mb-8" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`h-4 rounded bg-gray-200 dark:bg-neutral-800 animate-pulse`}
            style={{ width: `${70 + (i % 3) * 10}%`, animationDelay: `${i * 40}ms` }} />
        ))}
      </main>
    </div>
  );
}
