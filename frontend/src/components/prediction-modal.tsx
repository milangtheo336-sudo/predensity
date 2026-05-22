'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { PredictionCard } from '@/components/prediction-card';
import { X } from 'lucide-react';

interface PredictionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PredictionModal({ isOpen, onClose }: PredictionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-black border-gray-800 p-0">
        <div className="sticky top-0 z-10 bg-black border-b border-gray-800 p-4 flex items-center justify-between">
          <DialogTitle className="text-lg font-semibold text-white">
            Place Your Prediction
          </DialogTitle>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <PredictionCard />
        </div>
      </DialogContent>
    </Dialog>
  );
}
