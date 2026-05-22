'use client';

import React from 'react';
import { X, Loader2 } from 'lucide-react';

interface BetPlacingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BetPlacingModal({ isOpen, onClose }: BetPlacingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-neutral-900/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 w-96 max-w-[90vw] relative shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Loading Indicator */}
        <div className="flex justify-center mb-5">
          <Loader2 className="w-10 h-10 text-vibrant-purple animate-spin" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white text-center mb-3">Bet in progress</h3>

        {/* Description */}
        <div className="text-center text-gray-400 space-y-1">
          <p>Your bet is being processed.</p>
          <p className="text-sm text-gray-500">It takes a couple of minutes to complete.</p>
        </div>
      </div>
    </div>
  );
}
