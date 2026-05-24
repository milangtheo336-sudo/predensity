'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { useAccount } from 'wagmi';
import { api } from '../../../convex/_generated/api';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/useToast';
import { useContractWriteCompat, useReadContractCompat } from '@/hooks/useContractWrite';
import { ChallengeMarketABI } from '@/lib/contracts/challenge-market-abi';
import { getChallengeMarketAddress, getStakingCurrency, getStakingTokenAddress } from '@/lib/contracts/contract-config';
import { formatAddress, formatNumber } from '@/lib/utils';
import { useMagic } from '@/context/MagicContext';
import { getDIDToken } from '@/lib/magic';
import { SPORT_TAXONOMY } from '@/lib/types/sports';
import { parseUnits } from 'viem';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ERC20_ABI = [
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const;

const VIEW_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Yours', value: 'yours' },
  { label: 'Open', value: 'open' },
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
] as const;

type MatchSide = 'playerA' | 'playerB';
type ViewFilter = (typeof VIEW_TABS)[number]['value'];

export default function ChallengesPage() {
  const { toast } = useToast();
  const { isConnected, address } = useAccount();
  const { user } = useMagic();
  const { writeContract, watch } = useContractWriteCompat();
  const { readContract } = useReadContractCompat();

  const [activeSection, setActiveSection] = useState<'challenges' | 'tournaments'>('challenges');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const matches = useQuery(api.challenges.getChallengeMatches, { status: 'all', limit: 200 });
  
  // Get user's proxy wallet and following list (friends)
  const userProxy = useQuery(
    api.social.getProxyWalletByUserId,
    user?.issuer ? { userId: user.issuer } : 'skip'
  );

  const friends = useQuery(
    api.social.getFriendsWithProfiles,
    userProxy ? { userAddress: userProxy } : 'skip'
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    gameTitle: '',
    gameTagline: '',
    gameMode: '',
    platform: '',
    stakeFree: false,
    playerA: userProxy || '',
    playerB: '',
    startTime: '',
    expiryTime: '',
    baseCutBps: 200,
    winnerBonusBps: 300,
    copyFeeBps: 1200,
    league: '',
  });
  
  // Update playerA when userProxy is loaded
  React.useEffect(() => {
    if (userProxy && !createForm.playerA) {
      setCreateForm(prev => ({ ...prev, playerA: userProxy }));
    }
  }, [userProxy]);

  const [creating, setCreating] = useState(false);

  const [betOpen, setBetOpen] = useState(false);
  const [betMatch, setBetMatch] = useState<any>(null);
  const [betSide, setBetSide] = useState<MatchSide>('playerA');
  const [betAmount, setBetAmount] = useState('');
  const [betting, setBetting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [claimingBetId, setClaimingBetId] = useState<string | null>(null);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultMatch, setResultMatch] = useState<any>(null);
  const [resultWinner, setResultWinner] = useState<MatchSide>('playerA');
  const [submittingResult, setSubmittingResult] = useState(false);

  const currency = getStakingCurrency();
  const challengeAddress = getChallengeMarketAddress();
  const tokenAddress = getStakingTokenAddress();
  const userAddress = user?.publicAddress?.toLowerCase() || '';
  const userBets = useQuery(api.challenges.getChallengeBetsByUser, userAddress ? { bettor: userAddress } : 'skip');

  const sortedMatches = useMemo(() => {
    if (!matches) return [];
    return [...matches].sort((a, b) => b.createdAt - a.createdAt);
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (!sortedMatches.length) return [];
    const nowSec = Math.floor(Date.now() / 1000);
    return sortedMatches.filter((match) => {
      if (viewFilter === 'all') return true;
      if (viewFilter === 'yours') {
        const target = user?.publicAddress?.toLowerCase() || '';
        return [match.playerA, match.playerB, match.host].includes(target);
      }
      if (viewFilter === 'open') return match.status === 'open';
      if (viewFilter === 'ongoing') return match.status === 'open' && match.startTime <= nowSec;
      if (viewFilter === 'completed') return match.status !== 'open';
      return true;
    });
  }, [sortedMatches, viewFilter, user?.publicAddress]);

  const betsByMatch = useMemo(() => {
    const map = new Map<string, any[]>();
    if (!userBets) return map;
    for (const bet of userBets) {
      const arr = map.get(bet.matchId) || [];
      arr.push(bet);
      map.set(bet.matchId, arr);
    }
    return map;
  }, [userBets]);

  const waitForReceipt = (hash: string) =>
    new Promise<void>((resolve, reject) => {
      watch(hash, {
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      });
    });

  const openBetModal = (match: any, side: MatchSide) => {
    setBetMatch(match);
    setBetSide(side);
    setBetAmount('');
    setBetOpen(true);
  };

  const openResultModal = (match: any) => {
    setResultMatch(match);
    setResultWinner('playerA');
    setResultOpen(true);
  };

  const handleCreateMatch = async () => {
    try {
      if (!isConnected) {
        toast({ title: 'Connect wallet', description: 'Connect a wallet to create a match.' });
        return;
      }
      if (!user?.issuer) {
        toast({ title: 'Sign in required', description: 'Sign in to create a match.' });
        return;
      }
      if (!challengeAddress) {
        toast({ title: 'Missing contract', description: 'Challenge market address not configured.' });
        return;
      }
      if (createForm.baseCutBps + createForm.winnerBonusBps + 500 > 10000) {
        toast({ title: 'Invalid fees', description: 'Base cut + winner bonus + 5% platform fee must be <= 100%.' });
        return;
      }
      if (createForm.copyFeeBps < 1000 || createForm.copyFeeBps > 1500) {
        toast({ title: 'Invalid copy fee', description: 'Copy fee must be between 10% and 15% (1000–1500 bps).' });
        return;
      }

      const start = Math.floor(new Date(createForm.startTime).getTime() / 1000);
      const expiry = Math.floor(new Date(createForm.expiryTime).getTime() / 1000);
      if (!Number.isFinite(start) || !Number.isFinite(expiry)) {
        toast({ title: 'Invalid time', description: 'Please select valid start and expiry times.' });
        return;
      }

      setCreating(true);

      const txHash = await writeContract({
        address: challengeAddress,
        abi: ChallengeMarketABI,
        functionName: 'createMatch',
        args: [
          createForm.playerA,
          createForm.playerB,
          start,
          expiry,
          createForm.baseCutBps,
          createForm.winnerBonusBps,
          createForm.copyFeeBps,
        ],
      });

      watch(txHash, {
        onSuccess: async () => {
          try {
            const didToken = await getDIDToken();
            const response = await fetch('/api/challenge/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${didToken}`,
              },
              body: JSON.stringify({
                userId: user.issuer,
                playerA: createForm.playerA,
                playerB: createForm.playerB,
                startTime: start,
                expiryTime: expiry,
                baseCutBps: createForm.baseCutBps,
                winnerBonusBps: createForm.winnerBonusBps,
                copyFeeBps: createForm.copyFeeBps,
                gameTitle: createForm.gameTitle.trim() || undefined,
                gameTagline: createForm.gameTagline.trim() || undefined,
                gameMode: createForm.gameMode.trim() || undefined,
                platform: createForm.platform.trim() || undefined,
                stakeFree: createForm.stakeFree,
                league: createForm.league || undefined,
                transactionHash: txHash,
              }),
            });

            if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error || 'Failed to record match');
            }

            toast({ title: 'Match created', description: 'Your challenge is live.' });
            setCreateOpen(false);
          } catch (err: any) {
            toast({ title: 'Record failed', description: err.message || 'Failed to record match.' });
          } finally {
            setCreating(false);
          }
        },
        onError: (err) => {
          setCreating(false);
          toast({ title: 'Transaction failed', description: err?.message || 'Create match failed.' });
        },
      });
    } catch (err: any) {
      setCreating(false);
      toast({ title: 'Create failed', description: err.message || 'Failed to create match.' });
    }
  };

  const handlePlaceBet = async () => {
    try {
      if (!isConnected) {
        toast({ title: 'Connect wallet', description: 'Connect a wallet to place a bet.' });
        return;
      }
      if (!user?.issuer) {
        toast({ title: 'Sign in required', description: 'Sign in to place a bet.' });
        return;
      }
      if (!challengeAddress) {
        toast({ title: 'Missing contract', description: 'Challenge market address not configured.' });
        return;
      }
      if (!tokenAddress) {
        toast({ title: 'Missing token', description: 'Staking token address not configured.' });
        return;
      }
      if (!address) {
        toast({ title: 'Wallet not ready', description: 'Wallet address not available.' });
        return;
      }
      if (!betMatch?.onChainMatchId) {
        toast({ title: 'Missing match ID', description: 'Match is not ready on-chain.' });
        return;
      }
      const amountNum = parseFloat(betAmount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        toast({ title: 'Invalid amount', description: 'Enter a valid amount.' });
        return;
      }

      setBetting(true);
      const tokenAmount = parseUnits(betAmount, currency.decimals);
      const sideEnum = betSide === 'playerA' ? 1 : 2;

      const allowance = (await readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, challengeAddress],
      })) as bigint;

      if (allowance < tokenAmount) {
        setIsApproving(true);
        const approvalAmount = parseUnits('1000000', currency.decimals);
        const approveHash = await writeContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [challengeAddress, approvalAmount],
        });
        await waitForReceipt(approveHash);
        setIsApproving(false);
      }

      const txHash = await writeContract({
        address: challengeAddress,
        abi: ChallengeMarketABI,
        functionName: 'placeBet',
        args: [betMatch.onChainMatchId, sideEnum, tokenAmount, ZERO_ADDRESS],
      });

      watch(txHash, {
        onSuccess: async () => {
          try {
            const didToken = await getDIDToken();
            const response = await fetch('/api/challenge/bet', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${didToken}`,
              },
              body: JSON.stringify({
                userId: user.issuer,
                matchId: betMatch.matchId,
                side: betSide,
                amount: amountNum,
                copiedFrom: null,
                transactionHash: txHash,
              }),
            });

            if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error || 'Failed to record bet');
            }

            toast({ title: 'Bet placed', description: 'Your bet is confirmed.' });
            setBetOpen(false);
          } catch (err: any) {
            toast({ title: 'Record failed', description: err.message || 'Failed to record bet.' });
          } finally {
            setBetting(false);
          }
        },
        onError: (err) => {
          setBetting(false);
          setIsApproving(false);
          toast({ title: 'Transaction failed', description: err?.message || 'Bet failed.' });
        },
      });
    } catch (err: any) {
      setBetting(false);
      setIsApproving(false);
      toast({ title: 'Bet failed', description: err.message || 'Failed to place bet.' });
    }
  };

  const handleSubmitResult = async () => {
    try {
      if (!isConnected) {
        toast({ title: 'Connect wallet', description: 'Connect a wallet to submit a result.' });
        return;
      }
      if (!user?.issuer) {
        toast({ title: 'Sign in required', description: 'Sign in to submit a result.' });
        return;
      }
      if (!challengeAddress) {
        toast({ title: 'Missing contract', description: 'Challenge market address not configured.' });
        return;
      }
      if (!resultMatch?.onChainMatchId) {
        toast({ title: 'Missing match ID', description: 'Match is not ready on-chain.' });
        return;
      }

      setSubmittingResult(true);
      const winnerEnum = resultWinner === 'playerA' ? 1 : 2;

      const txHash = await writeContract({
        address: challengeAddress,
        abi: ChallengeMarketABI,
        functionName: 'submitResult',
        args: [resultMatch.onChainMatchId, winnerEnum],
      });

      watch(txHash, {
        onSuccess: async () => {
          try {
            const didToken = await getDIDToken();
            const response = await fetch('/api/challenge/submit-result', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${didToken}`,
              },
              body: JSON.stringify({
                userId: user.issuer,
                matchId: resultMatch.matchId,
                winner: resultWinner,
                transactionHash: txHash,
              }),
            });

            if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error || 'Failed to record result');
            }

            toast({ title: 'Result submitted', description: 'Result recorded on-chain.' });
            setResultOpen(false);
          } catch (err: any) {
            toast({ title: 'Record failed', description: err.message || 'Failed to record result.' });
          } finally {
            setSubmittingResult(false);
          }
        },
        onError: (err) => {
          setSubmittingResult(false);
          toast({ title: 'Transaction failed', description: err?.message || 'Submit failed.' });
        },
      });
    } catch (err: any) {
      setSubmittingResult(false);
      toast({ title: 'Submit failed', description: err.message || 'Failed to submit result.' });
    }
  };

  const handleClaimBet = async (bet: any) => {
    try {
      if (!isConnected) {
        toast({ title: 'Connect wallet', description: 'Connect a wallet to claim.' });
        return;
      }
      if (!user?.issuer) {
        toast({ title: 'Sign in required', description: 'Sign in to claim.' });
        return;
      }
      if (!challengeAddress) {
        toast({ title: 'Missing contract', description: 'Challenge market address not configured.' });
        return;
      }
      if (!bet.onChainBetId) {
        toast({ title: 'Missing bet ID', description: 'Bet is missing on-chain ID.' });
        return;
      }

      setClaimingBetId(bet.betId);
      const txHash = await writeContract({
        address: challengeAddress,
        abi: ChallengeMarketABI,
        functionName: 'claimBet',
        args: [bet.onChainBetId],
      });

      watch(txHash, {
        onSuccess: async () => {
          try {
            const didToken = await getDIDToken();
            const response = await fetch('/api/challenge/claim', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${didToken}`,
              },
              body: JSON.stringify({
                userId: user.issuer,
                betId: bet.betId,
                onChainBetId: bet.onChainBetId,
                transactionHash: txHash,
              }),
            });
            if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error || 'Failed to record claim');
            }
            toast({ title: 'Claimed', description: 'Winnings sent to your wallet.' });
          } catch (err: any) {
            toast({ title: 'Record failed', description: err.message || 'Failed to record claim.' });
          } finally {
            setClaimingBetId(null);
          }
        },
        onError: (err) => {
          setClaimingBetId(null);
          toast({ title: 'Claim failed', description: err?.message || 'Claim failed.' });
        },
      });
    } catch (err: any) {
      setClaimingBetId(null);
      toast({ title: 'Claim failed', description: err.message || 'Failed to claim.' });
    }
  };

  const betAmountValue = Number.parseFloat(betAmount);
  const betAmountNumber = Number.isFinite(betAmountValue) ? betAmountValue : 0;
  const betPoolA = betMatch?.poolA ?? 0;
  const betPoolB = betMatch?.poolB ?? 0;
  const betTotalPool = betPoolA + betPoolB;

  const getEstimatedMultiplier = (side: MatchSide) => {
    const sidePool = side === 'playerA' ? betPoolA : betPoolB;
    if (betAmountNumber <= 0) return 0;
    if (sidePool <= 0) return 1;
    return (betTotalPool + betAmountNumber) / (sidePool + betAmountNumber);
  };

  const getEstimatedPayout = (side: MatchSide) => {
    const multiplier = getEstimatedMultiplier(side);
    if (multiplier === 0) return 0;
    return betAmountNumber * multiplier;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create 1v1 Match</h1>
          <p className="text-gray-500">Set up an esports challenge with parimutuel pools.</p>
        </div>

        <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-gray-200 dark:border-neutral-800 p-6">
          <div className="space-y-6">
            {/* Game Section */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Game Details</h2>
              
              {/* Game/League selector dropdown */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Select Game</label>
                <select 
                  value={createForm.league} 
                  onChange={(e) => setCreateForm({ ...createForm, league: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white"
                >
                  <option value="">-- Select a game --</option>
                  {SPORT_TAXONOMY
                    .filter(sport => sport.id === 'esports')
                    .flatMap(sport => sport.leagues)
                    .map(league => (
                      <option key={league.id} value={league.id}>
                        {league.label}
                      </option>
                    ))}
                </select>
              </div>

              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white" placeholder="Game title (e.g., Free Fire)" value={createForm.gameTitle} onChange={(e) => setCreateForm({ ...createForm, gameTitle: e.target.value })} />
              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white" placeholder="Tagline (e.g., Let's see the best player)" value={createForm.gameTagline} onChange={(e) => setCreateForm({ ...createForm, gameTagline: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white" placeholder="Winner mode (e.g., Most Kills)" value={createForm.gameMode} onChange={(e) => setCreateForm({ ...createForm, gameMode: e.target.value })} />
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white" placeholder="Platform (e.g., Mobile)" value={createForm.platform} onChange={(e) => setCreateForm({ ...createForm, platform: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input type="checkbox" checked={createForm.stakeFree} onChange={(e) => setCreateForm({ ...createForm, stakeFree: e.target.checked })} className="rounded" />
                Stake-free challenge
              </label>
            </div>

            {/* Players Section */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Players</h2>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Your Address (Player A)</label>
                <div className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white text-sm truncate">
                  {createForm.playerA || 'Loading...'}
                </div>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Invite Friend (Player B)</label>
                <select 
                  value={createForm.playerB} 
                  onChange={(e) => setCreateForm({ ...createForm, playerB: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white"
                >
                  <option value="">-- Select a friend --</option>
                  {friends && friends.length > 0 ? friends.map((friend) => (
                    <option key={friend.address} value={friend.address}>
                      {friend.displayName}
                    </option>
                  )) : <option disabled>No friends yet. Follow players to invite them!</option>}
                </select>
              </div>
            </div>

            {/* Timeline Section */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Timeline</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Match Starts</label>
                  <input type="datetime-local" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white text-sm" value={createForm.startTime} onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Expires (≥24h)</label>
                  <input type="datetime-local" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white text-sm" value={createForm.expiryTime} onChange={(e) => setCreateForm({ ...createForm, expiryTime: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Fee Structure Section */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Fee Structure</h2>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Host Cut (bps)</label>
                  <input type="number" min="0" max="10000" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white text-sm" value={createForm.baseCutBps} onChange={(e) => setCreateForm({ ...createForm, baseCutBps: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Winner Bonus (bps)</label>
                  <input type="number" min="0" max="10000" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white text-sm" value={createForm.winnerBonusBps} onChange={(e) => setCreateForm({ ...createForm, winnerBonusBps: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Copy Fee (bps)</label>
                  <input type="number" min="1000" max="1500" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white text-sm" value={createForm.copyFeeBps} onChange={(e) => setCreateForm({ ...createForm, copyFeeBps: Number(e.target.value) })} />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button className="w-full bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-semibold py-3" onClick={handleCreateMatch} disabled={creating}>
              {creating ? 'Creating Match...' : 'Create Match'}
            </Button>
          </div>
        </div>
      </div>

      {/* Bet Modal */}

      <Dialog open={betOpen} onOpenChange={setBetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pick the Winner</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${betSide === 'playerA' ? 'border-green-500 text-green-500' : 'border-gray-200 dark:border-neutral-800 text-gray-500'}`}
                onClick={() => setBetSide('playerA')}
              >
                Pick Player A
              </button>
              <button
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${betSide === 'playerB' ? 'border-green-500 text-green-500' : 'border-gray-200 dark:border-neutral-800 text-gray-500'}`}
                onClick={() => setBetSide('playerB')}
              >
                Pick Player B
              </button>
            </div>

            <input className="w-full px-3 py-2 rounded-lg border" placeholder={`Amount (${currency.symbol})`} value={betAmount} onChange={(e) => setBetAmount(e.target.value)} />
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((amount) => (
                <button
                  key={amount}
                  className="rounded-lg border border-gray-200 dark:border-neutral-800 px-2 py-1 text-xs text-gray-500"
                  onClick={() => setBetAmount(String(amount))}
                >
                  ${amount}
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 p-3 text-xs text-gray-500">
              <div>Estimated payout</div>
              <div className="text-lg font-semibold text-green-500">
                {betAmountNumber > 0 ? `${formatNumber(getEstimatedPayout(betSide), 2)} ${currency.symbol}` : `0 ${currency.symbol}`}
              </div>
              <div className="text-xs text-gray-400">
                Est. odds {betAmountNumber > 0 ? `${getEstimatedMultiplier(betSide).toFixed(2)}x` : '0.00x'}
              </div>
            </div>

            <Button className="w-full bg-vibrant-purple hover:bg-vibrant-purple/90" onClick={handlePlaceBet} disabled={betting || isApproving}>
              {isApproving ? 'Approving...' : betting ? 'Placing...' : 'Place Bet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit Result</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <select className="w-full px-3 py-2 rounded-lg border" value={resultWinner} onChange={(e) => setResultWinner(e.target.value as MatchSide)}>
              <option value="playerA">Player A wins</option>
              <option value="playerB">Player B wins</option>
            </select>
            <Button className="w-full bg-vibrant-purple hover:bg-vibrant-purple/90" onClick={handleSubmitResult} disabled={submittingResult}>
              {submittingResult ? 'Submitting...' : 'Submit Result'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
