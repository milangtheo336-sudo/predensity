// Pure server component — no JS needed, renders on first byte
export default function MarketsSkeleton() {
  return (
    <div className="markets-skeleton" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Activity ticker placeholder */}
      <div className="sk-ticker" style={{ height: 32, borderBottom: '1px solid var(--sk-border)' }} />

      {/* Header placeholder */}
      <div className="sk-header" style={{
        height: 64,
        borderBottom: '1px solid var(--sk-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
      }}>
        <div className="sk-block" style={{ width: 120, height: 28, borderRadius: 6 }} />
        <div style={{ flex: 1 }} />
        <div className="sk-block" style={{ width: 80, height: 32, borderRadius: 20 }} />
        <div className="sk-block" style={{ width: 80, height: 32, borderRadius: 20 }} />
      </div>

      {/* Hero placeholder */}
      <div className="sk-hero" style={{ height: 180 }} />

      {/* Category tabs placeholder */}
      <div className="sk-tabs" style={{
        padding: '16px 24px 0',
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--sk-border)',
      }}>
        {[0,1,2,3,4].map((i) => (
          <div
            key={i}
            className={i === 0 ? 'sk-tab-active' : 'sk-block'}
            style={{ width: 70, height: 32, borderRadius: 20, marginBottom: 12 }}
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
              className="sk-card"
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                animation: `sk-pulse 1.6s ease-in-out ${(i % 4) * 0.1}s infinite`,
              }}
            >
              <div className="sk-card-img" style={{ height: 100 }} />
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="sk-line" style={{ height: 12, borderRadius: 4, width: '80%' }} />
                <div className="sk-line" style={{ height: 12, borderRadius: 4, width: '55%' }} />
                <div className="sk-line-sm" style={{ height: 10, borderRadius: 4, width: '40%', marginTop: 4 }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <div className="sk-btn" style={{ flex: 1, height: 32, borderRadius: 8 }} />
                  <div className="sk-btn" style={{ flex: 1, height: 32, borderRadius: 8 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <style>{`
        /* Dark mode (default — matches app default theme) */
        .markets-skeleton {
          --sk-bg:       #000;
          --sk-surface:  #111;
          --sk-block:    #1a1a1a;
          --sk-line:     #222;
          --sk-border:   #1a1a1a;
          --sk-tab-act:  #1d1d1d;
          background-color: var(--sk-bg);
        }

        /* Light mode override */
        @media (prefers-color-scheme: light) {
          .markets-skeleton {
            --sk-bg:       #fff;
            --sk-surface:  #f3f4f6;
            --sk-block:    #e5e7eb;
            --sk-line:     #d1d5db;
            --sk-border:   #e5e7eb;
            --sk-tab-act:  #e5e7eb;
          }
        }

        /* Also respect the .dark / no-.dark class set by next-themes */
        :root:not(.dark) .markets-skeleton {
          --sk-bg:       #fff;
          --sk-surface:  #f3f4f6;
          --sk-block:    #e5e7eb;
          --sk-line:     #d1d5db;
          --sk-border:   #e5e7eb;
          --sk-tab-act:  #e5e7eb;
        }

        .sk-ticker, .sk-header, .sk-tabs { background-color: var(--sk-bg); }
        .sk-hero   { background-color: #0a0a0a; }
        @media (prefers-color-scheme: light) { .sk-hero { background-color: #e5e7eb; } }
        :root:not(.dark) .sk-hero { background-color: #e5e7eb; }

        .sk-block, .sk-tab-active { background-color: var(--sk-block); }
        .sk-card   { background-color: var(--sk-surface); border: 1px solid var(--sk-border); }
        .sk-card-img { background-color: var(--sk-block); }
        .sk-line   { background-color: var(--sk-line); }
        .sk-line-sm { background-color: var(--sk-block); }
        .sk-btn    { background-color: var(--sk-block); }

        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
