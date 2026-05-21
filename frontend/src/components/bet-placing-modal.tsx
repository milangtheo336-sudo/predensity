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
    <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 rounded-lg">
      <div className="bg-[#111114] border border-white/10 w-full max-w-sm rounded-xl p-5 shadow-2xl">
        
        {/* Header & Spinner */}
        <div className="flex flex-col items-center mb-6 pt-2">
          <div className="relative flex items-center justify-center w-10 h-10">
            <div className="absolute inset-0 rounded-full border-[3px] border-white/10"></div>
            <div
              className="absolute inset-0 rounded-full border-[3px] border-transparent"
              style={{
                borderTopColor: 'var(--color-vibrant-purple, #7c3aed)',
                animation: 'bet-spinner 0.8s linear infinite',
              }}
            ></div>
          </div>
          <h2 className="mt-4 text-lg font-bold text-white tracking-tight">Placing Trade</h2>
          <p className="text-gray-400 text-xs mt-1">Confirming transaction...</p>
        </div>

        {/* Trade Details */}
        <div className="space-y-3 mb-6 text-sm px-2">
          <div className="flex justify-between pb-2 border-b border-white/5">
            <span className="text-gray-400 font-medium">Asset</span>
            <span className="text-white font-bold">{asset}</span>
          </div>
          
          {priceRange && (
            <div className="flex justify-between pb-2 border-b border-white/5">
              <span className="text-gray-400 font-medium">Price Range</span>
              <span className="text-white font-bold">
                ${priceRange.min} - ${priceRange.max}
              </span>
            </div>
          )}
          
          <div className="flex justify-between pb-2">
            <span className="text-gray-400 font-medium">Amount</span>
            <span className="text-white font-bold">${amount}</span>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-4 border border-white/5">
          <div 
            className="bg-vibrant-purple h-full w-1/3"
            style={{
              animation: 'loading 2s ease-in-out infinite',
            }}
          ></div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-[10px] text-gray-500 uppercase tracking-widest font-semibold mt-2">
          Do not close or refresh
        </p>
      </div>

      <style>{`
        @keyframes bet-spinner {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes loading {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
