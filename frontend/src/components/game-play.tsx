'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface GamePlayProps {
  match: {
    home: { name: string; flag: string };
    away: { name: string; flag: string };
  };
  selectedOutcome: string;
  selectedSide: 'yes' | 'no';
  selectedAmount: string;
  oddPrice: number;
  onGameEnd: (won: boolean, winnings: string) => void;
}

// Build a final score consistent with the user's prediction
function buildFinalScore(
  selectedOutcome: string,
  selectedSide: 'yes' | 'no',
  homeName: string,
  awayName: string
): { home: number; away: number } {
  const userWins = selectedSide === 'yes';

  if (userWins) {
    if (selectedOutcome === 'Draw') return { home: 1, away: 1 };
    if (selectedOutcome === homeName) return { home: 2, away: 1 };
    if (selectedOutcome === awayName) return { home: 1, away: 2 };
  } else {
    // user bet NO — outcome is the opposite
    if (selectedOutcome === 'Draw') {
      // NO draw means someone wins
      return { home: 2, away: 1 };
    }
    if (selectedOutcome === homeName) {
      // NO home win — away wins or draw; pick away win
      return { home: 1, away: 2 };
    }
    if (selectedOutcome === awayName) {
      return { home: 2, away: 1 };
    }
  }
  return { home: 1, away: 1 };
}

export default function GamePlay({
  match,
  selectedOutcome,
  selectedSide,
  selectedAmount,
  oddPrice,
  onGameEnd,
}: GamePlayProps) {
  const finalScore = useRef(
    buildFinalScore(selectedOutcome, selectedSide, match.home.name, match.away.name)
  );

  // minute displayed: 0 -> 90 over ~2 seconds real time
  // We tick every ~22ms to go from 0 to 90 in ~2s
  const [minute, setMinute] = useState(0);
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [goalFlash, setGoalFlash] = useState(false);

  const betAmount = parseFloat(selectedAmount) || 0;
  const winnings = (betAmount * 100 / oddPrice).toFixed(2);

  const getQuestion = () => {
    if (selectedOutcome === 'Draw') {
      return selectedSide === 'yes' ? 'Will the match end in a Draw?' : 'Will there be a winner?';
    }
    return selectedSide === 'yes'
      ? `Will ${selectedOutcome} win the match?`
      : `Will ${selectedOutcome} NOT win the match?`;
  };

  const getOutcomeDisplay = () => {
    if (selectedSide === 'yes') return `${selectedOutcome} WINS`;
    if (selectedOutcome === 'Draw') return 'NO DRAW';
    return `${selectedOutcome} LOSES`;
  };

  useEffect(() => {
    // Total duration: 2000ms for 90 minutes
    const TOTAL_MS = 5000;
    const TICK_MS = Math.floor(TOTAL_MS / 90); // ~22ms per minute

    const fs = finalScore.current;

    // Pre-plan when goals happen (spread them across the 90 mins)
    const goalMinutes: Array<{ minute: number; side: 'home' | 'away' }> = [];
    const totalGoals = fs.home + fs.away;
    const spread = Math.floor(90 / (totalGoals + 1));
    let homeLeft = fs.home;
    let awayLeft = fs.away;
    for (let i = 1; i <= totalGoals; i++) {
      const m = spread * i;
      const side = homeLeft > awayLeft ? 'home' : awayLeft > homeLeft ? 'away' : Math.random() > 0.5 ? 'home' : 'away';
      if (side === 'home') homeLeft--; else awayLeft--;
      goalMinutes.push({ minute: m, side });
    }

    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setMinute(current);

      const goal = goalMinutes.find(g => g.minute === current);
      if (goal) {
        setScore(prev => ({
          home: goal.side === 'home' ? prev.home + 1 : prev.home,
          away: goal.side === 'away' ? prev.away + 1 : prev.away,
        }));
        setGoalFlash(true);
        setTimeout(() => setGoalFlash(false), 400);
      }

      if (current >= 90) {
        clearInterval(interval);
        setTimeout(() => onGameEnd(true, winnings), 300);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = (minute / 90) * 100;

  return (
    <div className="flex-1 flex flex-col items-center justify-between px-6 pt-16 pb-10">
      {/* Question */}
      <div className="text-center mb-6">
        <p className="text-white text-lg font-semibold">{getQuestion()}</p>
      </div>

      {/* Score card */}
      <div className="w-full max-w-xs">
        <div className="flex items-center justify-between mb-3">
          {/* Home */}
          <div className="flex flex-col items-center gap-1.5 w-20">
            <Image
              src={match.home.flag}
              alt={match.home.name}
              width={48}
              height={32}
              className="rounded object-cover w-12 h-8"
            />
            <p className="text-xs font-semibold text-white">{match.home.name}</p>
          </div>

          {/* Center: time + score */}
          <div className="flex flex-col items-center gap-1">
            <motion.p
              key={minute}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.1 }}
              className="text-2xl font-bold text-white"
            >
              {minute}'
            </motion.p>
            <p className="text-[10px] text-white/60">of 90 mins</p>
            <motion.p
              animate={goalFlash ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
              className="text-3xl font-extrabold text-white mt-1"
            >
              {score.home} : {score.away}
            </motion.p>
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-1.5 w-20">
            <Image
              src={match.away.flag}
              alt={match.away.name}
              width={48}
              height={32}
              className="rounded object-cover w-12 h-8"
            />
            <p className="text-xs font-semibold text-white">{match.away.name}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-white rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.05, ease: 'linear' }}
          />
        </div>

        {/* Prediction label */}
        <p className="text-center text-sm font-semibold text-white">
          Your prediction:{' '}
          <span className="text-[#3fdc8c] font-extrabold">{getOutcomeDisplay()}</span>
        </p>
      </div>

      {/* Bet info */}
      <div className="w-full max-w-xs mt-6 space-y-2">
        <div className="flex justify-between items-center bg-white/10 rounded-xl px-4 py-3">
          <span className="text-sm text-white/70">Demo bet:</span>
          <span className="font-bold text-white">{selectedAmount} USDC</span>
        </div>
        <div className="flex justify-between items-center bg-white/10 rounded-xl px-4 py-3">
          <span className="text-sm text-white/70">Potential win:</span>
          <span className="font-bold text-[#3fdc8c]">{winnings} USDC</span>
        </div>
      </div>
    </div>
  );
}
