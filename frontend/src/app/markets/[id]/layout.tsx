import { Metadata } from 'next';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const marketId = params.id;
  const isCrypto = marketId.toLowerCase().startsWith('crypto-');
  const symbol = isCrypto ? marketId.replace(/^crypto-/i, '').toUpperCase() : '';

  const title = isCrypto
    ? `Predict ${symbol} Price | Predensity`
    : `${marketId} | Predensity`;
  const description = isCrypto
    ? `Predict ${symbol} price and win USDC. Trade on Predensity prediction markets powered by Hedera.`
    : `Trade on this prediction market at Predensity.`;

  const ogParams = new URLSearchParams({
    type: 'market',
    title: isCrypto ? `Predict ${symbol} Price` : marketId,
    symbol: symbol || marketId.charAt(0).toUpperCase(),
  });
  const ogImageUrl = `https://predensity.com/api/og?${ogParams.toString()}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      siteName: 'Predensity',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
