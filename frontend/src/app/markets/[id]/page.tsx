'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Header } from '@/components/header';
import { PredictionCard } from '@/components/prediction-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Users, Trophy, DollarSign } from 'lucide-react';
import BoringAvatar from 'boring-avatars';
import { getAvatarPalette } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { ChallengePredictionCard } from '@/components/challenge-prediction-card';
import { MarketPageSkeleton } from '@/components/page-skeleton';

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

function truncateAddr(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function NotFoundView({ message, onBack }: { message: string; onBack: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto text-center flex flex-col items-center">
          <img src="/500 Internal Server Error-cuate.svg" alt="" className="w-64 h-64 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t.marketNotFound}</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
          <Button onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />{t.backToMarkets}</Button>
        </div>
      </main>
    </div>
  );
}

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = params.id as string;
  const isCryptoMarket = marketId.toLowerCase().startsWith('crypto-');
  const isChallenge = marketId.toLowerCase().startsWith('challenge-');
  const goBack = () => router.push('/markets');

  const cryptoMarket = useQuery(
    api.events.getCryptoMarket,
    isCryptoMarket ? { marketId } : "skip"
  );

  const challengeMatch = useQuery(
    api.challenges.getChallengeMatch,
    isChallenge ? { matchId: marketId } : "skip"
  );

  // Crypto: use DPM prediction card
  if (isCryptoMarket) {
    if (cryptoMarket === undefined) return <MarketPageSkeleton />;
    if (cryptoMarket === null) return <NotFoundView message="This crypto market doesn't exist." onBack={goBack} />;
    return (
      <div className="min-h-screen bg-white dark:bg-black">
        <Header>
          <PredictionCard
            tokenSymbol={cryptoMarket.tokenSymbol}
            tokenName={cryptoMarket.tokenName}
            tokenLogo={cryptoMarket.imageUrl}
            priceDecimals={cryptoMarket.priceDecimals}
            contractId={cryptoMarket.contractId}
          />
        </Header>
      </div>
    );
  }

  // Challenge match view
  if (isChallenge) {
    if (challengeMatch === undefined) return <MarketPageSkeleton />;
    if (challengeMatch === null) return <NotFoundView message="This challenge match doesn't exist." onBack={goBack} />;

    return (
      <div className="min-h-screen bg-white dark:bg-black">
        <Header>
          <ChallengePredictionCard challengeMatch={challengeMatch} />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-10">
              {/* Optional extra space or widgets could go here in the future, for now ChallengePredictionCard handles everything */}
            </div>
          </div>
        </Header>
      </div>
    );
  }

  // Non-crypto, non-challenge: show not found
  return <NotFoundView message="This market doesn't exist." onBack={goBack} />;
}
