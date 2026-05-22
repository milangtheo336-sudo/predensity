'use client';

import React, { useState, useCallback, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Move, Eye, EyeOff, Download, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KDEChart, KDEChartRef } from './kde-chart';
import * as d3 from 'd3';
import { useTheme } from 'next-themes';

interface KDEChartModalProps {
  currentPrice: number;
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol?: string;
  contractAddress?: string;
}

export function KDEChartModal({ currentPrice, isOpen, onClose, tokenSymbol = 'HBAR', contractAddress }: KDEChartModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const [showInfo, setShowInfo] = useState(false);
  const [showDensity, setShowDensity] = useState(true);
  const [showConfidence, setShowConfidence] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [currentTransform, setCurrentTransform] = useState<d3.ZoomTransform | undefined>(undefined);
  const chartRef = useRef<KDEChartRef>(null);

  const handleZoomIn = useCallback(() => {
    chartRef.current?.handleZoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    chartRef.current?.handleZoomOut();
  }, []);

  const handleResetZoom = useCallback(() => {
    chartRef.current?.handleResetZoom();
    setCurrentTransform(undefined);
  }, []);

  const handleDownload = useCallback(() => {
    const canvas = document.querySelector('canvas') || document.querySelector('svg');
    if (canvas) {
      const dataURL = canvas instanceof HTMLCanvasElement 
        ? canvas.toDataURL('image/png')
        : new XMLSerializer().serializeToString(canvas);
      
      const link = document.createElement('a');
      link.download = 'kde-chart.png';
      link.href = dataURL;
      link.click();
    }
  }, []);

  const handleZoomChange = useCallback((transform: d3.ZoomTransform) => {
    setCurrentTransform(transform);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-2xl w-[95vw] h-[90vh] max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-neutral-200">
                {tokenSymbol} Community Forecast
              </h2>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                Weighted median prediction with confidence band from all bets.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400">
              <span>Current Price: ${currentPrice.toFixed(4)}</span>
              {currentTransform && (
                <span>Zoom: {Math.round(currentTransform.k * 100)}%</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={currentTransform ? currentTransform.k <= 0.1 : false}
                className="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 border-gray-300 dark:border-neutral-600 h-8 w-8 p-0"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-500 dark:text-neutral-400 px-2">
                {currentTransform ? Math.round(currentTransform.k * 100) : 100}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={currentTransform ? currentTransform.k >= 20 : false}
                className="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 border-gray-300 dark:border-neutral-600 h-8 w-8 p-0"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetZoom}
                className="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 border-gray-300 dark:border-neutral-600 h-8 w-8 p-0"
                title="Reset Zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant={showInfo ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInfo(!showInfo)}
                className="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 border-gray-300 dark:border-neutral-600 h-8 w-8 p-0"
                title="Show Info"
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Info Panel */}
        {showInfo && (
          <div className="p-4 bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700 dark:text-neutral-300">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-neutral-200 mb-2">Chart Elements</h3>
                <ul className="space-y-1 text-xs">
                  <li>Purple line: Weighted median prediction</li>
                  <li>Shaded band: 25th-75th percentile range</li>
                  <li>Green dashed: Current live price</li>
                  <li>Dots: Individual bet predictions</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-neutral-200 mb-2">How It Works</h3>
                <ul className="space-y-1 text-xs">
                  <li>Each bet updates the community forecast</li>
                  <li>Larger stakes carry more weight</li>
                  <li>Step-after interpolation shows discrete updates</li>
                  <li>Hover to see values at any point in time</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-neutral-200 mb-2">Reading the Chart</h3>
                <ul className="space-y-1 text-xs">
                  <li>Narrow band = strong consensus</li>
                  <li>Wide band = divergent opinions</li>
                  <li>Line above green = community expects price rise</li>
                  <li>Line below green = community expects price drop</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Chart Container */}
        <div className="p-4 h-full overflow-auto">
          <div className="w-full h-full">
            <KDEChart 
              ref={chartRef}
              currentPrice={currentPrice}
              tokenSymbol={tokenSymbol}
              contractAddress={contractAddress}
              className="w-full h-full"
              enableZoom={true}
              onZoomChange={handleZoomChange}
              initialTransform={currentTransform}
              showControls={false}
            />
          </div>
        </div>

        {/* Floating Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <div className="bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-gray-200 dark:border-neutral-700 rounded-lg p-2">
            <div className="text-xs text-gray-500 dark:text-neutral-400 mb-1">Quick Actions</div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInfo(!showInfo)}
                className="text-xs h-6 w-6 p-0 text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 border-gray-300 dark:border-neutral-600"
                title="Toggle Info"
              >
                <Info className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
