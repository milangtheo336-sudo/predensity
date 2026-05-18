'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Category, CATEGORIES } from '@/lib/types/categories';
import { cn } from '@/lib/utils';
import { HelpCircle, X, ChevronRight, Info } from 'lucide-react';
import { SignUpButton, useUser } from '@clerk/nextjs';
import Image from 'next/image';

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
  useEffect(() => setMounted(true), []);
  // Reset step when opened
  useEffect(() => { if (isOpen) setStep(0); }, [isOpen]);
  if (!isOpen || !mounted) return null;

  const steps = [
    {
      title: '1. Pick a Market',
      description: 'Browse prediction markets across crypto, politics, sports, and technology. Choose an event you have a view on and want to trade.',
      image: '/first images .webp',
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
        className="bg-[#111111] border-t sm:border border-white/[0.08] rounded-t-2xl sm:rounded-2xl w-full sm:w-[480px] sm:max-w-[92vw] max-h-[90vh] overflow-y-auto relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-neutral-700" />
        </div>

        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 sm:p-6">
          {/* Image / Widget / Card area */}
          <div className="rounded-xl overflow-hidden mb-5 bg-black/40 flex items-center justify-center" style={{ minHeight: 200 }}>
            {current.image && (
              <Image src={current.image} alt={current.title} width={440} height={260} className="w-full h-auto object-cover rounded-xl" />
            )}
            {current.widget && <StepTwoWidget />}
            {current.card && <StepThreeCard />}
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-white mb-2">{current.title}</h3>

          {/* Description */}
          <p className="text-sm text-gray-400 leading-relaxed mb-6">{current.description}</p>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {steps.map((_, i) => (
              <button key={i} onClick={() => setStep(i)} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-blue-500' : 'bg-neutral-700'}`} />
            ))}
          </div>

          {/* Action button */}
          {isLast ? (
            <SignUpButton mode="modal">
              <button className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors">
                Get Started
              </button>
            </SignUpButton>
          ) : (
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
    <div className="w-full flex flex-col sm:flex-row" style={{ borderRadius: 14, overflow: 'hidden', background: '#111111', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ minWidth: 180, padding: 16, fontSize: 11, color: '#fff', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ color: '#82828b', fontSize: 10, marginBottom: 8 }}>Resolution</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {['1D', '3D', '1W', '2W', '1M'].map(t => (
            <span key={t} style={{ flex: 1, textAlign: 'center', padding: '5px 0', borderRadius: 6, fontSize: 10, fontWeight: 700, background: t === '3D' ? '#2563eb' : '#222', color: t === '3D' ? '#fff' : '#9f9fa8' }}>{t}</span>
          ))}
        </div>
        <div style={{ background: '#141414', border: '1px solid #222', borderRadius: 6, padding: '6px 10px', marginBottom: 8, display: 'flex', justifyContent: 'center', gap: 12, fontSize: 12, fontWeight: 700 }}>
          <span>Mar 31</span><span style={{ color: '#82828b' }}>|</span><span>14:00</span>
        </div>
        <div style={{ color: '#82828b', fontSize: 10, marginBottom: 6 }}>Price Range</div>
        <div style={{ background: '#141414', borderRadius: 6, padding: '6px 10px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span>$0.18</span><span style={{ color: '#82828b' }}>to</span><span>$0.22</span>
        </div>
        <div style={{ color: '#82828b', fontSize: 10, marginBottom: 6 }}>Stake</div>
        <div style={{ background: '#141414', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>1.00 USDC</div>
      </div>
      <div style={{ flex: 1, padding: '16px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', fontFamily: 'Arial, sans-serif' }} className="sm:border-t-0 sm:border-l sm:border-white/[0.06]">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>How to place a bet</div>
        {[
          { n: 1, label: 'Fund your account', sub: 'Deposit with crypto or fiat' },
          { n: 2, label: 'Resolution date & time', sub: 'Pick a duration and exact date/time' },
          { n: 3, label: 'Price range', sub: 'Drag handles to set your min - max' },
          { n: 4, label: 'Stake amount', sub: 'Enter how much USDC to wager' },
        ].map(h => (
          <div key={h.n} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', width: 12, flexShrink: 0 }}>{h.n}</span>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 500, lineHeight: 1, marginBottom: 3 }}>{h.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1 }}>{h.sub}</div>
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
    <div style={{ width: 280, background: '#121212', borderRadius: 16, border: '1px solid #1f1f1f', boxShadow: 'inset 1px 1px 1px rgba(255,255,255,0.05), 0 8px 0 #050505', fontFamily: 'Arial, sans-serif', margin: '16px auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 16px 14px' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F7931A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>B</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>Predict Where Bitcoin&apos;s Price Will Land</div>
      </div>
      <div style={{ padding: '6px 16px 18px' }}>
        {[
          { label: 'Sharpness', value: '--', muted: true },
          { label: 'Lead Time', value: '--', muted: true },
          { label: 'Total Quality', value: '--', muted: false },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13 }}>
            <span style={{ color: r.muted ? '#8b8f98' : '#fff', fontWeight: r.muted ? 400 : 500 }}>{r.label}</span>
            <span style={{ color: r.muted ? '#8b8f98' : '#2563eb', fontFamily: 'monospace' }}>{r.value}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #1f1f1f', paddingTop: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: '#8b8f98' }}>Est. Profit</span>
          <span style={{ color: '#fff', fontWeight: 500 }}>+0.0000 USDC (1.00x)</span>
        </div>
        <button style={{ width: '100%', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: 'default', boxShadow: 'inset 1px 1px 1px rgba(255,255,255,0.2), 0 6px 0 #1d4ed8' }}>
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
  const { isSignedIn, isLoaded } = useUser();

  // Only show when Clerk has loaded AND user is not signed in
  const showHowItWorks = isLoaded && !isSignedIn && !dismissed;

  const tabs = [
    { id: 'all' as const, name: 'Top' },
    { id: Category.POLITICS, name: 'Politics' },
    { id: Category.CRYPTO, name: 'Crypto' },
    { id: Category.TECHNOLOGY, name: 'Technology' },
    { id: Category.SPORTS, name: 'Sports' },
    { id: Category.INTERNATIONAL, name: 'International' },
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
        <div className="sm:hidden fixed bottom-16 left-0 right-0 z-50 flex items-center justify-center px-4 py-2.5 bg-[#111111]/95 backdrop-blur border-t border-white/[0.06]">
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
