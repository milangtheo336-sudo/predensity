export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <img
        src="/predensity-logo.png"
        alt="Predensity"
        width={64}
        height={64}
        className="mb-5 animate-pulse"
      />
      <span className="text-white text-2xl font-semibold tracking-wide">
        predensity
      </span>
    </div>
  );
}
