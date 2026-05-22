'use client';

import Link from 'next/link';
import { Button } from './ui';

export default function NoBetsPage() {
  return (
    <div className="my-12 w-full items-center space-y-8 px-6 md:flex md:flex-col">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-text-high-em">
          You haven&apos;t placed any bets yet.{' '}
        </h1>
        <p className="text-text-low-em">Check out the markets and place a bet.</p>
      </div>
      <Link href="/">
        <Button size="lg" className="text-white">
          Return to bet
        </Button>
      </Link>
    </div>
  );
}
