'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Category, CATEGORIES } from '@/lib/types/categories';
import { cn } from '@/lib/utils';
import { HelpCircle, X, ChevronRight, Info } from 'lucide-react';
import { useMagic } from '@/context/MagicContext';
import Image from 'next/image';
import { useTheme } from 'next-themes';

interface CategoryTabsProps {
  activeCategory: Category | 'all';
  onCategoryChange: (category: Category | 'all') => void;
}

// ---------------------------------------------------------------------------
// How It Works Modal -- desktop: centered, mobile: bottom sheet
// ---------------------------------------------------------------------------
function HowItWorksModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  useEffect(() => setMounted(true), []);
  // Reset step when opened
  useEffect(() => { if (isOpen) setStep(0); }, [isOpen]);
  if (!isOpen || !mounted) return null;

  const steps = [
    {
      title: '1. Pick a Market',
      description: 'Browse prediction markets across crypto, politics, sports, and technology. Choose an event you have a view on and want to trade.',
      image: isDark ? '/black theme .avif' : '/white theme.avif',
    },
    {
      title: '2. Fund & Set Your Prediction',
      description: 'Deposit funds using crypto or fiat to fund your account. Then choose your resolution date, set a price range, and enter your stake amount. Narrower ranges and earlier bets earn higher quality scores.',
      widget: true,
    },
    {
      title: '3. Track & Cash Out',
      description: 'Monitor your position in real-time. If the price lands in your range at resolution, you win proportionally. Cash out anytime.',
      card: true,
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#111111] border-t sm:border border-gray-200 dark:border-white/[0.08] rounded-t-2xl sm:rounded-2xl w-full sm:w-[480px] sm:max-w-[92vw] max-h-[90vh] overflow-y-auto relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-neutral-700" />
        </div>

        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 sm:p-6">
          {/* Image / Widget / Card area */}
          <div className="rounded-xl overflow-hidden mb-5 bg-gray-100 dark:bg-black/40 flex items-center justify-center" style={{ minHeight: 200 }}>
            {current.image && (
              <Image src={current.image} alt={current.title} width={440} height={260} className="w-full h-auto object-cover rounded-xl" />
            )}
            {current.widget && <StepTwoWidget />}
            {current.card && <StepThreeCard />}
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{current.title}</h3>

          {/* Description */}
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">{current.description}</p>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {steps.map((_, i) => (
              <button key={i} onClick={() => setStep(i)} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-700'}`} />
            ))}
          </div>

          {/* Action button */}
          {isLast && (
            <button 
              onClick={() => {
                onClose();
                // Scroll to top where the sign up button is visible
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }} 
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
            >
              Get Started
            </button>
          )}
          {!isLast && (
            <button onClick={() => setStep(s => s + 1)} className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors">
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// Step 2: Prediction Widget Preview
function StepTwoWidget() {
  return (
    <div className="w-full flex flex-col sm:flex-row rounded-[14px] overflow-hidden bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/[0.07]">
      <div className="min-w-[180px] p-4 text-[11px] text-gray-900 dark:text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
        <div className="text-gray-500 dark:text-[#82828b] text-[10px] mb-2">Resolution</div>
        <div className="flex gap-1 mb-3">
          {['1D', '3D', '1W', '2W', '1M'].map(t => (
            <span key={t} className={`flex-1 text-center py-[5px] rounded-md text-[10px] font-bold ${t === '3D' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-[#222] text-gray-500 dark:text-[#9f9fa8]'}`}>{t}</span>
          ))}
        </div>
        <div className="bg-gray-100 dark:bg-[#141414] border border-gray-200 dark:border-[#222] rounded-md px-2.5 py-1.5 mb-2 flex justify-center gap-3 text-xs font-bold">
          <span>Mar 31</span><span className="text-gray-400 dark:text-[#82828b]">|</span><span>14:00</span>
        </div>
        <div className="text-gray-500 dark:text-[#82828b] text-[10px] mb-1.5">Price Range</div>
        <div className="bg-gray-100 dark:bg-[#141414] rounded-md px-2.5 py-1.5 mb-2 flex justify-between text-[11px]">
          <span>$0.18</span><span className="text-gray-400 dark:text-[#82828b]">to</span><span>$0.22</span>
        </div>
        <div className="text-gray-500 dark:text-[#82828b] text-[10px] mb-1.5">Stake</div>
        <div className="bg-gray-100 dark:bg-[#141414] rounded-md px-2.5 py-1.5 text-xs font-bold">1.00 USDC</div>
      </div>
      <div className="flex-1 p-4 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-white/[0.06]" style={{ fontFamily: 'Arial, sans-serif' }}>
        <div className="text-[9px] text-gray-400 dark:text-white/20 tracking-[0.14em] uppercase mb-3.5">How to place a bet</div>
        {[
          { n: 1, label: 'Fund your account', sub: 'Deposit with crypto or fiat' },
          { n: 2, label: 'Resolution date & time', sub: 'Pick a duration and exact date/time' },
          { n: 3, label: 'Price range', sub: 'Drag handles to set your min - max' },
          { n: 4, label: 'Stake amount', sub: 'Enter how much USDC to wager' },
        ].map(h => (
          <div key={h.n} className="flex gap-2.5 mb-3">
            <span className="text-[10px] text-gray-300 dark:text-white/20 w-3 flex-shrink-0">{h.n}</span>
            <div>
              <div className="text-[11px] text-gray-900 dark:text-white/90 font-medium leading-none mb-0.5">{h.label}</div>
              <div className="text-[10px] text-gray-400 dark:text-white/35 leading-none">{h.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Step 3: Results Card Preview
function StepThreeCard() {
  return (
    <div className="w-[280px] bg-white dark:bg-[#121212] rounded-2xl border border-gray-200 dark:border-[#1f1f1f] shadow-md dark:shadow-[inset_1px_1px_1px_rgba(255,255,255,0.05),0_8px_0_#050505] my-4 mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-3 px-4 pt-5 pb-3.5">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
          <Image src="/bitcoin.svg" alt="Bitcoin" width={40} height={40} />
        </div>
        <div className="text-sm font-bold text-gray-900 dark:text-white leading-snug">Predict Where Bitcoin&apos;s Price Will Land</div>
      </div>
      <div className="px-4 pb-5">
        {[
          { label: 'Sharpness', value: '--', muted: true },
          { label: 'Lead Time', value: '--', muted: true },
          { label: 'Total Quality', value: '--', muted: false },
        ].map(r => (
          <div key={r.label} className="flex justify-between mb-3 text-[13px]">
            <span className={r.muted ? 'text-gray-400 dark:text-[#8b8f98]' : 'text-gray-900 dark:text-white font-medium'}>{r.label}</span>
            <span className={r.muted ? 'text-gray-400 dark:text-[#8b8f98] font-mono' : 'text-blue-600 font-mono'}>{r.value}</span>
          </div>
        ))}
        <div className="border-t border-gray-200 dark:border-[#1f1f1f] pt-3 mb-4 flex justify-between text-[13px]">
          <span className="text-gray-400 dark:text-[#8b8f98]">Est. Profit</span>
          <span className="text-gray-900 dark:text-white font-medium">+0.0000 USDC (1.00x)</span>
        </div>
        <button className="w-full bg-blue-600 text-white border-none rounded-[10px] py-3 text-sm font-semibold cursor-default shadow-[inset_1px_1px_1px_rgba(255,255,255,0.2),0_6px_0_#1d4ed8]">
          Cash Out
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Tabs
// ---------------------------------------------------------------------------
export function CategoryTabs({ activeCategory, onCategoryChange }: CategoryTabsProps) {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { user, isLoading } = useMagic();
  const isSignedIn = !!user;
  const isLoaded = !isLoading;

  // Only show when Auth has loaded AND user is not signed in
  const showHowItWorks = isLoaded && !isSignedIn && !dismissed;

  const tabs = [
    { id: 'all' as const, name: 'Top' },
    { id: Category.POLITICS, name: 'Politics' },
    { id: Category.CRYPTO, name: 'Crypto' },
    { id: Category.TECHNOLOGY, name: 'Technology' },
    { id: Category.SPORTS, name: 'Sports' },
    { id: Category.FINANCE, name: 'Finance' },
  ];

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {tabs.map((tab) => {
          const isDisabled = tab.id !== 'all' && !CATEGORIES[tab.id as Category]?.enabled;
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && onCategoryChange(tab.id)}
              disabled={isDisabled}
              className={cn(
                'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-normal transition-all whitespace-nowrap flex-shrink-0',
                activeCategory === tab.id
                  ? 'bg-gray-200 dark:bg-neutral-800 text-gray-900 dark:text-white'
                  : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-900',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {tab.name}
            </button>
          );
        })}

        {/* Desktop: inline How it works button (only when not signed in) */}
        {showHowItWorks && (
          <button
            onClick={() => setHowItWorksOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-normal whitespace-nowrap flex-shrink-0 text-blue-500 hover:text-blue-400 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            How it works
          </button>
        )}
      </div>

      {/* Mobile: sticky bottom bar (only when not signed in) */}
      {showHowItWorks && (
        <div className="sm:hidden fixed bottom-16 left-0 right-0 z-50 flex items-center justify-center px-4 py-2.5 bg-white/95 dark:bg-[#111111]/95 backdrop-blur border-t border-gray-200 dark:border-white/[0.06]">
          <button
            onClick={() => setHowItWorksOpen(true)}
            className="flex items-center gap-2 text-sm font-medium text-blue-500"
          >
            <Info className="w-4 h-4" />
            How it works
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-4 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <HowItWorksModal isOpen={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} />
    </>
  );
}
