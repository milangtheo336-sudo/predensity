import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const marketId = params.id;
  const isCrypto = marketId.toLowerCase().startsWith('crypto-');
  const symbol = isCrypto ? marketId.replace(/^crypto-/i, '').toUpperCase() : '';

  const title = isCrypto
    ? `Predict ${symbol} Price | Predensity`
    : `${marketId} | Predensity`;
  const description = isCrypto
    ? `Predict ${symbol} price and win USDC. Trade on Predensity prediction markets powered by Arc.`
    : `Trade on this prediction market at Predensity.`;

  // Known crypto token logos for OG images
  const CRYPTO_LOGOS: Record<string, string> = {
    BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    HBAR: 'https://assets.coingecko.com/coins/images/3688/small/USDC .png',
    XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
    DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
    ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
    AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  };

  const ogParams = new URLSearchParams({
    type: 'market',
    title: isCrypto ? `Predict ${symbol} Price` : marketId,
    symbol: symbol || marketId.charAt(0).toUpperCase(),
    ...(isCrypto && CRYPTO_LOGOS[symbol] ? { image: CRYPTO_LOGOS[symbol] } : {}),
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
