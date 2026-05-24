'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Header } from '@/components/header';
import { PredictionCard } from '@/components/prediction-card';
import { ClobPredictionCard } from '@/components/clob-prediction-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

function NotFoundView({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto text-center flex flex-col items-center">
          <img src="/500 Internal Server Error-cuate.svg" alt="" className="w-64 h-64 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Market Not Found</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
          <Button onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back to Markets</Button>
        </div>
      </main>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center">
      <img src="/predensity-logo.png" alt="Predensity" className="w-32 h-32 object-contain animate-pulse hidden dark:block" />
      <img src="/white the loading predensity logo.png" alt="Predensity" className="w-32 h-32 object-contain animate-pulse dark:hidden" />
      <span className="mt-4 text-gray-900 dark:text-white text-lg font-semibold tracking-wide">predensity</span>
    </div>
  );
}

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = params.id as string;

  const marketIdLower = marketId.toLowerCase();
  const isCryptoMarket = marketIdLower.startsWith('crypto-');

  // Crypto markets use the DPM prediction card
  const cryptoMarket = useQuery(
    api.events.getCryptoMarket,
    isCryptoMarket ? { marketId } : "skip"
  );

  // Non-crypto: check if it's a CLOB market first, then fall back to old events
  const clobMarket = useQuery(
    api.clob.getClobMarket,
    !isCryptoMarket ? { marketId } : "skip"
  );

  // Legacy event data (for old events not yet migrated to CLOB)
  const eventData = useQuery(
    api.events.getEventByEventId,
    !isCryptoMarket && clobMarket === null ? { eventId: marketId } : "skip"
  );

  const goBack = () => router.push('/markets');

  // --- Crypto market ---
  if (isCryptoMarket) {
    if (cryptoMarket === undefined) return <LoadingView />;
    if (cryptoMarket === null) return <NotFoundView message="This crypto market doesn't exist." onBack={goBack} />;
    return (
      <div className="min-h-screen bg-white dark:bg-black">
        <Header />
        <PredictionCard
          tokenSymbol={cryptoMarket.tokenSymbol}
          tokenName={cryptoMarket.tokenName}
          tokenLogo={cryptoMarket.imageUrl}
          priceDecimals={cryptoMarket.priceDecimals}
          contractId={cryptoMarket.contractId}
        />
      </div>
    );
  }

  // --- CLOB market (politics, sports, tech, international) ---
  if (clobMarket === undefined) return <LoadingView />;
  if (clobMarket !== null) {
    return (
      <div className="min-h-screen bg-white dark:bg-black">
        <Header />
        <ClobPredictionCard marketId={marketId} />
      </div>
    );
  }

  // --- Legacy event (old system, fallback) ---
  if (eventData === undefined) return <LoadingView />;
  if (eventData === null) return <NotFoundView message="This market doesn't exist." onBack={goBack} />;

  // Legacy events render as CLOB card too (marketId = eventId)
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />
      <ClobPredictionCard marketId={marketId} />
    </div>
  );
}
