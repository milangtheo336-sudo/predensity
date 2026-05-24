export default function Loading() {
  return (
    <div
      style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <img src="/predensity-logo.png" alt="Predensity" width={64} height={64} style={{ marginBottom: 20, animation: 'pulse 1.8s ease-in-out infinite' }} />
      <span style={{ color: '#fff', fontSize: 22, fontWeight: 600, letterSpacing: 3 }}>
        predensity
      </span>
      <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.94)} }`}</style>
    </div>
  );
}
