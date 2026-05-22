'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const CATEGORIES = [
  { id: 'crypto', name: 'Crypto', icon: '₿' },
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'politics', name: 'Politics', icon: '🗳' },
  { id: 'finance', name: 'Finance', icon: '📈' },
  { id: 'technology', name: 'Technology', icon: '💡' },
];

const AMOUNTS = ['5 USDC', '15 USDC', '50 USDC'];

const MATCH = {
  home: { name: 'England', flag: '/uk flag.avif' },
  away: { name: 'USA', flag: '/us flag .avif' },
  odds: { home: '38%', draw: 'Draw 29%', away: '33%' },
};

export default function OnboardingPage() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [step, setStep] = useState<'categories' | 'trade' | 'modal'>('categories');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState(0);
  const [selectedAmount, setSelectedAmount] = useState('');
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');
  const [isMarketOrder, setIsMarketOrder] = useState(true);
  const [orderPrice, setOrderPrice] = useState('50');
  const [showOutcomeDropdown, setShowOutcomeDropdown] = useState(false);

  const OUTCOMES = [
    { name: MATCH.home.name, flag: MATCH.home.flag, yesPrice: 38, noPrice: 62 },
    { name: 'Draw', flag: null, yesPrice: 29, noPrice: 71 },
    { name: MATCH.away.name, flag: MATCH.away.flag, yesPrice: 33, noPrice: 67 },
  ];

  const currentOutcome = OUTCOMES[selectedOutcomeIndex];

  // Auto-scroll categories
  useEffect(() => {
    if (step !== 'categories') return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % CATEGORIES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [step]);

  const handleOddsClick = (outcomeIndex: number) => {
    setSelectedOutcomeIndex(outcomeIndex);
    setStep('modal');
  };

  const toWin = selectedAmount
    ? (parseFloat(selectedAmount) * 100 / (selectedSide === 'yes' ? currentOutcome.yesPrice : currentOutcome.noPrice)).toFixed(2)
    : '0';

  return (
    <div className="min-h-screen overflow-hidden relative flex flex-col font-sans"
      style={{ backgroundColor: '#1e3a5f' }}>

      {/* Skip */}
      <button
        onClick={() => router.push('/markets')}
        className="absolute top-4 right-4 z-20 text-xs font-medium"
        style={{ color: step === 'categories' ? '#888' : '#888' }}
      >
        Skip
      </button>

      {/* Progress bars */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-0.5 w-10 rounded-full"
            style={{ backgroundColor: i === (step === 'categories' ? 0 : 1) ? '#fff' : '#ffffff20' }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Category carousel */}
        {step === 'categories' && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col justify-between items-center py-24 px-6"
          >
            {/* Category carousel */}
            <div
              className="relative h-64 w-full max-w-xs flex items-center justify-center overflow-hidden mt-8"
              style={{ maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)' }}
            >
              <motion.div
                className="absolute flex flex-col items-center gap-6"
                animate={{ y: `calc(50% - ${activeIndex * 3.5}rem - 1.75rem)` }}
                transition={{ type: 'spring', damping: 20, stiffness: 120 }}
              >
                {CATEGORIES.map((cat, idx) => {
                  const isActive = idx === activeIndex;
                  const isAdjacent = Math.abs(idx - activeIndex) === 1;
                  return (
                    <motion.div
                      key={cat.id}
                      animate={{
                        opacity: isActive ? 1 : isAdjacent ? 0.3 : 0.1,
                        scale: isActive ? 1.15 : 0.9,
                      }}
                      className="flex items-center gap-3 h-14"
                    >
                      {isActive && <span className="text-2xl">{cat.icon}</span>}
                      <span className={`text-2xl font-bold ${isActive ? 'text-white' : 'text-white/20'}`}>
                        {cat.name}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* CTA */}
            <div className="w-full max-w-sm flex flex-col items-center text-center pb-8">
              <p className="text-white/50 text-sm mb-2">Welcome to Predensity</p>
              <h2 className="text-2xl font-bold text-white mb-8">The home of what happens next</h2>
              <button
                onClick={() => setStep('trade')}
                className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-neutral-200 transition-colors"
              >
                Get Started
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Demo trade */}
        {step === 'trade' && (
          <motion.div
            key="trade"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-10"
          >
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-1">Trust your gut</h1>
              <p className="text-neutral-400 text-sm">Demo trade - no real money</p>
            </div>

            {/* Demo match card */}
            <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col items-center gap-1">
                  <Image src={MATCH.home.flag} alt={MATCH.home.name} width={40} height={40} className="rounded-sm object-cover w-10 h-7" />
                  <p className="text-xs font-medium text-gray-700">{MATCH.home.name}</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-red-500 text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded-full">LIVE 5'</span>
                  <p className="text-xl font-bold text-gray-900">0 : 0</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Image src={MATCH.away.flag} alt={MATCH.away.name} width={40} height={40} className="rounded-sm object-cover w-10 h-7" />
                  <p className="text-xs font-medium text-gray-700">{MATCH.away.name}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => handleOddsClick(MATCH.home.name)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded-lg text-xs font-semibold text-gray-700 transition-colors">
                  {MATCH.odds.home}
                </button>
                <button onClick={() => handleOddsClick('Draw')} className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded-lg text-xs font-semibold text-gray-700 transition-colors">
                  {MATCH.odds.draw}
                </button>
                <button onClick={() => handleOddsClick(MATCH.away.name)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded-lg text-xs font-semibold text-gray-700 transition-colors">
                  {MATCH.odds.away}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* STEP 3: Full-screen trading UI -- matches CLOB trading panel exactly */}
        {step === 'modal' && (
          <motion.div
            key="trading"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex-1 flex flex-col items-center justify-start pt-16 pb-10"
          >
            {/* Back button */}
            <button
              onClick={() => setStep('trade')}
              className="absolute top-12 left-4 text-white/60 hover:text-white text-sm flex items-center gap-1"
            >
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 rotate-90"><path d="M2 3.5l3 3 3-3"/></svg>
              Back
            </button>

            {/* Trading panel -- exact CLOB style */}
            <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 overflow-hidden mx-4">

              {/* Header: market context + outcome selector */}
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Image src={MATCH.home.flag} alt="" width={16} height={16} className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                  <span className="text-[11px] text-gray-500 truncate">{MATCH.home.name} vs {MATCH.away.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Image
                    src={selectedOutcome === MATCH.home.name ? MATCH.home.flag : selectedOutcome === MATCH.away.name ? MATCH.away.flag : '/predensity-logo.png'}
                    alt={selectedOutcome} width={28} height={20}
                    className="rounded-sm object-cover w-7 h-5 flex-shrink-0"
                  />
                  <span className="text-base font-bold text-gray-900">{selectedOutcome}</span>
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-gray-400"><path d="M2 3.5l3 3 3-3"/></svg>
                </div>
              </div>

              {/* Buy/Sell tabs + Market toggle */}
              <div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-200">
                <div className="flex gap-0">
                  {(['buy', 'sell'] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setSelectedSide(side === 'buy' ? 'yes' : 'no')}
                      className={`px-3 py-1.5 text-[13px] font-semibold border-b-2 transition-colors capitalize ${
                        (side === 'buy' && selectedSide === 'yes') || (side === 'sell' && selectedSide === 'no')
                          ? 'text-gray-900 border-gray-900'
                          : 'text-gray-500 border-transparent'
                      }`}
                    >
                      {side.charAt(0).toUpperCase() + side.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900">
                  Market
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5"><path d="M2 3.5l3 3 3-3"/></svg>
                </div>
              </div>

              {/* YES / NO buttons */}
              <div className="grid grid-cols-2 gap-2 px-4 py-3.5">
                <button
                  onClick={() => setSelectedSide('yes')}
                  className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                    selectedSide === 'yes'
                      ? 'bg-[#3fdc8c]/20 border border-[#3fdc8c]/30 text-gray-900'
                      : 'bg-white border border-[#3fdc8c]/30 text-[#3fdc8c] hover:bg-[#3fdc8c]/10'
                  }`}
                >
                  YES 38¢
                </button>
                <button
                  onClick={() => setSelectedSide('no')}
                  className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                    selectedSide === 'no'
                      ? 'bg-[#ff8c42]/15 border border-[#ff8c42]/30 text-gray-900'
                      : 'bg-white border border-[#ff8c42]/30 text-[#ff8c42] hover:bg-[#ff8c42]/10'
                  }`}
                >
                  NO 62¢
                </button>
              </div>

              {/* Amount input */}
              <div className="px-4 pb-3">
                <div className="text-xs text-gray-500 mb-2">Amount</div>
                <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 mb-2">
                  <input
                    type="number"
                    value={selectedAmount.replace(' USDC', '')}
                    onChange={(e) => setSelectedAmount(e.target.value + ' USDC')}
                    className="w-full bg-transparent text-3xl font-bold text-gray-900 outline-none"
                    placeholder="0"
                  />
                  <div className="text-xs text-gray-500 mt-1">Min. Amount is 1 USDC</div>
                </div>

                {/* Quick add buttons */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {['+1 USDC', '+5 USDC', '+10 USDC', '+100 USDC', 'MAX'].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setSelectedAmount(amt.replace('+', '').replace(' USDC', '') + ' USDC')}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-xs font-medium text-gray-900 hover:border-gray-400"
                    >
                      {amt}
                    </button>
                  ))}
                </div>
                <div className="text-right text-xs text-gray-500">
                  Available Balance: <span className="text-gray-900 font-semibold">0.00 USDC</span>
                </div>
              </div>

              <hr className="border-t border-gray-200 my-3" />

              {/* To Win */}
              <div className="px-4 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-gray-500">To Win:</div>
                    <div className="text-xs text-gray-500">Avg. Price: <span className="text-gray-900">38¢</span></div>
                  </div>
                  <span className="text-3xl font-extrabold text-[#3fdc8c]">
                    {toWin} <span className="text-base font-semibold">USDC</span>
                  </span>
                </div>
              </div>

              {/* Balance */}
              <div className="text-xs text-gray-400 mb-3 text-center">Balance: 0.00 USDC</div>

              {/* CTA */}
              <button
                onClick={() => router.push('/markets')}
                className="block w-[calc(100%-32px)] mx-4 mb-4 py-3.5 bg-black text-white rounded-2xl text-sm font-bold hover:bg-gray-800 transition-colors"
              >
                Log in / Sign up to Trade
              </button>
            </div>
          </motion.div>
        )}
    </div>
  );
}
