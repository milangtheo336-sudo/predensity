'use client';

import React, { useState, useEffect } from 'react';
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

export default function GamePlay({
  match,
  selectedOutcome,
  selectedSide,
  selectedAmount,
  oddPrice,
  onGameEnd,
}: GamePlayProps) {
  const [timeRemaining, setTimeRemaining] = useState(90);
  const [gameStarted, setGameStarted] = useState(false);
  const [dynamicScore, setDynamicScore] = useState({ home: 0, away: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  const betAmount = parseFloat(selectedAmount) || 0;
  const winnings = (betAmount * 100 / oddPrice).toFixed(2);

  const getQuestion = () => {
    if (selectedOutcome === 'Draw') {
      return selectedSide === 'yes'
        ? 'Will the match end in a Draw?'
        : 'Will there be a winner?';
    }
    const teamName = selectedOutcome;
    return selectedSide === 'yes'
      ? `Will ${teamName} win the match?`
      : `Will ${teamName} NOT win the match?`;
  };

  const getOutcomeDisplay = () => {
    if (selectedSide === 'yes') {
      return `${selectedOutcome} WINS`;
    } else {
      if (selectedOutcome === 'Draw') {
        return 'NO DRAW';
      }
      return `${selectedOutcome} LOSES`;
    }
  };

  // Dynamic timer with varying intervals for flowing effect
  useEffect(() => {
    if (!gameStarted) {
      setGameStarted(true);
      return;
    }

    if (timeRemaining <= 0) {
      onGameEnd(true, winnings);
      return;
    }

    // Varying intervals for flowing effect: 5, 5, 10, 15
    const getInterval = () => {
      const elapsed = 90 - timeRemaining;
      if (elapsed < 10) return 500;      // Fast: 5ms * 100 for visual effect
      if (elapsed < 20) return 500;      // Fast
      if (elapsed < 45) return 1000;     // Normal: 1s
      if (elapsed < 75) return 1500;     // Slower
      return 2000;                        // Slowest near end
    };

    // Simulate score changes
    const simulateScore = () => {
      setIsAnimating(true);
      setTimeout(() => {
        const change = Math.random();
        if (change < 0.15) { // 15% chance of goal
          setDynamicScore(prev => {
            const isHomeGoal = Math.random() > 0.5;
            return {
              home: isHomeGoal ? prev.home + 1 : prev.home,
              away: !isHomeGoal ? prev.away + 1 : prev.away
            };
          });
        }
        setIsAnimating(false);
      }, 300);
    };

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 1;
        if (next % 5 === 0 && next > 0) {
          simulateScore();
        }
        return next;
      });
    }, getInterval());

    return () => clearInterval(timer);
  }, [gameStarted, timeRemaining, onGameEnd, winnings, selectedSide, selectedOutcome]);

  const formatTime = () => {
    if (timeRemaining === 0) return '90';
    const displayed = 90 - timeRemaining;
    return displayed.toString();
  };

  const progressPercentage = ((90 - timeRemaining) / 90) * 100;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pt-8 pb-10">
      <div className="text-center mb-8">
        <h2 className="text-white text-xl font-bold mb-4">
          {getQuestion()}
        </h2>
      </div>

      <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl mb-6 relative overflow-hidden">
        {/* Flowing gradient background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-[#3fdc8c]/5 via-[#3fdc8c]/10 to-[#3fdc8c]/5"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
        />
              
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col items-center gap-1">
              <Image
                src={match.home.flag}
                alt={match.home.name}
                width={40}
                height={40}
                className="rounded-sm object-cover w-10 h-7"
              />
              <p className="text-xs font-medium text-gray-700">{match.home.name}</p>
            </div>
      
            <div className="flex flex-col items-center gap-2">
              <motion.div
                key={formatTime()}
                initial={{ opacity: 0, scale: 0.8, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, type: 'spring' }}
                className="text-center"
              >
                <p className="text-4xl font-bold text-gray-900">{formatTime()}'</p>
              </motion.div>
              <p className="text-[10px] text-gray-500">of 90 mins</p>
            </div>
      
            <div className="flex flex-col items-center gap-1">
              <Image
                src={match.away.flag}
                alt={match.away.name}
                width={40}
                height={40}
                className="rounded-sm object-cover w-10 h-7"
              />
              <p className="text-xs font-medium text-gray-700">{match.away.name}</p>
            </div>
          </div>
      
          {/* Dynamic score display */}
          <motion.div
            className="text-center mb-6"
            animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <p className="text-3xl font-bold text-gray-900">
              {dynamicScore.home} : {dynamicScore.away}
            </p>
          </motion.div>
      
          {/* Flowing progress bar */}
          <div className="mb-4 relative h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#3fdc8c] via-[#5fef9e] to-[#3fdc8c]"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            {/* Flowing shine effect */}
            <motion.div
              className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{ left: ['-10%', `${progressPercentage}%`] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
      
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900">
              Your prediction: <span className="text-[#3fdc8c]">{getOutcomeDisplay()}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-xs bg-white/10 backdrop-blur rounded-xl p-4 text-white text-center">
        <p className="text-xs text-white/70 mb-1">Demo bet:</p>
        <p className="text-2xl font-bold mb-3">{selectedAmount} USDC</p>
        <p className="text-xs text-white/70 mb-1">Potential win:</p>
        <p className="text-2xl font-bold text-[#3fdc8c]">{winnings} USDC</p>
      </div>
    </div>
  );
}
