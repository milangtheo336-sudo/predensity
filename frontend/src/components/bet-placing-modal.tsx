'use client';

import React from 'react';

interface BetPlacingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  amount?: string;
  priceRange?: { min: string; max: string };
  asset?: string;
}

export function BetPlacingModal({ 
  isOpen, 
  onClose, 
  amount = '0.00',
  priceRange,
  asset = 'BTC'
}: BetPlacingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-black border border-slate-800 w-full mx-auto max-w-[360px] rounded-2xl p-6 shadow-2xl">
        
        {/* Header & Spinner */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-4 border-slate-800"></div>
            <div className="absolute w-12 h-12 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white tracking-tight">Placing Trade</h2>
          <p className="text-slate-400 text-sm mt-1">Confirming trade...</p>
        </div>

        {/* Trade Details */}
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800/50 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Asset</span>
            <span className="text-slate-200 text-sm font-medium">{asset}</span>
          </div>
          
          {priceRange && (
            <div className="flex justify-between mb-2">
              <span className="text-slate-500 text-xs">Price Range</span>
              <span className="text-slate-200 text-sm font-medium">
                ${priceRange.min} - ${priceRange.max}
              </span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-slate-500 text-xs">Amount</span>
            <span className="text-slate-200 text-sm font-medium">${amount}</span>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
          <div 
            className="bg-white h-full w-1/3 animate-[loading_2s_ease-in-out_infinite]"
            style={{
              animation: 'loading 2s ease-in-out infinite',
            }}
          ></div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-[10px] text-slate-500 mt-4 uppercase tracking-widest">
          Do not close or refresh this window
        </p>
      </div>

      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
