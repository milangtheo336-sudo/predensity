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
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl"
      >
        {/* Green tick */}
        <div className="flex justify-center pt-6 pb-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
            className="w-10 h-10 bg-[#2ecc71] rounded-full flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        </div>

        {/* Title */}
        <p className="text-center text-base font-bold text-gray-900 pb-4">{resultLabel}</p>

        {/* Score */}
        <div className="flex items-center justify-center gap-6 pb-5">
          <div className="flex flex-col items-center gap-1">
            <Image src={match.home.flag} alt={match.home.name} width={40} height={28} className="rounded object-cover w-10 h-7" />
            <p className="text-xs text-gray-500">{match.home.name}</p>
          </div>
          <p className="text-xl font-extrabold text-gray-900">{score.home} : {score.away}</p>
          <div className="flex flex-col items-center gap-1">
            <Image src={match.away.flag} alt={match.away.name} width={40} height={28} className="rounded object-cover w-10 h-7" />
            <p className="text-xs text-gray-500">{match.away.name}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 mx-5" />

        {/* Bet summary */}
        <div className="px-5 py-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Demo bet:</span>
            <span className="text-sm font-semibold text-gray-900">{selectedAmount} USDC</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Winning:</span>
            <span className="text-xl font-extrabold text-[#2ecc71]">
              {winnings} <span className="text-sm font-semibold text-gray-400">USDC</span>
            </span>
          </div>
        </div>

        {/* Button */}
        <div className="px-5 pb-5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onContinue}
            className="w-full bg-[#0d1b2a] text-white font-bold py-3.5 rounded-xl hover:bg-[#1a2f45] transition-colors text-sm"
          >
            Explore Markets
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
