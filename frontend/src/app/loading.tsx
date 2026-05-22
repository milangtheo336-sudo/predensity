export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex items-center gap-3 animate-pulse">
        <img
          src="/predensity-logo.png"
          alt="Predensity"
          width={40}
          height={40}
          className="rounded-md"
        />
        <span className="text-white text-xl font-semibold tracking-tight">
          Predensity
        </span>
      </div>
    </div>
  );
}
