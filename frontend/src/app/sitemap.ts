import { MetadataRoute } from 'next';

const BASE_URL = 'https://www.predensity.com';

async function fetchMarkets() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return [];
  const base = convexUrl.endsWith('/') ? convexUrl.slice(0, -1) : convexUrl;

  try {
    const [eventsRes, clobRes] = await Promise.allSettled([
      fetch(`${base}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'events:getEvents', args: {} }),
        next: { revalidate: 3600 },
      }),
      fetch(`${base}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'clob:getClobMarkets', args: {} }),
        next: { revalidate: 3600 },
      }),
    ]);

    const events =
      eventsRes.status === 'fulfilled' && eventsRes.value.ok
        ? (await eventsRes.value.json()).value ?? []
        : [];
    const clobMarkets =
      clobRes.status === 'fulfilled' && clobRes.value.ok
        ? (await clobRes.value.json()).value ?? []
        : [];

    return [
      ...events.map((e: any) => e.eventId),
      ...clobMarkets.map((m: any) => m.marketId),
    ];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const marketIds = await fetchMarkets();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },

    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/cookies`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/markets/crypto-hbar`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/markets/crypto-btc`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/markets/crypto-eth`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/markets/crypto-doge`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/markets/crypto-sol`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/markets/crypto-bnb`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
  ];

  const marketRoutes: MetadataRoute.Sitemap = marketIds.map((id: string) => ({
    url: `${BASE_URL}/markets/${id}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...marketRoutes];
}
