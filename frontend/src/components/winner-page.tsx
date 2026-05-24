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
  selectedAmount: string;
  winnings: string;
  onContinue: () => void;
}

export default function WinnerPage({
  match,
  selectedOutcome,
  selectedAmount,
  winnings,
  onContinue,
}: WinnerPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-10"
    >
      {/* Success checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 10 }}
        className="mb-6"
      >
        <div className="w-24 h-24 bg-[#3fdc8c] rounded-full flex items-center justify-center">
          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      </motion.div>

      {/* Victory text */}
      <h1 className="text-3xl font-bold text-white mb-2">
        {selectedOutcome} Won!
      </h1>

      {/* Match card result */}
      <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl mb-6">
        <div className="flex justify-between items-center mb-4">
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
          <div className="text-center">
            <p className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full mb-1">FINAL</p>
            <p className="text-xl font-bold text-gray-900">2 : 3</p>
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

        {/* Bet details */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between mb-3">
            <span className="text-sm text-gray-600">Demo bet:</span>
            <span className="font-semibold text-gray-900">{selectedAmount} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Winning:</span>
            <span className="font-bold text-[#3fdc8c] text-lg">{winnings} USDC</span>
          </div>
        </div>
      </div>

      {/* Continue button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onContinue}
        className="w-full max-w-xs bg-white text-black font-bold py-4 rounded-xl hover:bg-neutral-100 transition-colors"
      >
        Explore Markets
      </motion.button>
    </motion.div>
  );
}
