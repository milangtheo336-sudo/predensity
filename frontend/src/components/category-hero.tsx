'use client';

import { useRef, useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

interface CategoryHeroProps {
  category: string;
}

// Which video each category uses
function getVideoSrc(category: string): string {
  switch (category) {
    case 'sports':    return '/market file videos/sports.mp4';
    case 'politics':  return '/market file videos/politics.mp4';
    // Top, Crypto, Technology, Finance all use the crypto reel
    default:          return '/market file videos/crypto.mp4';
  }
}

// Categories that show the hero
const HERO_CATEGORIES = new Set(['all', 'crypto', 'sports', 'politics', 'technology', 'finance']);

/** The video layer only — sticky so the video never scrolls */
export function CategoryHeroVideo({ category }: CategoryHeroProps) {
  const show = HERO_CATEGORIES.has(category);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(true);
  const prevSrcRef = useRef('');

  const src = getVideoSrc(category);

  // Fade out → swap src → fade in when the video source changes
  useEffect(() => {
    if (!show) return;
    if (prevSrcRef.current === src) return;

    if (prevSrcRef.current === '') {
      // First mount — no transition needed
      prevSrcRef.current = src;
      return;
    }

    // Fade out
    setVisible(false);
    const t = setTimeout(() => {
      prevSrcRef.current = src;
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play().catch(() => {});
      }
      // Fade back in
      setVisible(true);
    }, 350);

    return () => clearTimeout(t);
  }, [src, show]);

  if (!show) return null;

  return (
    <div className="relative w-full" style={{ height: '320px' }}>
      <video
        ref={videoRef}
        key={src}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
        style={{ pointerEvents: 'none', opacity: visible ? 1 : 0 }}
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
  const show = HERO_CATEGORIES.has(category);
  if (!show) return null;

  let heading = t.heroCrypto;
  let tagline = t.heroTagline;

  switch (category) {
    case 'sports':
      heading = t.heroSports;
      tagline = t.heroSportsTagline;
      break;
    case 'politics':
      heading = t.heroPolitics;
      tagline = t.heroPoliticsTagline;
      break;
    case 'technology':
      heading = t.heroTechnology;
      tagline = t.heroTechnologyTagline;
      break;
    case 'finance':
      heading = t.heroFinance;
      tagline = t.heroFinanceTagline;
      break;
  }

  return (
    <div className="relative z-[1] container mx-auto px-4 pb-6">
      <h1 className="text-[72px] font-extrabold text-white leading-none mb-3 tracking-tight">
        {heading}
      </h1>
      <p className="text-sm text-gray-300 max-w-xl leading-snug">
        {tagline}
      </p>
    </div>
  );
}
