import { Metadata } from 'next';

interface Props {
  params: { id: string };
  searchParams: { [key: string]: string | undefined };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const name = searchParams.name || 'Trader';
  const pnl = searchParams.pnl || '+$0.00';
  const predictions = searchParams.predictions || '0';
  const win = searchParams.win || '$0.00';
  const seed = searchParams.seed || params.id || 'default';

  const ogParams = new URLSearchParams({ name, pnl, predictions, win, seed });
  const ogImageUrl = `https://predensity.com/api/og?${ogParams.toString()}`;

  const title = `${name} on Predensity | P&L: ${pnl}`;
  const description = `${predictions} predictions | Biggest win: ${win} | Trade on prediction markets at predensity.com`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      siteName: 'Predensity',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
