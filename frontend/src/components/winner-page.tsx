'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface WinnerPageProps {
  match: {
    home: { name: string; flag: string };
    away: { name: string; flag: string };
  };
  selectedOutcome: string;
  selectedSide: 'yes' | 'no';
  selectedAmount: string;
  winnings: string;
  onContinue: () => void;
}

function getFinalScore(
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
    if (selectedOutcome === 'Draw') return { home: 2, away: 1 };
    if (selectedOutcome === homeName) return { home: 1, away: 2 };
    if (selectedOutcome === awayName) return { home: 2, away: 1 };
  }
  return { home: 1, away: 1 };
}

export default function WinnerPage({
  match,
  selectedOutcome,
  selectedSide,
  selectedAmount,
  winnings,
  onContinue,
}: WinnerPageProps) {
  const score = getFinalScore(selectedOutcome, selectedSide, match.home.name, match.away.name);

  const resultLabel = selectedSide === 'yes'
    ? `${selectedOutcome} Won!`
    : selectedOutcome === 'Draw'
      ? 'No Draw — You Won!'
      : `${selectedOutcome} Lost — You Won!`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-10"
    >
      {/* Trophy / check */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 12, delay: 0.1 }}
        className="mb-5"
      >
        <div className="w-20 h-20 bg-[#3fdc8c] rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-extrabold text-white mb-5 text-center"
      >
        {resultLabel}
      </motion.h1>

      {/* Match result card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl mb-5"
      >
        {/* Flags + score */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col items-center gap-1.5">
            <Image src={match.home.flag} alt={match.home.name} width={48} height={32} className="rounded object-cover w-12 h-8" />
            <p className="text-xs font-semibold text-gray-700">{match.home.name}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full">FINAL</span>
            <p className="text-2xl font-extrabold text-gray-900">{score.home} : {score.away}</p>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Image src={match.away.flag} alt={match.away.name} width={48} height={32} className="rounded object-cover w-12 h-8" />
            <p className="text-xs font-semibold text-gray-700">{match.away.name}</p>
          </div>
        </div>

        {/* Bet summary */}
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Demo bet:</span>
            <span className="text-sm font-semibold text-gray-900">{selectedAmount} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Potential win:</span>
            <span className="text-base font-bold text-[#3fdc8c]">{winnings} USDC</span>
          </div>
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        whileTap={{ scale: 0.97 }}
        onClick={onContinue}
        className="w-full max-w-xs bg-white text-black font-bold py-4 rounded-xl hover:bg-neutral-100 transition-colors"
      >
        Explore Markets
      </motion.button>
    </motion.div>
  );
}
