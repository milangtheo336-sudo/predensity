'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useMagic } from '@/context/MagicContext';

const CATEGORIES = [
  { id: 'crypto', name: 'Crypto', icon: '₿' },
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'politics', name: 'Politics', icon: '🗳' },
  { id: 'finance', name: 'Finance', icon: '📈' },
  { id: 'technology', name: 'Technology', icon: '💡' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading } = useMagic();
  const [activeIndex, setActiveIndex] = useState(0);
  const [step, setStep] = useState<'categories' | 'trade'>('categories');

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Auto-scroll categories
  useEffect(() => {
    if (step !== 'categories') return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % CATEGORIES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [step]);

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative flex flex-col">
      {/* Logo */}
      <div className="absolute top-8 w-full flex justify-center z-10">
        <Image src="/predensity-logo.png" alt="Predensity" width={36} height={36} className="object-contain" />
      </div>

      <AnimatePresence mode="wait">
        {step === 'categories' && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col justify-between items-center py-24 px-6"
          >
            {/* Progress dots */}
            <div className="flex gap-2 mt-8">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`h-1 w-8 rounded-full ${i === 0 ? 'bg-white' : 'bg-neutral-800'}`} />
              ))}
            </div>

            {/* Category carousel */}
            <div className="relative h-64 w-full max-w-xs flex items-center justify-center overflow-hidden"
              style={{ maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)' }}>
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
                      <span className={`text-2xl font-bold ${isActive ? 'text-white' : 'text-neutral-600'}`}>
                        {cat.name}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* CTA */}
            <div className="w-full max-w-sm flex flex-col items-center text-center pb-8">
              <p className="text-neutral-400 text-sm mb-2">Welcome to Predensity</p>
              <h2 className="text-2xl font-bold mb-8">The home of what happens next</h2>
              <button
                onClick={() => setStep('trade')}
                className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-neutral-200 transition-colors"
              >
                Get Started
              </button>
            </div>
          </motion.div>
        )}

        {step === 'trade' && (
          <motion.div
            key="trade"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-10"
          >
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Trust your gut</h1>
              <p className="text-neutral-400 text-sm">Here is how trading works on Predensity</p>
            </div>

            {/* Demo market card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 w-full max-w-sm mb-8">
              <p className="text-xs text-neutral-500 mb-3">Will Arsenal win the Premier League?</p>
              <div className="flex gap-2">
                <button className="flex-1 bg-[#3fdc8c]/20 border border-[#3fdc8c]/40 text-[#3fdc8c] py-3 rounded-xl font-bold text-sm">
                  Yes 43¢
                </button>
                <button className="flex-1 bg-neutral-800 border border-neutral-700 text-[#ff8c42] py-3 rounded-xl font-bold text-sm">
                  No 57¢
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-neutral-800 space-y-2 text-xs text-neutral-400">
                <div className="flex justify-between">
                  <span>Each contract pays $1 if correct</span>
                </div>
                <div className="flex justify-between">
                  <span>Buy YES at 43¢ to win 57¢ profit per contract</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push('/markets')}
              className="w-full max-w-sm bg-white text-black font-bold py-4 rounded-xl hover:bg-neutral-200 transition-colors"
            >
              Explore Markets
            </button>
            <button
              onClick={() => router.push('/markets')}
              className="mt-3 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Skip for now
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
