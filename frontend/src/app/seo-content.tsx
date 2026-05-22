/**
 * Pure server component — no client providers, no hooks, no browser APIs.
 * Renders directly into the HTML stream before any client JS runs.
 * This is what crawlers and scrapers see.
 */
export default function SeoContent({ events, cryptoMarkets }: {
  events: any[];
  cryptoMarkets: any[];
}) {
  const allMarkets = [
    ...cryptoMarkets.map((m: any) => ({
      id: m.marketId,
      question: m.description || m.tokenName || m.tokenSymbol,
      category: 'Crypto',
    })),
    ...events.map((e: any) => ({
      id: e.eventId,
      question: e.eventName,
      category: e.category,
    })),
  ].slice(0, 50);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Predensity',
    url: 'https://www.predensity.com',
    description: 'Profit from bold, early, and accurate price forecasts. Predensity rewards boldness and sharpness of predictions — trade on crypto, politics, sports, and technology outcomes on Arc.',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: 'https://www.predensity.com/?q={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Active Prediction Markets on Predensity',
    url: 'https://www.predensity.com',
    numberOfItems: allMarkets.length,
    itemListElement: allMarkets.slice(0, 20).map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.question,
      url: `https://www.predensity.com/markets/${m.id}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      {/* Visually hidden but present in HTML for crawlers */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: 1, height: 1,
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -9999,
        }}
      >
        <h1>Predensity — Decentralized Prediction Market on Arc</h1>
        <p>
          Profit from bold, early, and accurate price forecasts.
          The platform rewards boldness and sharpness of predictions.
          Trade on crypto prices, politics, sports, and technology outcomes.
        </p>
        {allMarkets.length > 0 && (
          <nav aria-label="Active markets">
            <ul>
              {allMarkets.map((m) => (
                <li key={m.id}>
                  <a href={`/markets/${m.id}`}>
                    {m.question} — {m.category}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </>
  );
}
