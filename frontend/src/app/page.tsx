import { Suspense } from 'react';
import MarketsClient from './markets-client';
import MarketsSkeleton from './markets-skeleton';

// Don't block — shell renders immediately, data streams in via Suspense
export default function MarketsPage() {
  return (
    <Suspense fallback={<MarketsSkeleton />}>
      <MarketsClient
        initialEvents={[]}
        initialCryptoMarkets={[]}
        initialClobMarkets={[]}
      />
    </Suspense>
  );
}
