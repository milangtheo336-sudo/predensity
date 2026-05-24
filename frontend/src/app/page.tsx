import MarketsClient from './markets-client';

export default function MarketsPage() {
  return (
    <MarketsClient
      initialEvents={[]}
      initialCryptoMarkets={[]}
      initialClobMarkets={[]}
    />
  );
}
