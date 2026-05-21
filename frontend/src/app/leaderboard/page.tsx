'use client';

import { Header } from '@/components/header';
import { LeaderboardComponent } from '@/components/leaderboard-page';

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <LeaderboardComponent />
      </main>
    </div>
  );
}
