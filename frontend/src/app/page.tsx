import dynamic from 'next/dynamic';
import MarketsSkeleton from './markets-skeleton';

// Load MarketsClient client-only — avoids SSR errors from browser-API dependencies
const MarketsClient = dynamic(() => import('./markets-client'), {
  ssr: false,
  loading: () => <MarketsSkeleton />,
});

async function fetchInitialData() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return { events: [], cryptoMarkets: [], clobMarkets: [] };

  // Convex HTTP query endpoint — use the .cloud URL directly
  const base = convexUrl.endsWith('/') ? convexUrl.slice(0, -1) : convexUrl;

  try {
    const [eventsRes, cryptoRes, clobRes] = await Promise.allSettled([
      fetch(`${base}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'events:getEvents', args: {} }),
        next: { revalidate: 30 }, // cache for 30s
      }),
      fetch(`${base}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'events:getCryptoMarkets', args: {} }),
        next: { revalidate: 30 },
      }),
      fetch(`${base}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'clob:getClobMarkets', args: {} }),
        next: { revalidate: 30 },
      }),
    ]);

    const events =
      eventsRes.status === 'fulfilled' && eventsRes.value.ok
        ? (await eventsRes.value.json()).value ?? []
        : [];
    const cryptoMarkets =
      cryptoRes.status === 'fulfilled' && cryptoRes.value.ok
        ? (await cryptoRes.value.json()).value ?? []
        : [];
    const clobMarkets =
      clobRes.status === 'fulfilled' && clobRes.value.ok
        ? (await clobRes.value.json()).value ?? []
        : [];

    return { events, cryptoMarkets, clobMarkets };
  } catch {
    return { events: [], cryptoMarkets: [], clobMarkets: [] };
  }
}

export default async function MarketsPage() {
  const { events, cryptoMarkets, clobMarkets } = await fetchInitialData();

  return (
    <MarketsClient
      initialEvents={events}
      initialCryptoMarkets={cryptoMarkets}
      initialClobMarkets={clobMarkets}
    />
  );
}
