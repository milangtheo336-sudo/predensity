import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Same palettes as in utils.ts -- kept in sync
const PALETTES = [
  ['#F72585', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0'],
  ['#0B132B', '#1C2541', '#3A506B', '#5BC0BE', '#6FFFE9'],
  ['#FF416C', '#FF4B2B', '#FF9068', '#FFB75E', '#FDC830'],
  ['#FFC3E2', '#B8B5FF', '#789BFF', '#86E3CE', '#D0E6A5'],
];

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getPaletteForSeed(seed: string): string[] {
  return PALETTES[hashSeed(seed) % PALETTES.length];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'profile';

  if (type === 'market') {
    return renderMarketCard(searchParams);
  }
  return renderProfileCard(searchParams);
}

function renderMarketCard(params: URLSearchParams) {
  const title = params.get('title') || 'Predict the price';
  const symbol = params.get('symbol') || 'BTC';
  const price = params.get('price') || '...';
  const image = params.get('image') || '';
  const volume = params.get('volume') || '$ 20.00k';

  return new ImageResponse(
    (
      <div style={{ width: '1200', height: '630', display: 'flex', background: '#0a0a0a', fontFamily: 'Inter, sans-serif' }}>
        <div style={{
          width: '480', height: '630', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle at 30% 40%, #F72585 0%, transparent 50%), radial-gradient(circle at 70% 60%, #4361EE 0%, transparent 50%), radial-gradient(circle at 50% 80%, #4CC9F0 0%, transparent 50%), linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%)',
        }}>
          {image ? (
            <img src={image} width="180" height="180" style={{ borderRadius: '24px', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '180', height: '180', borderRadius: '24px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
              <span style={{ color: '#fff', fontSize: '72px', fontWeight: 700 }}>{symbol.charAt(0)}</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 48px', background: '#111111' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#9ca3af', fontSize: '16px' }}>{volume}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="https://predensity.com/predensity-logo.png" width="24" height="24" style={{ borderRadius: '4px' }} />
              <span style={{ color: '#ffffff', fontSize: '16px', fontWeight: 600 }}>Predensity</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ color: '#ffffff', fontSize: '36px', fontWeight: 700, lineHeight: '1.2' }}>{title}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#9ca3af', fontSize: '18px' }}>Current Price</span>
              <span style={{ color: '#22c55e', fontSize: '24px', fontWeight: 700 }}>${price}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10', height: '10', borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: 700, letterSpacing: '1px' }}>LIVE</span>
            <span style={{ color: '#6b7280', fontSize: '14px', marginLeft: '8px' }}>predensity.com</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

function renderProfileCard(params: URLSearchParams) {
  const name = params.get('name') || 'Trader';
  const pnl = params.get('pnl') || '+$0.00';
  const predictions = params.get('predictions') || '0';
  const biggestWin = params.get('win') || '$0.00';
  const seed = params.get('seed') || 'default';

  const isPositive = !pnl.startsWith('-');
  const pnlColor = isPositive ? '#22c55e' : '#ef4444';

  // Use the same palette as the user's boring-avatars orb
  const colors = getPaletteForSeed(seed);
  const meshGradient = [
    `radial-gradient(circle at 25% 35%, ${colors[0]} 0%, transparent 50%)`,
    `radial-gradient(circle at 65% 55%, ${colors[1]} 0%, transparent 50%)`,
    `radial-gradient(circle at 45% 80%, ${colors[2]} 0%, transparent 50%)`,
    `radial-gradient(circle at 80% 20%, ${colors[3]}88 0%, transparent 40%)`,
    'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%)',
  ].join(', ');

  return new ImageResponse(
    (
      <div style={{ width: '1200', height: '630', display: 'flex', background: '#0a0a0a', fontFamily: 'Inter, sans-serif' }}>
        {/* Left panel -- mesh gradient matching user's avatar palette */}
        <div style={{
          width: '480', height: '630', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '40px',
          background: meshGradient,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="https://predensity.com/predensity-logo.png" width="28" height="28" style={{ borderRadius: '6px' }} />
            <span style={{ color: '#ffffff', fontSize: '18px', fontWeight: 600, letterSpacing: '1px' }}>Predensity</span>
          </div>

          {/* Orb placeholder -- a circle with the user's gradient colors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              width: '100px', height: '100px', borderRadius: '50%',
              background: `radial-gradient(circle at 40% 40%, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`,
              boxShadow: `0 0 40px ${colors[0]}66, 0 0 80px ${colors[1]}33`,
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: '#ffffff', fontSize: '32px', fontWeight: 700 }}>{name}</span>
              <span style={{ color: pnlColor, fontSize: '28px', fontWeight: 700 }}>{pnl}</span>
            </div>
          </div>

          <span style={{ color: '#9ca3af', fontSize: '14px' }}>
            @{name.toLowerCase().replace(/\s+/g, '')} on Predensity
          </span>
        </div>

        {/* Right panel -- stats */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 48px', background: '#111111' }}>
          <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: 700, marginBottom: '32px' }}>Stats</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#9ca3af', fontSize: '18px' }}>Total P&L</span>
              <span style={{ color: pnlColor, fontSize: '22px', fontWeight: 700 }}>{pnl}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#9ca3af', fontSize: '18px' }}>Predictions</span>
              <span style={{ color: '#ffffff', fontSize: '22px', fontWeight: 700 }}>{predictions}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#9ca3af', fontSize: '18px' }}>Biggest Win</span>
              <span style={{ color: '#22c55e', fontSize: '22px', fontWeight: 700 }}>{biggestWin}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
