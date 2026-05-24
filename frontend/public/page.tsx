import { PredictionWidget } from "./components/PredictionWidget";

// Widget original width is 380px
// We render it at 58% → left panel = 220px
const WIDGET_W = 380;
const LEFT_W = 220;
const SCALE = LEFT_W / WIDGET_W; // ≈ 0.579

const highlights = [
  {
    n: 1,
    label: "Resolution date & time",
    sub: "Pick a duration and exact date/time",
    top: 0,
    height: 178,
  },
  {
    n: 2,
    label: "Price range",
    sub: "Drag handles to set your min – max",
    top: 178,
    height: 148,
  },
  {
    n: 3,
    label: "Stake amount",
    sub: "Enter how much USDC to wager",
    top: 326,
    height: 88,
  },
];

const POPUP_W = 490;
const POPUP_H = 248;

export default function App() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#080808" }}
    >
      <div
        style={{
          width: POPUP_W,
          height: POPUP_H,
          display: "flex",
          borderRadius: 14,
          overflow: "hidden",
          background: "#111111",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 12px 48px rgba(0,0,0,0.7)",
        }}
      >
        {/* LEFT — scaled widget */}
        <div
          style={{
            width: LEFT_W,
            height: POPUP_H,
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Widget scaled from top-left. Filter sharpens text at small sizes. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transformOrigin: "top left",
              transform: `scale(${SCALE})`,
              pointerEvents: "none",
              userSelect: "none",
              // Boost contrast so text stays legible when scaled down
              filter: "contrast(1.15) brightness(1.08)",
            }}
          >
            <PredictionWidget />
          </div>

          {/* Section highlight overlays — coordinates in scaled space */}
          {highlights.map((h) => (
            <div key={h.n}>
              {/* left accent bar */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: h.top * SCALE,
                  height: h.height * SCALE,
                  width: 2,
                  background: "rgba(255,255,255,0.3)",
                  borderRadius: 2,
                  zIndex: 10,
                }}
              />
              {/* subtle section tint */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: h.top * SCALE,
                  height: h.height * SCALE,
                  background: "rgba(255,255,255,0.025)",
                  zIndex: 9,
                }}
              />
              {/* number badge */}
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  top: h.top * SCALE + 6,
                  width: 15,
                  height: 15,
                  borderRadius: "50%",
                  background: "rgba(20,20,20,0.85)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 8,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 11,
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: 0,
                }}
              >
                {h.n}
              </div>
            </div>
          ))}

          {/* Right-edge gradient to blend into card */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 32,
              height: "100%",
              background: "linear-gradient(to right, transparent, #111111)",
              pointerEvents: "none",
              zIndex: 12,
            }}
          />
        </div>

        {/* Thin divider */}
        <div style={{ width: 1, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />

        {/* RIGHT — annotations */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "20px 22px",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <p style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.22)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 18,
          }}>
            How to place a bet
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, justifyContent: "center" }}>
            {highlights.map((h) => (
              <div key={h.n} style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                <span style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.18)",
                  marginTop: 1,
                  width: 12,
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {h.n}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{
                    fontSize: 12.5,
                    color: "rgba(255,255,255,0.9)",
                    lineHeight: 1,
                    fontWeight: 500,
                  }}>
                    {h.label}
                  </span>
                  <span style={{
                    fontSize: 10.5,
                    color: "rgba(255,255,255,0.35)",
                    lineHeight: 1,
                  }}>
                    {h.sub}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.16)",
            lineHeight: 1.5,
            marginTop: 16,
          }}>
            Win if price lands inside your range at resolution.
          </p>
        </div>
      </div>
    </div>
  );
}
