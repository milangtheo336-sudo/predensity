import React from 'react';
import { MarketCard } from '@/lib/types/categories';
import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getAvatarPalette, cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ChallengeCardProps {
  market: MarketCard;
  onClick?: () => void;
}

const truncateAddrLocal = (addr: string) => {
  if (!addr) return '';
  if (addr.startsWith('managed:')) {
    const rest = addr.slice(8);
    return `${rest.slice(0, 6)}...${rest.slice(-4)}`;
  }
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

export function ChallengeCard({ market, onClick }: ChallengeCardProps) {
  const match = market.challengeData;
  if (!match) return null;

  const profiles = useConvexQuery(api.social.getProfilesByAddresses, { 
    addresses: [match.playerA, match.playerB] 
  });

  const profileA = profiles?.find((p: any) => p.userAddress.toLowerCase() === match.playerA.toLowerCase());
  const profileB = profiles?.find((p: any) => p.userAddress.toLowerCase() === match.playerB.toLowerCase());

  // Use team names if provided, otherwise fallback to truncated address
  const teamAName = match.playerAName || profileA?.displayName || truncateAddrLocal(match.playerA);
  const teamBName = match.playerBName || profileB?.displayName || truncateAddrLocal(match.playerB);

  // Fetch live bets if we want accurate multipliers/odds (or rely on pool fields)
  // For challenges, pools update frequently. We can use poolA and poolB from match.
  const poolA = Number(match.poolA || 0);
  const poolB = Number(match.poolB || 0);
  const total = poolA + poolB;

  let pctA = 50;
  let pctB = 50;
  let multA = '2.00x';
  let multB = '2.00x';

  if (total > 0) {
    pctA = Math.round((poolA / total) * 100);
    pctB = Math.round((poolB / total) * 100);
    multA = (total / poolA).toFixed(2) + 'x';
    multB = (total / poolB).toFixed(2) + 'x';
  } else if (match.baseCutBps) {
    // If empty, simulate 1.95x standard payouts
    const cut = match.baseCutBps / 10000;
    multA = (2 * (1 - cut)).toFixed(2) + 'x';
    multB = (2 * (1 - cut)).toFixed(2) + 'x';
  }

  // Format the date/time from timestamp
  const dateObj = new Date(match.startTime * 1000);
  const dateStr = format(dateObj, 'EEE, MMM d');
  const timeStr = format(dateObj, 'hh:mm');
  const ampmStr = format(dateObj, 'a').toLowerCase();

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative bg-[#111111] hover:bg-[#1a1a1a] rounded-xl p-5 pb-6 cursor-pointer transition-all',
        'border border-[#2a2a2a] hover:border-[#3a3a3a] shadow-lg flex flex-col'
      )}
    >
      {/* Top Section: Team Logos, Names, and Date/Time */}
      <div className="flex items-start justify-between w-full relative z-10 mb-4">
        
        {/* Player A Header */}
        <div className="flex flex-col items-center flex-1">
          <div className="w-14 h-14 mb-2 rounded-full overflow-hidden bg-[#1a1a1a]">
            {profileA?.avatar ? (
              <img src={profileA.avatar} alt="Avatar A" className="w-full h-full object-cover" />
            ) : (
              <img src="/predensity-icon.png" alt="Predensity Logo" className="w-full h-full object-contain p-2 opacity-80" />
            )}
          </div>
          <h3 className="text-white font-semibold text-[15px] text-center line-clamp-1 w-full px-1">
            {teamAName}
          </h3>
        </div>

        {/* Center Info: Date & Time */}
        <div className="flex flex-col items-center justify-start flex-shrink-0 mx-2 pt-1">
          <span className="text-gray-400 text-xs font-medium">{dateStr}</span>
          <span className="text-white text-2xl font-bold tracking-tight leading-none mt-1">{timeStr}</span>
          <span className="text-gray-400 text-[11px] font-medium mt-1">{ampmStr}</span>
        </div>

        {/* Player B Header */}
        <div className="flex flex-col items-center flex-1">
          <div className="w-14 h-14 mb-2 rounded-full overflow-hidden bg-[#1a1a1a]">
            {profileB?.avatar ? (
              <img src={profileB.avatar} alt="Avatar B" className="w-full h-full object-cover" />
            ) : (
              <img src="/predensity-icon.png" alt="Predensity Logo" className="w-full h-full object-contain p-2 opacity-80" />
            )}
          </div>
          <h3 className="text-white font-semibold text-[15px] text-center line-clamp-1 w-full px-1">
            {teamBName}
          </h3>
        </div>
      </div>

      {/* Bottom Section: Percentages, Multipliers, and Game Logo */}
      <div className="relative flex items-start justify-between w-full">
        
        {/* Player A Stats */}
        <div className="flex flex-col items-center w-[42%]">
          <div className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg py-3 flex flex-col items-center transition-colors group-hover:border-[#3a3a3a]">
            <span className="text-white font-bold text-base">{pctA}%</span>
          </div>
          <span className="text-blue-400 text-[13px] mt-2 font-medium">{multA}</span>
        </div>

        {/* Game Logo in exact center between the boxes */}
        <div className="absolute left-1/2 top-3 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center z-10">
          {market.imageUrl ? (
            <img src={market.imageUrl} alt="Game Logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[#a08544] font-bold text-sm">VS</span>
          )}
        </div>

        {/* Player B Stats */}
        <div className="flex flex-col items-center w-[42%]">
          <div className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg py-3 flex flex-col items-center transition-colors group-hover:border-[#3a3a3a]">
            <span className="text-white font-bold text-base">{pctB}%</span>
          </div>
          <span className="text-blue-400 text-[13px] mt-2 font-medium">{multB}</span>
        </div>

      </div>
    </div>
  );
}
