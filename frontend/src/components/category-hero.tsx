'use client';

import { useLanguage } from '@/context/LanguageContext';

interface CategoryHeroProps {
  category: string;
}

/** The video layer only — sticky so the video never scrolls */
export function CategoryHeroVideo({ category }: CategoryHeroProps) {
  const show = category === 'all' || category === 'crypto';
  if (!show) return null;

  return (
    <div className="relative w-full" style={{ height: '320px' }}>
      <video
        src="/market file videos/crypto.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ pointerEvents: 'none' }}
      />
      {/* Overlay fades video to black at bottom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.97) 88%, #000 100%)',
        }}
      />
    </div>
  );
}

/** The text layer — normal flow so it scrolls with the page */
export function CategoryHeroText({ category }: CategoryHeroProps) {
  const { t } = useLanguage();
  const show = category === 'all' || category === 'crypto';
  if (!show) return null;

  return (
    <div className="relative z-[1] container mx-auto px-4 pb-6">
      <h1 className="text-[72px] font-extrabold text-white leading-none mb-3 tracking-tight">
        {t.heroCrypto}
      </h1>
      <p className="text-sm text-gray-300 max-w-xl leading-snug">
        {t.heroTagline}
      </p>
    </div>
  );
}
