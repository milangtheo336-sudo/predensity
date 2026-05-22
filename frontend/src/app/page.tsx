import { fetchQuery } from 'convex/nextjs';
import { api } from '../../convex/_generated/api';
import MarketsClient from './markets-client';

// Revalidate every 60 seconds so fresh data is picked up server-side
export const revalidate = 60;

export default async function MarketsPage() {
  // Fetch all three datasets on the server — this data is in the HTML before JS loads
  const [initialEvents, initialCryptoMarkets, initialClobMarkets] = await Promise.all([
    fetchQuery(api.events.getEvents, {}).catch(() => []),
    fetchQuery(api.events.getCryptoMarkets, {}).catch(() => []),
    fetchQuery(api.clob.getClobMarkets, {}).catch(() => []),
  ]);

  return (
    <MarketsClient
      initialEvents={initialEvents}
      initialCryptoMarkets={initialCryptoMarkets}
      initialClobMarkets={initialClobMarkets}
    />
  );
}
