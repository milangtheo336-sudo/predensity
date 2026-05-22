// Pure server component — no JS needed, renders on first byte
export default function MarketsSkeleton() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Activity ticker placeholder */}
      <div style={{ height: 32, backgroundColor: '#111', borderBottom: '1px solid #1a1a1a' }} />

      {/* Header placeholder */}
      <div style={{
        height: 64,
        backgroundColor: '#000',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
      }}>
        <div style={{ width: 120, height: 28, backgroundColor: '#1a1a1a', borderRadius: 6 }} />
        <div style={{ flex: 1 }} />
        <div style={{ width: 80, height: 32, backgroundColor: '#1a1a1a', borderRadius: 20 }} />
        <div style={{ width: 80, height: 32, backgroundColor: '#1a1a1a', borderRadius: 20 }} />
      </div>

      {/* Hero placeholder */}
      <div style={{ height: 180, backgroundColor: '#0a0a0a' }} />

      {/* Category tabs placeholder */}
      <div style={{
        backgroundColor: '#000',
        padding: '16px 24px 0',
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid #1a1a1a',
      }}>
        {['All', 'Crypto', 'Politics', 'Sports', 'Tech'].map((_, i) => (
          <div
            key={i}
            style={{
              width: 70,
              height: 32,
              backgroundColor: i === 0 ? '#1d1d1d' : '#111',
              borderRadius: 20,
              marginBottom: 12,
            }}
          />
        ))}
      </div>

      {/* Market grid skeleton */}
      <main style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
        }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                backgroundColor: '#111',
                border: '1px solid #1a1a1a',
                borderRadius: 16,
                overflow: 'hidden',
                animation: `pulse 1.6s ease-in-out ${(i % 4) * 0.1}s infinite`,
              }}
            >
              {/* Card image area */}
              <div style={{ height: 100, backgroundColor: '#1a1a1a' }} />
              {/* Card body */}
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ height: 12, backgroundColor: '#222', borderRadius: 4, width: '80%' }} />
                <div style={{ height: 12, backgroundColor: '#222', borderRadius: 4, width: '55%' }} />
                <div style={{ height: 10, backgroundColor: '#1a1a1a', borderRadius: 4, width: '40%', marginTop: 4 }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <div style={{ flex: 1, height: 32, backgroundColor: '#1a1a1a', borderRadius: 8 }} />
                  <div style={{ flex: 1, height: 32, backgroundColor: '#1a1a1a', borderRadius: 8 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
