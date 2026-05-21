'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface BetPlacingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  amount?: string;
  priceRange?: { min: string; max: string };
  asset?: string;
  /** When true, swap spinner for green success tick */
  success?: boolean;
}


export function BetPlacingModal({
  isOpen,
  onClose,
  amount = '0.00',
  priceRange,
  asset = 'BTC',
  success = false,
}: BetPlacingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 rounded-lg">
      <div className="bg-white dark:bg-[#111114] border border-gray-200 dark:border-white/10 w-full max-w-sm rounded-xl p-5 shadow-2xl">

        {/* Spinner / Success icon */}
        <div className="flex flex-col items-center mb-6 pt-2">
          <div className="relative flex items-center justify-center w-16 h-16">
            {success ? (
              <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center animate-in zoom-in duration-300">
                <Check className="w-8 h-8 text-green-400" strokeWidth={3} />
              </div>
            ) : (
              <>
                <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-white/10" />
                <div
                  className="absolute inset-0 rounded-full border-[3px] border-transparent"
                  style={{
                    borderTopColor: 'var(--color-vibrant-purple, #7c3aed)',
                    animation: 'bet-spinner 0.9s linear infinite',
                  }}
                />
                {/* Logo: dark on light mode, white on dark mode */}
                <div className="w-8 h-8 flex items-center justify-center">
                  <svg viewBox="0 0 577 433" className="w-full h-full" fill="none">
                    <path
                      className="fill-gray-900 dark:fill-white"
                      d="M288.289 93.2865C292.454 94.1865 303.501 101.637 307.525 104.03L336.786 121.118C344.683 125.662 352.542 130.272 360.362 134.947C364.627 137.446 369.148 139.538 373.014 142.58C374.05 146.213 373.601 159.985 373.584 164.447L373.599 192.072L373.666 224.482C373.675 228.554 373.952 237.838 373.375 241.468C372.011 242.877 356.932 251.166 354.389 252.641L312.721 276.986C305.815 281.054 296.401 286.354 289.839 290.686C289.619 293.215 289.809 298.382 289.787 301.124C289.68 308.606 289.635 316.088 289.65 323.571C289.677 327.425 289.803 331.289 289.773 335.141C289.76 336.729 290.036 338.935 288.436 339.585C285.705 339.087 266.579 327.47 262.978 325.348C256.514 321.661 205.572 292.495 203.898 290.536C202.619 285.701 203.257 273.352 203.253 267.959L203.291 227.886L203.283 208.302C203.274 203.72 203.011 195.982 204.029 191.795C204.596 191.052 205.617 190.334 206.416 189.853C216.455 183.811 226.692 178.14 236.617 171.904C238.963 170.431 241.711 168.701 244.2 167.533C233.649 160.849 222.762 154.845 212.098 148.347C210.214 147.2 204.232 144.393 204.061 142.411C205.58 140.802 223.805 130.547 227.161 128.575L268.583 104.477C273.179 101.79 283.771 94.5567 288.289 93.2865ZM247.704 167.249C251.307 169.147 259.609 174.058 262.892 176.452C267.007 179.454 285.565 188.818 287.402 191.793C287.326 195.313 248.867 214.553 247.719 216.891C246.292 219.797 246.788 262.35 247.109 265.393C250.027 267.759 259.326 272.583 263.319 275.135C270.475 279.293 279.997 285.139 287.341 288.503C287.106 283.644 287.176 276.102 287.23 271.171C287.314 263.464 286.416 249.288 287.765 242.115C287.826 242.038 287.885 241.96 287.946 241.883C290.411 238.785 297.09 235.818 300.681 233.748C304.516 231.536 328.516 218.126 329.342 216.452C329.822 215.477 329.886 213.906 329.933 212.838C330.273 205.147 329.94 197.29 329.972 189.585C330.001 182.722 330.477 175.471 329.855 168.642C329.828 168.342 329.795 168.043 329.755 167.745C327.161 165.663 317.302 159.764 314.154 158.202C309.988 156.134 291.173 143.866 288.497 143.705C284.455 144.985 279.89 148.051 276.196 150.299L258.871 160.833C255.22 163.048 251.567 165.464 247.704 167.249Z"
                    />
                  </svg>
                </div>
              </>
            )}
          </div>

          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white tracking-tight">
            {success ? 'Trade Placed!' : 'Placing Trade'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            {success ? 'Your bet was confirmed on-chain.' : 'Confirming transaction...'}
          </p>
        </div>

        {/* Trade Details */}
        <div className="space-y-3 mb-6 text-sm px-2">
          <div className="flex justify-between pb-2 border-b border-gray-100 dark:border-white/5">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Asset</span>
            <span className="text-gray-900 dark:text-white font-bold">{asset}</span>
          </div>

          {priceRange && (
            <div className="flex justify-between pb-2 border-b border-gray-100 dark:border-white/5">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Price Range</span>
              <span className="text-gray-900 dark:text-white font-bold">
                ${priceRange.min} – ${priceRange.max}
              </span>
            </div>
          )}

          <div className="flex justify-between pb-2">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Amount</span>
            <span className="text-gray-900 dark:text-white font-bold">${amount}</span>
          </div>
        </div>

        {/* Progress bar */}
        {!success && (
          <div className="w-full bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden mb-4 border border-gray-200 dark:border-white/5">
            <div
              className="bg-vibrant-purple h-full w-1/3"
              style={{ animation: 'loading 2s ease-in-out infinite' }}
            />
          </div>
        )}

        {/* Footer */}
        {success ? (
          onClose && (
            <button
              onClick={onClose}
              className="w-full mt-2 py-2.5 rounded-lg bg-green-500 hover:bg-green-400 text-white font-semibold text-sm transition-colors"
            >
              Done
            </button>
          )
        ) : (
          <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-semibold mt-2">
            Do not close or refresh
          </p>
        )}
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
