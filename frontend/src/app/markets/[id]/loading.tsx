export default function Loading() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center">
      <img src="/predensity-logo.png" alt="Predensity" width={64} height={64} className="mb-5 animate-pulse hidden dark:block" />
      <img src="/white the loading predensity logo.png" alt="Predensity" width={64} height={64} className="mb-5 animate-pulse dark:hidden" />
      <span className="text-gray-900 dark:text-white text-2xl font-semibold tracking-wide">
        predensity
      </span>
    </div>
  );
}
