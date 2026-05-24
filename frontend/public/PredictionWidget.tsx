export function PredictionWidget() {
  return (
    <div style={{
      width: 380,
      background: "#0b0b0b",
      padding: 24,
      borderRadius: 12,
      boxSizing: "border-box",
      fontFamily: "Inter, sans-serif",
      color: "#ffffff",
      WebkitFontSmoothing: "antialiased",
    }}>

      {/* Resolution */}
      <div style={{ color: "#82828b", fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Resolution</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["1D", "3D", "1W", "2W", "1M"].map((t) => (
          <button key={t} style={{
            flex: 1,
            background: t === "3D" ? "#632eff" : "#222222",
            color: t === "3D" ? "#fff" : "#9f9fa8",
            border: "none",
            padding: "8px 0",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}>{t}</button>
        ))}
      </div>

      {/* Date/Time */}
      <div style={{
        background: "#141414",
        border: "1px solid #222222",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        marginBottom: 8,
      }}>
        {/* Date group */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, justifyContent: "center" }}>
          <IconBtn>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "#82828b", strokeWidth: 2.5, fill: "none" }}><path d="M5 12h14"/></svg>
          </IconBtn>
          <span style={{ fontSize: 15, fontWeight: 700, minWidth: 52, textAlign: "center" }}>Mar 31</span>
          <IconBtn>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "#82828b", strokeWidth: 2.5, fill: "none" }}><path d="M12 5v14M5 12h14"/></svg>
          </IconBtn>
        </div>
        <div style={{ width: 1, height: 18, background: "#333", margin: "0 4px" }} />
        {/* Time group */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, justifyContent: "center" }}>
          <IconBtn>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "#82828b", strokeWidth: 2.5, fill: "none" }}><path d="M5 12h14"/></svg>
          </IconBtn>
          <span style={{ fontSize: 15, fontWeight: 700, minWidth: 52, textAlign: "center" }}>12:55</span>
          <IconBtn>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "#82828b", strokeWidth: 2.5, fill: "none" }}><path d="M12 5v14M5 12h14"/></svg>
          </IconBtn>
        </div>
        <span style={{ fontSize: 12, color: "#82828b", fontWeight: 500, marginLeft: 8 }}>GMT+3</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#82828b", marginBottom: 28 }}>
        <span>2026</span>
        <span>2d 24h ahead</span>
      </div>

      {/* Price Range */}
      <div style={{ color: "#82828b", fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Price Range (USD)</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "#82828b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>MIN</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>$58,264</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "#00d65b", fontSize: 11, fontWeight: 700 }}>Now</span>
          <span style={{ color: "#00d65b", fontSize: 12, fontWeight: 600 }}>$66,248</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "#82828b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>MAX</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>$73,318</span>
        </div>
      </div>

      {/* Slider */}
      <div style={{ position: "relative", height: 24, display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div style={{ width: "100%", height: 6, background: "#2a2a2a", borderRadius: 3, position: "absolute" }} />
        <div style={{ position: "absolute", left: "33.33%", width: 2, height: 16, background: "#00d65b", transform: "translateX(-50%)", zIndex: 1 }} />
        <div style={{ position: "absolute", left: "25.30%", width: 16, height: 16, borderRadius: "50%", border: "2px solid #632eff", background: "#0b0b0b", display: "flex", alignItems: "center", justifyContent: "center", transform: "translateX(-50%)", zIndex: 2 }}>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#632eff" }} />
        </div>
        <div style={{ position: "absolute", left: "40.45%", width: 16, height: 16, borderRadius: "50%", border: "2px solid #632eff", background: "#0b0b0b", display: "flex", alignItems: "center", justifyContent: "center", transform: "translateX(-50%)", zIndex: 2 }}>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#632eff" }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#7b7b84", fontSize: 11, marginBottom: 28 }}>
        <span>$33,124</span>
        <span>$132,496</span>
      </div>

      {/* Input */}
      <div style={{
        background: "#161616",
        border: "1px solid #262626",
        borderRadius: 8,
        padding: "20px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
      }}>
        <span style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>100</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#82828b", fontSize: 15, fontWeight: 500 }}>USDC</span>
          <span style={{ color: "#632eff", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>MAX</span>
        </div>
      </div>

      {/* Multipliers */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#82828b", fontSize: 14, fontWeight: 500, marginBottom: 24, cursor: "pointer" }}>
        <span>Bet Multipliers & Fees</span>
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: "#82828b", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}><path d="M6 9l6 6 6-6"/></svg>
      </div>

      {/* Warning */}
      <div style={{
        background: "rgba(223,166,34,0.05)",
        border: "1px solid #463815",
        borderRadius: 8,
        padding: "14px 16px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        marginBottom: 24,
      }}>
        <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: "#dfa622", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round", flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div style={{ color: "#dfa622", fontSize: 13.5, lineHeight: 1.4, fontWeight: 500 }}>
          Prediction markets carry risk. Only deposit what you can afford to lose.
        </div>
      </div>

      {/* Place Bet */}
      <button style={{
        width: "100%",
        background: "#632eff",
        color: "#fff",
        border: "none",
        padding: 16,
        borderRadius: 8,
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        marginBottom: 16,
      }}>Place Bet</button>
      <div style={{ textAlign: "center", color: "#82828b", fontSize: 13 }}>Balance: 999.00 USDC</div>
    </div>
  );
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button style={{
      width: 26,
      height: 26,
      background: "#222",
      borderRadius: 6,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#82828b",
      cursor: "pointer",
      border: "none",
      padding: 0,
    }}>
      {children}
    </button>
  );
}
