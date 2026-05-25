'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { ArrowLeft, Clock, Share2, Twitter, Link2, Check as CheckIcon, Trophy, Heart, Activity as ActivityIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBlockchainBalance } from '@/hooks/useBlockchainBalance';
import { getStakingCurrency, getChallengeMarketAddress } from '@/lib/contracts/contract-config';
import { ChallengeMarketABI } from '@/lib/contracts/challenge-market-abi';
const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [
      { "name": "_owner", "type": "address" },
      { "name": "_spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "_spender", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
import { parseUnits } from 'viem';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { useMagic } from '@/context/MagicContext';
import { useWalletUser } from '@/context/WalletUserContext';
import { getDIDToken } from '@/lib/magic';
import { useToast } from '@/components/ui/useToast';
import BoringAvatar from 'boring-avatars';
import { getAvatarPalette } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { ChallengeChart } from '@/components/challenge-chart';
import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MatchComments } from '@/components/match-comments';

function truncateAddrLocal(addr: string): string {
  if (!addr) return '';
  if (addr.startsWith('managed:')) {
    const rest = addr.slice(8);
    return `${rest.slice(0, 6)}...${rest.slice(-4)}`;
  }
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const ago = now - timestamp;
  const seconds = Math.floor(ago / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function ChallengeMarketInfoSection({ challengeMatch }: { challengeMatch: any }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'rules' | 'context'>('rules');
  const [expanded, setExpanded] = useState(false);

  const rulesText = `This market allows you to predict the winner between ${challengeMatch.playerAName || truncateAddrLocal(challengeMatch.playerA)} and ${challengeMatch.playerBName || truncateAddrLocal(challengeMatch.playerB)}. You select a player and a stake amount. If your selected player wins, you win proportionally based on bet weight. The host cut is deducted at bet placement. Payouts are distributed proportionally among winning bets.`;

  const contextText = challengeMatch.gameTagline || `Predict the winner of this 1v1 challenge. All bets are placed through the Predensity treasury and settled on-chain.`;

  const displayText = activeTab === 'rules' ? rulesText : contextText;
  const isLong = displayText.length > 200;
  const truncatedText = isLong && !expanded ? displayText.slice(0, 200) + '...' : displayText;

  return (
    <div>
      <div className="flex items-center gap-6">
        <button
          onClick={() => { setActiveTab('rules'); setExpanded(false); }}
          className={`pb-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'rules'
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          {t.rules}
        </button>
        <button
          onClick={() => { setActiveTab('context'); setExpanded(false); }}
          className={`pb-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'context'
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          {t.marketContext}
        </button>
      </div>
      <div className="pt-4 pb-3">
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {truncatedText}
          {isLong && !expanded && (
            <button onClick={() => setExpanded(true)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-1 text-sm">
              {t.showMore}
            </button>
          )}
        </p>
        {expanded && activeTab === 'rules' && (
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
            <span>Resolved on-chain</span>
          </div>
        )}
        {expanded && (
          <button onClick={() => setExpanded(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-sm mt-2 block">
            {t.showLess}
          </button>
        )}
      </div>
    </div>
  );
}

function ChallengeActivitySection({ challengeMatch }: { challengeMatch: any }) {
  const [activeTab, setActiveTab] = useState<'ideas' | 'positions' | 'activity'>('ideas');

  const convexBets = useConvexQuery(api.challenges.getChallengeBetsByMatch, { matchId: challengeMatch.matchId });

  const allBets = useMemo(() => {
    if (!convexBets) return [];
    return [...convexBets].sort((a, b) => b.createdAt - a.createdAt);
  }, [convexBets]);

  const [showAll, setShowAll] = useState(false);
  const displayBets = showAll ? allBets : allBets.slice(0, 10);

  return (
    <div className="mt-8 border-t border-gray-100 dark:border-white/[0.06] pt-6">
      <div className="flex items-center gap-6 border-b border-gray-100 dark:border-white/[0.06] mb-4">
        {[
          { key: 'ideas', label: 'Ideas' },
          { key: 'positions', label: `Positions (${allBets.length})` },
          { key: 'activity', label: 'Activity', icon: ActivityIcon },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-3 text-sm font-semibold transition-colors relative ${
                isActive
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              } flex items-center gap-1.5`}
            >
              {tab.icon && <tab.icon className="w-4 h-4" />}
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 dark:bg-white rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'ideas' && (
        <div className="pt-4">
          <MatchComments matchId={challengeMatch.matchId} className="mt-0" />
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="pt-4">
          {allBets.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No activity yet.</div>
          ) : (
            <div className="space-y-4">
              {displayBets.map((bet) => (
                <div key={bet._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BoringAvatar size={28} name={bet.bettor} variant="beam" colors={getAvatarPalette(bet.bettor)} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {truncateAddrLocal(bet.bettor)} <span className="text-gray-500 font-normal">predicted</span>
                      </p>
                      <p className="text-xs text-gray-400">{formatTimeAgo(bet.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {bet.side === 'playerA' ? truncateAddrLocal(challengeMatch.playerA) : truncateAddrLocal(challengeMatch.playerB)}
                    </p>
                    <p className="text-xs text-gray-500">${bet.amount.toFixed(2)}</p>
                  </div>
                </div>
              ))}
              {!showAll && allBets.length > 10 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-neutral-900 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Show all activity
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'positions' && (
        <div className="pt-4">
          {allBets.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No positions yet.</div>
          ) : (
            <div className="space-y-4">
              {displayBets.map((bet) => (
                <div key={bet._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BoringAvatar size={28} name={bet.bettor} variant="beam" colors={getAvatarPalette(bet.bettor)} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {truncateAddrLocal(bet.bettor)}
                      </p>
                      <p className="text-xs text-gray-400">{formatTimeAgo(bet.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {bet.side === 'playerA' ? truncateAddrLocal(challengeMatch.playerA) : truncateAddrLocal(challengeMatch.playerB)}
                    </p>
                    <p className="text-xs text-vibrant-purple">${bet.amount.toFixed(2)} stake</p>
                  </div>
                </div>
              ))}
              {!showAll && allBets.length > 10 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-neutral-900 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Show all positions
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChallengePredictionCard({ challengeMatch }: { challengeMatch: any }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [shareCopied, setShareCopied] = useState(false);
  const [betSide, setBetSide] = useState<'playerA' | 'playerB'>('playerA');
  const [betAmount, setBetAmount] = useState('');
  const [betting, setBetting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  
  const { address, isConnected } = useAccount();
  const { writeContractAsync: writeContract } = useWriteContract();
  const publicClient = usePublicClient();
  const { user } = useMagic();
  const { walletUser } = useWalletUser();
  const effectiveIssuer = user?.issuer ?? walletUser?.userId;
  
  const challengeAddress = getChallengeMarketAddress();
  const currency = getStakingCurrency();
  const { balance: platformBalance } = useBlockchainBalance(walletUser?.proxyWalletAddress || undefined);

  const formatTime = (ts: number) => new Date(ts * 1000).toLocaleString();
  
  const timeRemaining = useMemo(() => {
    const diff = challengeMatch.expiryTime - (Date.now() / 1000);
    if (diff <= 0) return 'Closed';
    const days = Math.floor(diff / 86400), hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, [challengeMatch.expiryTime]);

  const betAmountValue = Number.parseFloat(betAmount);
  const betAmountNumber = Number.isFinite(betAmountValue) ? betAmountValue : 0;
  const betPoolA = challengeMatch.poolA ?? 0;
  const betPoolB = challengeMatch.poolB ?? 0;
  const betTotalPool = betPoolA + betPoolB;

  const getEstimatedMultiplier = (side: 'playerA' | 'playerB') => {
    const sidePool = side === 'playerA' ? betPoolA : betPoolB;
    if (betAmountNumber <= 0) return 0;
    if (sidePool <= 0) return 1;
    return (betTotalPool + betAmountNumber) / (sidePool + betAmountNumber);
  };

  const getEstimatedPayout = (side: 'playerA' | 'playerB') => {
    const multiplier = getEstimatedMultiplier(side);
    if (multiplier === 0) return 0;
    return betAmountNumber * multiplier;
  };

  const handlePlaceBet = async () => {
    try {
      if (!isConnected) { toast({ title: 'Connect wallet', description: 'Connect a wallet to bet.' }); return; }
      if (!effectiveIssuer) { toast({ title: 'Sign in required', description: 'Sign in to bet.' }); return; }
      if (!challengeAddress) { toast({ title: 'Missing contract', description: 'Challenge market address not configured.' }); return; }
      if (!challengeMatch.onChainMatchId) { toast({ title: 'Missing match ID', description: 'Match is not ready on-chain.' }); return; }
      
      const amountNum = parseFloat(betAmount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        toast({ title: 'Invalid amount', description: 'Enter a valid amount.' });
        return;
      }

      setBetting(true);
      const tokenAmount = parseUnits(betAmount, currency.decimals);
      const sideEnum = betSide === 'playerA' ? 1 : 2;

      const allowance = (await publicClient!.readContract({
        address: currency.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, challengeAddress as `0x${string}`],
      })) as bigint;

      if (allowance < tokenAmount) {
        setIsApproving(true);
        const approvalAmount = parseUnits('1000000', currency.decimals);
        const approveHash = await writeContract({
          address: currency.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [challengeAddress as `0x${string}`, approvalAmount],
        });
        await publicClient!.waitForTransactionReceipt({ hash: approveHash });
        setIsApproving(false);
      }

      const txHash = await writeContract({
        address: challengeAddress as `0x${string}`,
        abi: ChallengeMarketABI,
        functionName: 'placeBet',
        args: [challengeMatch.onChainMatchId, sideEnum, tokenAmount, '0x0000000000000000000000000000000000000000'],
      });

      await publicClient!.waitForTransactionReceipt({ hash: txHash });

      const didToken = await getDIDToken();
      const response = await fetch('/api/challenge/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${didToken}` },
        body: JSON.stringify({
          userId: effectiveIssuer,
          matchId: challengeMatch.matchId,
          side: betSide,
          amount: amountNum,
          copiedFrom: null,
          transactionHash: txHash,
        }),
      });

      if (!response.ok) throw new Error('Failed to record bet on server');

      toast({ title: 'Bet placed', description: 'Your bet is confirmed.' });
      setBetAmount('');
    } catch (err: any) {
      toast({ title: 'Bet failed', description: err.message || 'Failed to place bet.' });
    } finally {
      setBetting(false);
      setIsApproving(false);
    }
  };

  const truncateAddr = (addr: string) => addr?.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white selection:bg-vibrant-purple/30" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Back nav */}
        <button
          onClick={() => window.history.back()}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center text-sm font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> {t.backToMarkets}
        </button>

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-10">
          
          {/* LEFT COLUMN TOP -- Header + Match Visual */}
          <div className="lg:col-span-8 space-y-6 order-1 lg:order-none">
            
            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-white dark:bg-black pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-gray-200 dark:border-[#2a2a2a]">
              <div className="flex gap-3 items-start pt-2 mb-3">
                <div className="w-10 h-10 rounded-xl border border-gray-200 dark:border-[#2a2a2a] flex-shrink-0 mt-0.5 bg-gray-100 dark:bg-neutral-900 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-[#2a2a2a] text-gray-600 dark:text-gray-300 text-xs font-medium px-2.5 py-0.5 rounded capitalize">
                      Esports
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {t.resolvesIn} {timeRemaining}
                    </span>
                  </div>
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white leading-tight truncate">
                    {challengeMatch.gameTitle || '1v1 Challenge'}
                  </h1>
                  <p className="text-xs text-gray-500 mt-0.5">{challengeMatch.gameTagline || 'Predict the winner of this match'}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                    {shareCopied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <Link2 className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(`Check out this match on Predensity: ${window.location.href}`)}`)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                    <Twitter className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Live Odds/Price bar (matches PredictionCard style) */}
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-gray-500">Current Odds</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {challengeMatch.playerAName || truncateAddr(challengeMatch.playerA)} {(betPoolA / ((betPoolA + betPoolB) || 1) * 100).toFixed(1)}%
                  <span className="mx-2 text-gray-400 font-normal">|</span>
                  {challengeMatch.playerBName || truncateAddr(challengeMatch.playerB)} {(betPoolB / ((betPoolA + betPoolB) || 1) * 100).toFixed(1)}%
                </span>
              </div>
              <span className="text-xs text-gray-400">
                Total Pool: {(betPoolA + betPoolB).toFixed(2)} {currency.symbol}
              </span>
            </div>

            {/* Challenge Chart -- full width, breathing room */}
            <div className="bg-white dark:bg-[#141414] rounded-xl overflow-hidden p-4 sm:p-5 border border-gray-200 dark:border-[#2a2a2a]">
              <ChallengeChart
                matchId={challengeMatch.matchId}
                playerA={challengeMatch.playerA}
                playerB={challengeMatch.playerB}
              />
            </div>
          </div>

          {/* TRADING PANEL */}
          <div className="order-2 lg:order-none lg:col-span-4 lg:row-span-2">
            <div className="lg:sticky lg:top-20 z-10 bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-lg p-5">
              
              <div className="mb-5">
                <span className="text-xs text-gray-500 font-medium block mb-3">Pick Winner</span>
                <div className="flex items-center bg-gray-100 dark:bg-neutral-900 p-1 rounded-lg border border-gray-200 dark:border-[#2a2a2a]">
                  <button
                    onClick={() => setBetSide('playerA')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${betSide === 'playerA' ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    Player A
                  </button>
                  <button
                    onClick={() => setBetSide('playerB')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${betSide === 'playerB' ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    Player B
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-5 border border-gray-200 dark:border-[#2a2a2a] rounded-lg overflow-hidden focus-within:border-vibrant-purple transition-colors bg-gray-50 dark:bg-neutral-900">
                <div className="flex items-center p-1">
                  <div className="flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={betAmount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) setBetAmount(v);
                      }}
                      className="w-full bg-transparent text-2xl font-bold text-gray-900 dark:text-white px-3 py-2.5 outline-none"
                    />
                  </div>
                  <div className="flex items-center pr-3 gap-2">
                    <span className="text-gray-500 font-medium text-sm">{currency.symbol}</span>
                  </div>
                </div>
              </div>
              
              {/* Quick Amounts */}
              <div className="flex gap-2 mb-5">
                {[10, 25, 50, 100].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBetAmount(String(amount))}
                    className="flex-1 py-1 rounded border border-gray-200 dark:border-neutral-800 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    ${amount}
                  </button>
                ))}
              </div>

              <div className="mt-2 p-3 bg-gray-100 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-[#2a2a2a] space-y-2 text-sm mb-5">
                <div className="flex justify-between font-medium">
                  <span className="text-gray-600 dark:text-gray-300">Est. Payout</span>
                  <span className="text-bright-green">
                    {betAmountNumber > 0 ? `${getEstimatedPayout(betSide).toFixed(2)} ${currency.symbol} (${getEstimatedMultiplier(betSide).toFixed(2)}x)` : `0.00 ${currency.symbol} (1.00x)`}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Host Cut</span>
                  <span className="text-gray-500">{challengeMatch.baseCutBps / 100}%</span>
                </div>
              </div>

              <Button
                onClick={handlePlaceBet}
                disabled={betting || isApproving || betAmountNumber <= 0 || challengeMatch.status !== 'open'}
                className="w-full py-6 text-base font-bold bg-vibrant-purple hover:bg-vibrant-purple/90 text-white shadow-[0_0_20px_rgba(110,86,207,0.3)] transition-all hover:shadow-[0_0_30px_rgba(110,86,207,0.5)] disabled:opacity-50"
              >
                {isApproving ? 'Approving USDC...' : betting ? 'Confirming...' : challengeMatch.status !== 'open' ? 'Market Closed' : 'Place Prediction'}
              </Button>
            </div>
          </div>

          {/* RULES + ACTIVITY -- order-3 on mobile (after trading panel), spans left column on desktop */}
          <div className="order-3 lg:order-none lg:col-span-8 space-y-6">
            <ChallengeMarketInfoSection challengeMatch={challengeMatch} />
            <ChallengeActivitySection challengeMatch={challengeMatch} />
          </div>
        </div>
      </div>
    </div>
  );
}
