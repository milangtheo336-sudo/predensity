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

  // Calculate winnings
  const betAmount = parseFloat(selectedAmount) || 0;
  const winnings = (betAmount * 100 / oddPrice).toFixed(2);

  // Determine question based on outcome and side
  const getQuestion = () => {
    if (selectedOutcome === 'Draw') {
      return selectedSide === 'yes'
        ? 'Will the match end in a Draw?'
        : 'Will there be a winner?';
    }
    return selectedSide === 'yes'
      ? `Will ${selectedOutcome} win?`
      : `Will ${selectedOutcome} NOT win?`;
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

  // Timer logic
  useEffect(() => {
    if (!gameStarted) {
      setGameStarted(true);
      return;
    }

    if (timeRemaining <= 0) {
      onGameEnd(true, winnings);
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, timeRemaining, onGameEnd, winnings]);

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

      <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl mb-6 relative">
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
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <p className="text-4xl font-bold text-gray-900">{formatTime()}'"'"'</p>
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

        <div className="mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.5 }}
            className="h-1 bg-gradient-to-r from-[#3fdc8c] to-[#2fbf70] rounded-full"
          />
        </div>

        <div className="text-center">
          <p className="text-sm font-bold text-gray-900">
            Your prediction: <span className="text-[#3fdc8c]">{getOutcomeDisplay()}</span>
          </p>
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
