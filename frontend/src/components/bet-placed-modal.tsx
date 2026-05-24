'use client';

import React from 'react';
import { X, Check } from 'lucide-react';

interface BetPlacedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewExplorer: () => void;
}

export function BetPlacedModal({ isOpen, onClose, onViewExplorer }: BetPlacedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-900/80 backdrop-blur-xl border border-gray-200 dark:border-white/[0.08] rounded-2xl p-8 w-96 max-w-[90vw] relative shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 bg-vibrant-purple rounded-full flex items-center justify-center">
            <Check className="w-7 h-7 text-white" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-3">Trade placed</h3>

        <div className="text-center text-gray-500 dark:text-gray-400 space-y-1">
          <p>Your trade has been placed successfully.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">Check the Activity tab for transaction details.</p>
        </div>
      </div>
    </div>
  );
}
