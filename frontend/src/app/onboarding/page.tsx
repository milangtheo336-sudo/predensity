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
  const [step, setStep] = useState<'categories' | 'trade'>('categories');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState('Brazil');
  const [selectedAmount, setSelectedAmount] = useState('5 USDC');
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');

  // Auto-scroll categories
  useEffect(() => {
    if (step !== 'categories') return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % CATEGORIES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [step]);

  const handleOddsClick = (outcome: string) => {
    setSelectedOutcome(outcome);
    setModalOpen(true);
  };

  const toWin = selectedSide === 'yes' ? '13.16' : '8.42';

  return (
    <div className="min-h-screen overflow-hidden relative flex flex-col font-sans"
      style={{ backgroundColor: step === 'categories' ? '#0a1628' : '#1a1a1a' }}>

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

      {/* Trading Modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-black/80 z-40"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed z-50 bg-white rounded-2xl w-[320px] max-w-[90vw] p-5 shadow-2xl"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            >
              {/* Close */}
              <button
                onClick={() => setModalOpen(false)}
                className="absolute -top-10 right-0 bg-white rounded-full w-8 h-8 flex items-center justify-center text-gray-600 font-bold shadow"
              >
                x
              </button>

              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src={selectedOutcome === MATCH.home.name ? MATCH.home.flag : selectedOutcome === MATCH.away.name ? MATCH.away.flag : '/predensity-logo.png'}
                  alt={selectedOutcome}
                  width={28} height={20}
                  className="rounded-sm object-cover w-7 h-5"
                />
                <div>
                  <p className="text-[10px] text-gray-400">{MATCH.home.name} vs {MATCH.away.name}</p>
                  <p className="text-sm font-bold text-gray-900 flex items-center gap-1">
                    {selectedOutcome}
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5 text-gray-400">
                      <path d="M2 3.5l3 3 3-3"/>
                    </svg>
                  </p>
                </div>
              </div>

              {/* Buy label */}
              <p className="text-sm font-semibold text-gray-900 mb-1">Buy</p>
              <div className="h-px bg-gray-200 mb-3" />

              {/* YES / NO */}
              <div className="flex gap-2 mb-5">
                <button
                  onClick={() => setSelectedSide('yes')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                    selectedSide === 'yes'
                      ? 'bg-[#3fdc8c] text-white'
                      : 'bg-[#3fdc8c]/10 text-[#3fdc8c] border border-[#3fdc8c]/30'
                  }`}
                >
                  YES 38%
                </button>
                <button
                  onClick={() => setSelectedSide('no')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                    selectedSide === 'no'
                      ? 'bg-red-400 text-white'
                      : 'bg-red-50 text-red-400 border border-red-200'
                  }`}
                >
                  NO 62%
                </button>
              </div>

              {/* Amount label */}
              <p className="text-[10px] text-gray-400 text-center mb-3">Set your trade amount:</p>

              {/* Amount chips */}
              <div className="flex gap-2 mb-5">
                {AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setSelectedAmount(amt)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      selectedAmount === amt
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>

              {/* To Win */}
              <div className="flex justify-between items-center mb-5">
                <span className="text-sm text-gray-500">To Win:</span>
                <span className="text-xl font-bold text-[#3fdc8c]">{toWin} <span className="text-sm font-normal text-[#3fdc8c]/70">USDC</span></span>
              </div>

              {/* Predict button */}
              <button
                onClick={() => { setModalOpen(false); router.push('/markets'); }}
                className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-neutral-800 transition-colors"
              >
                Predict
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
