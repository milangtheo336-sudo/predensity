'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Header } from '@/components/header';
import { PredictionCard } from '@/components/prediction-card';
import { PoliticsPredictionCard } from '@/components/politics-prediction-card';
import { PoliticsPredictionType } from '@/lib/types/categories';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

// Map prediction type string from Convex to the enum value
function parsePredictionType(predType?: string): PoliticsPredictionType {
  const mapping: Record<string, PoliticsPredictionType> = {
    '0': PoliticsPredictionType.VOTE_PERCENTAGE,
    '1': PoliticsPredictionType.ELECTORAL_VOTES,
    '2': PoliticsPredictionType.APPROVAL_RATING,
    '3': PoliticsPredictionType.POLL_AVERAGE,
    '4': PoliticsPredictionType.VOTER_TURNOUT,
    '5': PoliticsPredictionType.SEAT_COUNT,
    '6': PoliticsPredictionType.DELEGATE_COUNT,
  };
  return mapping[predType || '0'] ?? PoliticsPredictionType.VOTE_PERCENTAGE;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="mb-4 text-gray-400 hover:text-gray-900 dark:hover:text-white"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back to Markets
    </Button>
  );
}

function NotFoundView({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto text-center flex flex-col items-center">
          <img src="/500 Internal Server Error-cuate.svg" alt="" className="w-64 h-64 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Market Not Found</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
          <Button onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Markets
          </Button>
        </div>
      </main>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center">
      <img src="/predensity-logo.png" alt="Predensity" className="w-32 h-32 object-contain animate-pulse" />
      <span className="mt-4 text-gray-900 dark:text-white text-lg font-semibold tracking-wide">predensity</span>
    </div>
  );
}

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = params.id as string;

  // Parse market ID format
  const marketIdLower = marketId.toLowerCase();
  const isCryptoMarket = marketIdLower.startsWith('crypto-');

  // Load crypto market data from Convex (only if crypto)
  const cryptoMarket = useQuery(
    api.events.getCryptoMarket,
    isCryptoMarket ? { marketId } : "skip"
  );

  // Load event data from Convex (for politics/sports/tech -- eventId is the market ID)
  const eventData = useQuery(
    api.events.getEventByEventId,
    !isCryptoMarket ? { eventId: marketId } : "skip"
  );

  const goBack = () => router.push('/markets');

  // --- Crypto market flow ---
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

  // --- Event-based market flow (politics, sports, tech) ---
  if (eventData === undefined) return <LoadingView />;
  if (eventData === null) return <NotFoundView message="This event doesn't exist or hasn't been created yet." onBack={goBack} />;

  // Route to the correct component based on category
  if (eventData.category === 'politics') {
    return (
      <div className="min-h-screen bg-white dark:bg-black">
        <Header />
        <PoliticsPredictionCard
          eventId={eventData.eventId}
          eventName={eventData.eventName}
          candidate={eventData.candidate || ''}
          predictionType={parsePredictionType(eventData.predictionType)}
          eventTimestamp={eventData.eventTimestamp}
          imageUrl={eventData.imageUrl}
          description={eventData.description}
          resolved={eventData.resolved}
        />
      </div>
    );
  }

  // Sports and Technology -- placeholder for now
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          <BackButton onClick={goBack} />
          <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{eventData.eventName}</h2>
            <p className="text-gray-500 dark:text-medium-gray mb-4">{eventData.description}</p>
            <p className="text-sm text-gray-500">
              Betting interface for {eventData.category} events is coming soon.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
