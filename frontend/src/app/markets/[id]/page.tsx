'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Header } from '@/components/header';
import { PredictionCard } from '@/components/prediction-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Users, Trophy, DollarSign } from 'lucide-react';
import { MatchComments } from '@/components/match-comments';
import BoringAvatar from 'boring-avatars';
import { getAvatarPalette } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
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
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" onClick={goBack} size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {challengeMatch.gameTitle || 'Esports Challenge'}
              </h1>
            </div>

            {/* Match Details Card */}
            <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 p-6 mb-6 space-y-4">
              
              {/* Game Info */}
              <div className="grid grid-cols-2 gap-4">
                {challengeMatch.gameTagline && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Description</p>
                    <p className="text-gray-900 dark:text-white font-medium">{challengeMatch.gameTagline}</p>
                  </div>
                )}
                {challengeMatch.gameMode && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Mode</p>
                    <p className="text-gray-900 dark:text-white font-medium">{challengeMatch.gameMode}</p>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Timeline
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Starts:</span> {formatTime(challengeMatch.startTime)}
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Closes:</span> {formatTime(challengeMatch.expiryTime)}
                  </p>
                </div>
              </div>

              {/* Players */}
              <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Players
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <BoringAvatar
                      name={challengeMatch.playerA}
                      variant="beam"
                      size={32}
                      palette={getAvatarPalette(challengeMatch.playerA)}
                    />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Player A</p>
                      <p className="text-gray-900 dark:text-white font-medium">{truncateAddr(challengeMatch.playerA)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <BoringAvatar
                      name={challengeMatch.playerB}
                      variant="beam"
                      size={32}
                      palette={getAvatarPalette(challengeMatch.playerB)}
                    />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Player B</p>
                      <p className="text-gray-900 dark:text-white font-medium">{truncateAddr(challengeMatch.playerB)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee Structure */}
              <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Fee Structure
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Base Cut</p>
                    <p className="text-gray-900 dark:text-white font-medium">{challengeMatch.baseCutBps / 100}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Winner Bonus</p>
                    <p className="text-gray-900 dark:text-white font-medium">{challengeMatch.winnerBonusBps / 100}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Copy Fee</p>
                    <p className="text-gray-900 dark:text-white font-medium">{challengeMatch.copyFeeBps / 100}%</p>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium" 
                      style={{
                        backgroundColor: challengeMatch.status === 'active' ? '#10b98120' : '#ef444420',
                        color: challengeMatch.status === 'active' ? '#059669' : '#dc2626',
                      }}>
                  <Trophy className="w-3 h-3" />
                  {challengeMatch.status?.charAt(0).toUpperCase() + challengeMatch.status?.slice(1)}
                </span>
              </div>
            </div>

            {/* Comments Section */}
            <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 p-6">
              <MatchComments matchId={marketId} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Non-crypto, non-challenge: show not found
  return <NotFoundView message="This market doesn't exist." onBack={goBack} />;
}
