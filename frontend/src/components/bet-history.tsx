'use client';
import { useState, useMemo } from 'react';
import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

import type { Bet } from '@/lib/types';
import { formatAddress, formatDateUTC, formatTinybarsToHbar, formatPriceByAsset } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

const LIMIT = 10;

interface BetHistoryProps {
  className?: string;
  contractAddress?: string;
  asset?: string;
}

export function BetHistory({ className, contractAddress, asset = 'HBAR' }: BetHistoryProps) {
  const [page, setPage] = useState(1);

  const allBets = useConvexQuery(
    api.sync.getBetsByMarket,
    contractAddress ? { marketId: contractAddress.toLowerCase() } : 'skip'
  );

  const filteredBets = useMemo(() => {
    if (!allBets) return [];
    return allBets
      .filter((b: any) => b.status !== 'failed' && (!asset || b.asset === asset))
      .sort((a: any, b: any) => b.timestamp - a.timestamp);
  }, [allBets, asset]);

  const totalPages = Math.ceil(filteredBets.length / LIMIT);
  const pageBets = filteredBets.slice((page - 1) * LIMIT, page * LIMIT);
  const hasNext = page < totalPages;

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-medium text-medium-gray">User</th>
              <th className="text-left py-3 px-4 font-medium text-medium-gray">Amount</th>
              <th className="text-left py-3 px-4 font-medium text-medium-gray">Range</th>
              <th className="text-left py-3 px-4 font-medium text-medium-gray">Date, UTC</th>
            </tr>
          </thead>
          <tbody>
            {!allBets && (
              <tr>
                <td colSpan={4} className="text-light-gray text-left py-4">
                  Loading...
                </td>
              </tr>
            )}

            {allBets && filteredBets.length === 0 && (
              <tr>
                <td colSpan={4} className="text-light-gray text-center py-8">
                  No bets found
                </td>
              </tr>
            )}

            {pageBets.map((bet: any) => (
              <tr key={bet.betId} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-dark-slate/50">
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-3">
                    <Tooltip content={bet.userAddress}>
                      <span className="text-sm font-mono text-light-gray">
                        {formatAddress(bet.userAddress, 2)}
                      </span>
                    </Tooltip>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-light-gray">
                  {formatTinybarsToHbar(bet.stake, 3)}
                </td>
                <td className="py-3 px-4 text-sm text-light-gray">
                  ${formatPriceByAsset(bet.priceMin, asset)} - $
                  {formatPriceByAsset(bet.priceMax, asset)}
                </td>
                <td className="py-3 px-4 text-sm text-medium-gray">
                  {formatDateUTC(Math.floor(bet.timestamp / 1000))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <Button
          variant="outline"
          size="sm"
          className="border-vibrant-purple text-vibrant-purple hover:bg-vibrant-purple hover:text-white"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          &lt; Prev
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="border-vibrant-purple text-vibrant-purple hover:bg-vibrant-purple hover:text-white"
          disabled={!hasNext}
          onClick={() => setPage((p) => p + 1)}
        >
          Next &gt;
        </Button>
      </div>
    </div>
  );
}
