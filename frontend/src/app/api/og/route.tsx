import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

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
      <div
        style={{
          width: '1200',
          height: '630',
          display: 'flex',
          background: '#0a0a0a',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Left panel -- token image */}
        <div
          style={{
            width: '480',
            height: '630',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          }}
        >
          {image ? (
            <img src={image} width="200" height="200" style={{ borderRadius: '24px', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '200', height: '200', borderRadius: '24px', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: '64px', fontWeight: 700 }}>{symbol.charAt(0)}</span>
            </div>
          )}
        </div>

        {/* Right panel -- market info */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '40px 48px',
            background: '#111111',
          }}
        >
          {/* Branding */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#9ca3af', fontSize: '16px' }}>{volume}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="https://predensity.com/predensity-logo.png" width="24" height="24" style={{ borderRadius: '4px' }} />
              <span style={{ color: '#ffffff', fontSize: '16px', fontWeight: 600 }}>Predensity</span>
            </div>
          </div>

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ color: '#ffffff', fontSize: '36px', fontWeight: 700, lineHeight: '1.2' }}>
              {title}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#9ca3af', fontSize: '18px' }}>Current Price</span>
              <span style={{ color: '#22c55e', fontSize: '24px', fontWeight: 700 }}>${price}</span>
            </div>
          </div>

          {/* LIVE badge */}
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

  const isPositive = !pnl.startsWith('-');
  const pnlColor = isPositive ? '#22c55e' : '#ef4444';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200',
          height: '630',
          display: 'flex',
          background: '#0a0a0a',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Left panel */}
        <div
          style={{
            width: '480',
            height: '630',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '40px',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="https://predensity.com/predensity-logo.png" width="28" height="28" style={{ borderRadius: '6px' }} />
            <span style={{ color: '#ffffff', fontSize: '18px', fontWeight: 600, letterSpacing: '1px' }}>Predensity</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ color: '#ffffff', fontSize: '32px', fontWeight: 700 }}>{name}</span>
            <span style={{ color: pnlColor, fontSize: '28px', fontWeight: 700 }}>{pnl}</span>
          </div>

          <span style={{ color: '#9ca3af', fontSize: '14px' }}>
            @{name.toLowerCase().replace(/\s+/g, '')} on Predensity
          </span>
        </div>

        {/* Right panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '40px 48px',
            background: '#111111',
          }}
        >
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
