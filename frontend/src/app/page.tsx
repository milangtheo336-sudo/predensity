import dynamic from 'next/dynamic';
import MarketsSkeleton from './markets-skeleton';

// Load MarketsClient client-only — avoids SSR errors from browser-API dependencies
// Server always renders the full-page skeleton immediately (no "Loading..." text)
const MarketsClient = dynamic(() => import('./markets-client'), {
  ssr: false,
  loading: () => <MarketsSkeleton />,
});

export default function MarketsPage() {
  return (
    <MarketsClient
      initialEvents={[]}
      initialCryptoMarkets={[]}
      initialClobMarkets={[]}
    />
  );
}
