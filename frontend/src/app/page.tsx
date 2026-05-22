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

/**
 * Static HTML snapshot for crawlers and social preview bots.
 * Rendered server-side, invisible to users (the interactive MarketsClient
 * renders on top). Gives Googlebot and scrapers real content to index.
 */
function CrawlerSnapshot({ events, cryptoMarkets, clobMarkets }: {
  events: any[];
  cryptoMarkets: any[];
  clobMarkets: any[];
}) {
  const allMarkets = [
    ...cryptoMarkets.map((m: any) => ({
      id: m.marketId,
      question: m.description || m.tokenSymbol,
      category: 'Crypto',
    })),
    ...events.map((e: any) => ({
      id: e.eventId,
      question: e.eventName,
      category: e.category,
    })),
    ...clobMarkets.map((m: any) => ({
      id: m.marketId,
      question: m.question,
      category: m.category,
    })),
  ].slice(0, 50); // cap at 50 for page weight

  if (allMarkets.length === 0) return null;

  // JSON-LD structured data — powers Google rich results (sitelinks, breadcrumbs)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Predensity',
    url: 'https://predensity.com',
    description: 'Decentralized prediction market on Hedera. Trade on crypto, politics, sports, and technology outcomes.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://predensity.com/?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Active Prediction Markets',
    url: 'https://predensity.com',
    numberOfItems: allMarkets.length,
    itemListElement: allMarkets.slice(0, 20).map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.question,
      url: `https://predensity.com/markets/${m.id}`,
    })),
  };

  return (
    <>
      {/* JSON-LD structured data for Google rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      {/* Crawler-visible static snapshot — users never see this */}
      <div aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        <h1>Predensity - Decentralized Prediction Markets</h1>
        <p>Trade on future events across crypto, politics, sports, and technology. Powered by Hedera.</p>
        <ul>
          {allMarkets.map((m) => (
            <li key={m.id}>
              <a href={`/markets/${m.id}`}>{m.question} — {m.category}</a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default async function MarketsPage() {
  const { events, cryptoMarkets, clobMarkets } = await fetchInitialData();

  return (
    <>
      {/* Crawler-visible static snapshot — users never see this */}
      <CrawlerSnapshot
        events={events}
        cryptoMarkets={cryptoMarkets}
        clobMarkets={clobMarkets}
      />
      {/* Interactive client app */}
      <MarketsClient
        initialEvents={events}
        initialCryptoMarkets={cryptoMarkets}
        initialClobMarkets={clobMarkets}
      />
    </>
  );
}
