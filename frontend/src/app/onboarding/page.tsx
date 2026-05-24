'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import GamePlay from '@/components/game-play';
import WinnerPage from '@/components/winner-page';

const CATEGORIES = [
  { id: 'crypto', name: 'Crypto', icon: '₿' },
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'politics', name: 'Politics', icon: '🗳' },
  { id: 'finance', name: 'Finance', icon: '📈' },
  { id: 'tech', name: 'Tech & Science', icon: '🔬' },
  { id: 'elections', name: 'Elections', icon: '🗳' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'culture', name: 'Culture', icon: '🎭' },
  { id: 'climate', name: 'Climate', icon: '🌍' },
  { id: 'commodities', name: 'Commodities', icon: '�' },
  { id: 'companies', name: 'Companies', icon: '🏢' },
];

const MATCH = {
  home: { name: 'USA', flag: '/us flag .avif' },
  away: { name: 'UK', flag: '/uk flag.avif' },
  odds: { home: '38%', draw: 'Draw 29%', away: '33%' },
};

const OUTCOMES = [
  { name: 'USA', flag: '/us flag .avif', yesPrice: 38, noPrice: 62 },
  { name: 'Draw', flag: null, yesPrice: 29, noPrice: 71 },
  { name: 'UK', flag: '/uk flag.avif', yesPrice: 33, noPrice: 67 },
];

const AMOUNT_OPTIONS = ['5', '15', '50', '100'];

