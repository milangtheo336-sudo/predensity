'use client';

interface CategoryHeroProps {
  /** Which category is currently active. Banner shows for 'all' and 'crypto'. */
  category: string;
}

export function CategoryHero({ category }: CategoryHeroProps) {
  const show = category === 'all' || category === 'crypto';
  if (!show) return null;

  return (
    <div className="relative w-full overflow-hidden" style={{ height: '320px' }}>
      {/* Background video */}
      <video
        src="/market file videos/crypto.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark overlay — heavier at bottom to fade into page background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.95) 88%, #000 100%)',
        }}
      />

      {/* Text content */}
      <div className="absolute inset-0 flex flex-col justify-end px-6 pb-6">
        <h1 className="text-[72px] font-extrabold text-white leading-none mb-3 tracking-tight">
          Crypto
        </h1>
        <p className="text-sm text-gray-300 max-w-xl leading-snug">
          Profit from bold, early, and accurate price forecasts on BTC, ETH, HBAR and more.
        </p>
      </div>
    </div>
  );
}