export default function OnboardingPage() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [step, setStep] = useState<'categories' | 'trade' | 'modal' | 'gameplay' | 'result'>('categories');
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState(0);
  const [selectedAmount, setSelectedAmount] = useState('5');
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');
  const [gameWinnings, setGameWinnings] = useState('0');
  const [showOutcomeDropdown, setShowOutcomeDropdown] = useState(false);

  const currentOutcome = OUTCOMES[selectedOutcomeIndex];

  useEffect(() => {
    if (step !== 'categories') return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % CATEGORIES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [step]);

  const handleOddsClick = (outcomeIndex: number) => {
    setSelectedOutcomeIndex(outcomeIndex);
    setStep('modal');
  };

  const handlePlaceTrade = () => setStep('gameplay');

  const handleGameEnd = (_won: boolean, winnings: string) => {
    setGameWinnings(winnings);
    setStep('result');
  };

  const toWin = (
    parseFloat(selectedAmount) * 100 /
    (selectedSide === 'yes' ? currentOutcome.yesPrice : currentOutcome.noPrice)
  ).toFixed(2);

  return (
    <div className="min-h-screen overflow-hidden relative flex flex-col font-sans bg-[#1e3a5f]">

      <button
        onClick={() => router.push('/markets')}
        className="absolute top-4 right-4 z-20 text-xs font-medium text-white/50 hover:text-white"
      >
        Skip
      </button>

      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {(['categories', 'trade', 'modal', 'gameplay'] as const).map((s, i) => {
          const stepOrder = ['categories', 'trade', 'modal', 'gameplay', 'result'];
          const currentIdx = stepOrder.indexOf(step);
          const isPast = i < currentIdx;
          const isActive = i === currentIdx;
          return (
            <div key={s} className="h-0.5 w-10 rounded-full overflow-hidden bg-white/20">
              {(isPast || isActive) && (
                <motion.div
                  className="h-full bg-white rounded-full"
                  initial={{ width: isPast ? '100%' : '0%' }}
                  animate={{ width: '100%' }}
                  transition={isActive ? { duration: step === 'categories' ? CATEGORIES.length * 1.4 : 2, ease: 'linear' } : { duration: 0 }}
                />
              )}
            </div>
          );
        })}
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
            <div
              className="relative h-64 w-full max-w-xs flex items-center justify-center overflow-hidden mt-8"
              style={{
                maskImage: 'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)',
              }}
            >
              <motion.div
                className="absolute flex flex-col items-center gap-6 w-full"
                animate={{ y: `calc(50% - ${activeIndex * 5}rem - 1.75rem)` }}
                transition={{ type: 'spring', damping: 28, stiffness: 180, mass: 0.8 }}
              >
                {CATEGORIES.map((cat, idx) => {
                  const isActive = idx === activeIndex;
                  const isAdjacent = Math.abs(idx - activeIndex) === 1;
                  return (
                    <motion.div
                      key={cat.id}
                      animate={{
                        opacity: isActive ? 1 : isAdjacent ? 0.35 : 0.08,
                        scale: isActive ? 1.12 : isAdjacent ? 0.92 : 0.85,
                      }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-center gap-3 h-14 w-full"
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

        {/* STEP 2: Demo match card */}
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

            <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col items-center gap-1">
                  <Image src={MATCH.home.flag} alt={MATCH.home.name} width={40} height={28} className="rounded-sm object-cover w-10 h-7" />
                  <p className="text-xs font-medium text-gray-700">{MATCH.home.name}</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-red-500 text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded-full">LIVE 5'</span>
                  <p className="text-xl font-bold text-gray-900">0 : 0</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Image src={MATCH.away.flag} alt={MATCH.away.name} width={40} height={28} className="rounded-sm object-cover w-10 h-7" />
                  <p className="text-xs font-medium text-gray-700">{MATCH.away.name}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => handleOddsClick(0)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded-lg text-xs font-semibold text-gray-700 transition-colors">
                  {MATCH.odds.home}
                </button>
                <button onClick={() => handleOddsClick(1)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded-lg text-xs font-semibold text-gray-700 transition-colors">
                  {MATCH.odds.draw}
                </button>
                <button onClick={() => handleOddsClick(2)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded-lg text-xs font-semibold text-gray-700 transition-colors">
                  {MATCH.odds.away}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Simple trading panel */}
        {step === 'modal' && (
          <motion.div
            key="trading"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex-1 flex flex-col items-center justify-center px-4 pb-10 pt-16"
          >
            <button
              onClick={() => setStep('trade')}
              className="absolute top-12 left-4 text-white/60 hover:text-white text-sm flex items-center gap-1"
            >
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 rotate-90">
                <path d="M2 3.5l3 3 3-3" />
              </svg>
              Back
            </button>

            <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl">

              {/* Header with outcome dropdown */}
              <div className="px-5 pt-5 pb-3 relative">
                <p className="text-[11px] text-gray-400 mb-1">{MATCH.home.name} vs {MATCH.away.name}</p>
                <button
                  onClick={() => setShowOutcomeDropdown(!showOutcomeDropdown)}
                  className="flex items-center gap-2 text-left"
                >
                  {currentOutcome.flag ? (
                    <Image src={currentOutcome.flag} alt={currentOutcome.name} width={28} height={20} className="rounded-sm object-cover w-7 h-5 flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-5 bg-[#141414] rounded-sm flex items-center justify-center flex-shrink-0">
                      <Image src="/predensity-logo.png" alt="Draw" width={16} height={16} className="object-contain" />
                    </div>
                  )}
                  <span className="text-base font-bold text-gray-900">{currentOutcome.name}</span>
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3 h-3 text-gray-400 transition-transform ${showOutcomeDropdown ? 'rotate-180' : ''}`}>
                    <path d="M2 3.5l3 3 3-3" />
                  </svg>
                </button>

                {showOutcomeDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowOutcomeDropdown(false)} />
                    <div className="absolute left-5 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                      {OUTCOMES.map((o, i) => (
                        <button
                          key={i}
                          onClick={() => { setSelectedOutcomeIndex(i); setShowOutcomeDropdown(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left ${selectedOutcomeIndex === i ? 'bg-gray-50' : ''}`}
                        >
                          {o.flag ? (
                            <Image src={o.flag} alt={o.name} width={28} height={20} className="rounded-sm object-cover w-7 h-5 flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-5 bg-[#141414] rounded-sm flex items-center justify-center flex-shrink-0">
                              <Image src="/predensity-logo.png" alt="Draw" width={16} height={16} className="object-contain" />
                            </div>
                          )}
                          <span className="text-sm font-semibold text-gray-900 flex-1">{o.name}</span>
                          <span className="text-xs text-gray-400">{o.yesPrice}%</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Buy tab */}
              <div className="px-5 pb-2 border-b border-gray-100">
                <span className="text-sm font-bold text-gray-900 border-b-2 border-gray-900 pb-1.5 inline-block">Buy</span>
              </div>

              {/* YES / NO */}
              <div className="grid grid-cols-2 gap-3 px-5 py-4">
                <button
                  onClick={() => setSelectedSide('yes')}
                  className={`py-3 rounded-xl text-sm font-bold transition-all ${
                    selectedSide === 'yes'
                      ? 'bg-[#2ecc71] text-white shadow-sm'
                      : 'bg-white border border-[#2ecc71]/50 text-[#2ecc71]'
                  }`}
                >
                  YES {currentOutcome.yesPrice}%
                </button>
                <button
                  onClick={() => setSelectedSide('no')}
                  className={`py-3 rounded-xl text-sm font-bold transition-all ${
                    selectedSide === 'no'
                      ? 'bg-[#ff6b35] text-white shadow-sm'
                      : 'bg-white border border-[#ff6b35]/50 text-[#ff6b35]'
                  }`}
                >
                  NO {currentOutcome.noPrice}%
                </button>
              </div>

              {/* Amount */}
              <div className="px-5 pb-4">
                <p className="text-xs text-gray-400 mb-2">Set your trade amount:</p>
                <div className="grid grid-cols-4 gap-2">
                  {AMOUNT_OPTIONS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setSelectedAmount(amt)}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        selectedAmount === amt
                          ? 'border-gray-900 bg-white text-gray-900 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {amt} USDC
                    </button>
                  ))}
                </div>
              </div>

              {/* To Win */}
              <div className="flex items-center justify-between px-5 pb-4">
                <span className="text-sm text-gray-500">To Win:</span>
                <span className="text-2xl font-extrabold text-[#2ecc71]">
                  {toWin} <span className="text-sm font-semibold text-gray-400">USDC</span>
                </span>
              </div>

              {/* Predict */}
              <div className="px-5 pb-5">
                <button
                  onClick={handlePlaceTrade}
                  className="w-full bg-[#0d1b2a] text-white font-bold py-4 rounded-2xl hover:bg-[#1a2f45] transition-colors text-sm"
                >
                  Trade
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Gameplay */}
        {step === 'gameplay' && (
          <motion.div
            key="gameplay"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col bg-[#1e3a5f]"
          >
            <GamePlay
              match={MATCH}
              selectedOutcome={currentOutcome.name}
              selectedSide={selectedSide}
              selectedAmount={selectedAmount}
              oddPrice={selectedSide === 'yes' ? currentOutcome.yesPrice : currentOutcome.noPrice}
              onGameEnd={handleGameEnd}
            />
          </motion.div>
        )}

        {/* STEP 5: Result */}
        {step === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col bg-[#1e3a5f]"
          >
            <WinnerPage
              match={MATCH}
              selectedOutcome={currentOutcome.name}
              selectedSide={selectedSide}
              selectedAmount={selectedAmount}
              winnings={gameWinnings}
              onContinue={() => router.push('/markets')}
            />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
