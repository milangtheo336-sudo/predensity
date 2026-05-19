'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useMagic } from '@/context/MagicContext';
import { useMutation, useQuery as useConvexQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  useWallet,
  useWriteContract,
  useWatchTransactionReceipt,
  useReadContract,
} from '@buidlerlabs/hashgraph-react-wallets';
import { parseUnits } from 'ethers/lib/utils';
import { ethers } from 'ethers';
import { Calendar, RefreshCw } from 'lucide-react';

import type { Bet } from '@/lib/types';
import { Category, CATEGORIES } from '@/lib/types/categories';
import { getContractId, getContractAddress, isCategoryDeployed, getStakingCurrency, isTokenMode, getOnChainBucket } from '@/lib/contracts/contract-config';

import { formatDateUTC, formatTinybarsToHbar, getLocalTimezoneAbbr } from '@/lib/utils';

import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/useToast';
import { Toaster } from '@/components/ui/toaster';
import NoWalletConnectedContainer from '@/components/no-wallet-connected-container';
import CryptoPredictionMarketABI from '../../../abi/CryptoPredictionMarket.json';

// Old ABIs removed -- politics/sports/tech now use CLOB system
const PoliticsPredictionMarketABI = { abi: [] as any[] };
const SportsPredictionMarketABI = { abi: [] as any[] };
const TechnologyPredictionMarketABI = { abi: [] as any[] };

export default function AdminPageWrapper() {
  return (
    <AdminPage />
  );
}

// Event Creation Form Component
interface EventCreationFormProps {
  category: Category;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

// Events List Component
interface EventsListProps {
  category: Category;
}

// Event Resolution Section Component
interface EventResolutionSectionProps {
  category: Category;
  contractId: string;
}

function EventResolutionSection({ category, contractId }: EventResolutionSectionProps) {
  const events = useConvexQuery(api.events.getEventsByCategory, { category });
  const { writeContract } = useWriteContract();
  const { watch } = useWatchTransactionReceipt();
  const { toast } = useToast();
  const resolveEventMutation = useMutation(api.events.resolveEvent);
  
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [resolutionValue, setResolutionValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter unresolved events
  const unresolvedEvents = events?.filter(event => !event.resolved) || [];

  const handleSubmitResolution = async () => {
    if (!selectedEventId || !resolutionValue) {
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description: 'Please select an event and enter a resolution value',
      });
      return;
    }

    const selectedEvent = unresolvedEvents.find(e => e.eventId === selectedEventId);
    if (!selectedEvent) {
      toast({
        variant: 'destructive',
        title: 'Event not found',
        description: 'The selected event could not be found',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      toast({
        variant: 'default',
        title: 'Submitting resolution...',
        description: 'Please confirm the transaction in your wallet',
      });

      // Parse the value based on category
      const parsedValue = parseFloat(resolutionValue);
      if (isNaN(parsedValue)) {
        throw new Error('Invalid resolution value');
      }

      let result;
      
      if (category === Category.POLITICS) {
        result = await writeContract({
          contractId: contractId,
          abi: PoliticsPredictionMarketABI.abi,
          functionName: 'submitPoliticalResult',
          args: [selectedEventId, Math.floor(parsedValue)],
          metaArgs: {
            gas: 3000000,
          },
        });
      } else if (category === Category.SPORTS) {
        result = await writeContract({
          contractId: contractId,
          abi: SportsPredictionMarketABI.abi,
          functionName: 'submitSportsResult',
          args: [selectedEventId, Math.floor(parsedValue)],
          metaArgs: {
            gas: 3000000,
          },
        });
      } else if (category === Category.TECHNOLOGY) {
        result = await writeContract({
          contractId: contractId,
          abi: TechnologyPredictionMarketABI.abi,
          functionName: 'submitTechResult',
          args: [selectedEventId, Math.floor(parsedValue)],
          metaArgs: {
            gas: 3000000,
          },
        });
      }

      // Watch the transaction
      watch(result as string, {
        onSuccess: (transaction) => {
          console.log('Resolution transaction successful:', transaction);
          
          // Update Convex database
          resolveEventMutation({
            eventId: selectedEventId,
            actualValue: Math.floor(parsedValue),
          })
            .then(() => {
              console.log('Event resolution stored in Convex');
            })
            .catch((err) => {
              console.error('Failed to store resolution in Convex:', err);
            });
          
          toast({
            variant: 'success',
            title: 'Event resolved!',
            description: 'The event has been resolved successfully',
          });

          setSelectedEventId('');
          setResolutionValue('');
          setIsSubmitting(false);
          return transaction;
        },
        onError: (receipt, error) => {
          console.error('Resolution failed:', receipt, error);
          toast({
            variant: 'destructive',
            title: 'Failed to resolve event',
            description: typeof error === 'string' ? error : 'Transaction failed',
          });
          setIsSubmitting(false);
          return receipt;
        },
      });
    } catch (err) {
      console.error('Error submitting resolution:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to submit resolution',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
      });
      setIsSubmitting(false);
    }
  };

  if (!events) {
    return null;
  }

  if (unresolvedEvents.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white dark:bg-neutral-950/50 border-white/10">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Resolve Events</h3>
        <p className="text-sm text-gray-400 mb-4">
          Submit actual results for events that have occurred
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
              Select Event <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-predensity-purple"
            >
              <option value="">Choose an event...</option>
              {unresolvedEvents.map((event) => (
                <option key={event._id} value={event.eventId}>
                  {event.eventName} - {new Date(event.eventTimestamp * 1000).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
              Actual Value <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              value={resolutionValue}
              onChange={(e) => setResolutionValue(e.target.value)}
              placeholder={getValuePlaceholder(category)}
              className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
            />
            <p className="text-xs text-gray-400 mt-1">
              {getValueHint(category)}
            </p>
          </div>

          <Button
            variant="predensity"
            onClick={handleSubmitResolution}
            disabled={isSubmitting || !selectedEventId || !resolutionValue}
            className="w-full"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Resolution'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions for value formatting hints
function getValuePlaceholder(category: Category): string {
  switch (category) {
    case Category.POLITICS:
      return 'e.g., 5250 for 52.50% or 312 for electoral votes';
    case Category.SPORTS:
      return 'e.g., 105 for final score or 5500 for 55% possession';
    case Category.TECHNOLOGY:
      return 'e.g., 500000 for $5000.00 (with 2 decimals)';
    default:
      return 'Enter the actual value';
  }
}

function getValueHint(category: Category): string {
  switch (category) {
    case Category.POLITICS:
      return 'For percentages: use BPS (0-10000 = 0-100%). For counts: use raw numbers.';
    case Category.SPORTS:
      return 'For scores: use raw numbers. For percentages: use BPS (0-10000 = 0-100%).';
    case Category.TECHNOLOGY:
      return 'Use the value with decimals applied. E.g., $50.00 with 2 decimals = 5000.';
    default:
      return '';
  }
}

function EventsList({ category }: EventsListProps) {
  const events = useConvexQuery(api.events.getEventsByCategory, { category });

  if (!events) {
    return (
      <Card className="bg-white dark:bg-neutral-950/50 border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-predensity-purple border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="bg-white dark:bg-neutral-950/50 border-white/10">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <p className="text-gray-400">No events created yet</p>
            <p className="text-sm text-gray-500 mt-1">Create your first event to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-neutral-950/50 border-white/10">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Events</h3>
        <div className="space-y-3">
          {events.slice(0, 5).map((event) => (
            <div
              key={event._id}
              className="p-4 bg-gray-100 dark:bg-neutral-800/50 border border-gray-200 dark:border-white/10 rounded-lg hover:border-white/20 transition-colors"
            >
              <div className="flex items-start gap-4">
                {event.imageUrl && (
                  <img
                    src={event.imageUrl}
                    alt={event.eventName}
                    className="w-20 h-20 object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-gray-900 dark:text-white font-medium truncate">{event.eventName}</h4>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">{event.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>
                      {new Date(event.eventTimestamp * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {event.resolved ? (
                      <span className="text-green-500">Resolved</span>
                    ) : (
                      <span className="text-yellow-500">Pending</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {events.length > 5 && (
          <p className="text-sm text-gray-400 text-center mt-4">
            Showing 5 of {events.length} events
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EventCreationForm({ category, onSubmit, onCancel, isSubmitting }: EventCreationFormProps) {
  const [formData, setFormData] = useState<any>({
    eventName: '',
    eventTimestamp: '',
    imageUrl: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Common Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            Event Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.eventName}
            onChange={(e) => updateField('eventName', e.target.value)}
            placeholder="e.g., 2024 US Presidential Election"
            className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            Event Date & Time <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            required
            value={formData.eventTimestamp}
            onChange={(e) => updateField('eventTimestamp', e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-predensity-purple"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            Image URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            required
            value={formData.imageUrl}
            onChange={(e) => updateField('imageUrl', e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
          />
          <p className="text-xs text-gray-400 mt-1">
            Recommended: 1200x630px, JPEG/PNG, max 2MB
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Describe the event and what users will be predicting..."
            rows={3}
            className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple resize-none"
          />
        </div>
      </div>

      {/* Category-Specific Fields */}
      {category === Category.POLITICS && <PoliticsEventFields formData={formData} updateField={updateField} />}
      {category === Category.SPORTS && <SportsEventFields formData={formData} updateField={updateField} />}
      {category === Category.TECHNOLOGY && <TechnologyEventFields formData={formData} updateField={updateField} />}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-white/10">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/5"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="predensity"
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? 'Creating...' : 'Create Event'}
        </Button>
      </div>
    </form>
  );
}

// Politics Event Fields
function PoliticsEventFields({ formData, updateField }: any) {
  return (
    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-white/10">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Politics-Specific Fields</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
          Candidate/Subject <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.candidate || ''}
          onChange={(e) => updateField('candidate', e.target.value)}
          placeholder="e.g., Donald Trump"
          className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
          Prediction Type <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={formData.predictionType || ''}
          onChange={(e) => updateField('predictionType', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-predensity-purple"
        >
          <option value="">Select type...</option>
          <option value="0">Vote Percentage</option>
          <option value="1">Electoral Votes</option>
          <option value="2">Approval Rating</option>
          <option value="3">Poll Average</option>
          <option value="4">Voter Turnout</option>
          <option value="5">Seat Count</option>
          <option value="6">Delegate Count</option>
        </select>
      </div>
    </div>
  );
}

// Sports Event Fields
function SportsEventFields({ formData, updateField }: any) {
  return (
    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-white/10">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sports-Specific Fields</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            Team 1 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.team1 || ''}
            onChange={(e) => updateField('team1', e.target.value)}
            placeholder="e.g., Lakers"
            className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            Team 2 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.team2 || ''}
            onChange={(e) => updateField('team2', e.target.value)}
            placeholder="e.g., Warriors"
            className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
          Player (Optional)
        </label>
        <input
          type="text"
          value={formData.player || ''}
          onChange={(e) => updateField('player', e.target.value)}
          placeholder="e.g., LeBron James (leave empty for team predictions)"
          className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
          Sport Type <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={formData.sportType || ''}
          onChange={(e) => updateField('sportType', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-predensity-purple"
        >
          <option value="">Select sport...</option>
          <option value="0">Basketball</option>
          <option value="1">American Football</option>
          <option value="2">Soccer</option>
          <option value="3">Baseball</option>
          <option value="4">Hockey</option>
          <option value="5">Tennis</option>
          <option value="6">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
          Prediction Type <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={formData.predictionType || ''}
          onChange={(e) => updateField('predictionType', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-predensity-purple"
        >
          <option value="">Select type...</option>
          <option value="0">Final Score</option>
          <option value="1">Point Differential</option>
          <option value="2">Player Points</option>
          <option value="3">Player Assists</option>
          <option value="4">Player Rebounds</option>
          <option value="5">Team Possession</option>
          <option value="6">Shots on Goal</option>
          <option value="7">Total Goals</option>
          <option value="8">Total Yards</option>
          <option value="9">Completion Percentage</option>
        </select>
      </div>
    </div>
  );
}

// Technology Event Fields
function TechnologyEventFields({ formData, updateField }: any) {
  return (
    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-white/10">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Technology-Specific Fields</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
          Company <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.company || ''}
          onChange={(e) => updateField('company', e.target.value)}
          placeholder="e.g., Reddit Inc."
          className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
          Prediction Type <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={formData.predictionType || ''}
          onChange={(e) => updateField('predictionType', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-predensity-purple"
        >
          <option value="">Select type...</option>
          <option value="0">IPO Valuation</option>
          <option value="1">Stock Price</option>
          <option value="2">Market Cap</option>
          <option value="3">Revenue</option>
          <option value="4">User Count</option>
          <option value="5">App Downloads</option>
          <option value="6">Growth Rate</option>
          <option value="7">Profit Margin</option>
          <option value="8">Customer Count</option>
          <option value="9">Transaction Volume</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
          Decimals <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          required
          min="0"
          max="18"
          value={formData.decimals || '2'}
          onChange={(e) => updateField('decimals', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-predensity-purple"
        />
        <p className="text-xs text-gray-400 mt-1">
          Use 2 for currency (USD), 0 for counts, 18 for large numbers
        </p>
      </div>
    </div>
  );
}

// CLOB Markets Display Component
function ClobMarketsDisplay({ category }: { category: Category }) {
  const { toast } = useToast();
  const [selectedMarketForElimination, setSelectedMarketForElimination] = useState<string | null>(null);
  const [selectedMarketForResolution, setSelectedMarketForResolution] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch CLOB markets for current category
  const allClobMarkets = useConvexQuery(api.clob.getClobMarkets, {});
  const clobMarkets = useMemo(() => {
    if (!allClobMarkets) return [];
    // Filter by category - show all for crypto, filter for others
    if (category === Category.CRYPTO) return allClobMarkets;
    return allClobMarkets.filter((m: any) => m.category === category.toLowerCase());
  }, [allClobMarkets, category]);

  const handleEliminateOutcome = async (marketId: string, outcomeIndex: number) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/clob/eliminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId, outcomeIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to eliminate outcome');
      toast({ title: 'Outcome eliminated', description: 'The outcome has been marked as eliminated' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to eliminate', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsProcessing(false);
      setSelectedMarketForElimination(null);
    }
  };

  const handleResolveMarket = async (marketId: string, winningOutcome: number) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/clob/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId, winningOutcome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve market');
      toast({ title: 'Market resolved', description: 'The market has been fully resolved' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to resolve', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsProcessing(false);
      setSelectedMarketForResolution(null);
    }
  };

  if (!clobMarkets) {
    return <div className="text-center py-8 text-gray-400">Loading markets...</div>;
  }

  if (clobMarkets.length === 0) {
    return <div className="text-center py-8 text-gray-400">No CLOB markets created yet</div>;
  }

  return (
    <div className="space-y-4 mt-4">
      {clobMarkets.map((market: any) => {
        const eliminated = market.eliminatedOutcomes || [];
        const activeOutcomes = market.numOutcomes - eliminated.length;
        return (
          <div key={market.marketId} className="p-4 bg-gray-50 dark:bg-neutral-900/50 border border-gray-200 dark:border-white/10 rounded-lg">
            <div className="flex items-start gap-4">
              {market.imageUrl && (
                <img src={market.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-gray-900 dark:text-white font-semibold">{market.question}</h4>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="capitalize">{market.category}</span>
                  <span>{market.numOutcomes} outcomes</span>
                  {eliminated.length > 0 && (
                    <span className="text-red-500">{eliminated.length} eliminated</span>
                  )}
                  <span className={market.resolved ? 'text-green-500' : 'text-yellow-500'}>
                    {market.resolved ? 'Resolved' : 'Open'}
                  </span>
                  <span>${market.totalVolume.toFixed(2)} vol</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {market.outcomeNames.map((name: string, idx: number) => {
                    const isEliminated = eliminated.includes(idx);
                    const isWinner = market.resolved && market.winningOutcome === idx;
                    return (
                      <span
                        key={idx}
                        className={`text-xs px-2 py-1 rounded ${
                          isWinner
                            ? 'bg-green-500 text-white font-semibold'
                            : isEliminated
                            ? 'bg-gray-200 dark:bg-neutral-800 text-gray-400 line-through'
                            : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {name}
                        {isEliminated && ' ✕'}
                        {isWinner && ' ✓'}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {!market.resolved && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedMarketForElimination(market.marketId)}
                      disabled={isProcessing || activeOutcomes <= 1}
                      className="text-xs"
                    >
                      Eliminate Outcome
                    </Button>
                    <Button
                      size="sm"
                      variant="predensity"
                      onClick={() => setSelectedMarketForResolution(market.marketId)}
                      disabled={isProcessing}
                      className="text-xs"
                    >
                      Resolve Market
                    </Button>
                  </>
                )}
                {market.resolved && (
                  <>
                    <span className="text-xs text-green-500 font-semibold">Resolved</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setIsProcessing(true);
                        try {
                          const res = await fetch('/api/clob/unresolve', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ marketId: market.marketId }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Failed to un-resolve');
                          toast({ title: 'Market un-resolved', description: 'The market is now open again' });
                        } catch (err) {
                          toast({ variant: 'destructive', title: 'Failed', description: err instanceof Error ? err.message : 'Unknown error' });
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                      disabled={isProcessing}
                      className="text-xs"
                    >
                      Un-Resolve
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Elimination Modal */}
            {selectedMarketForElimination === market.marketId && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-white/10 rounded-lg max-w-md w-full p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Eliminate Outcome</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select an outcome to eliminate. The market will stay open for remaining outcomes.
                  </p>
                  <div className="space-y-2 mb-4">
                    {market.outcomeNames.map((name: string, idx: number) => {
                      const isEliminated = eliminated.includes(idx);
                      if (isEliminated) return null;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleEliminateOutcome(market.marketId, idx)}
                          disabled={isProcessing}
                          className="w-full p-3 text-left bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-white/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <span className="text-sm text-gray-900 dark:text-white font-medium">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedMarketForElimination(null)}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Resolution Modal */}
            {selectedMarketForResolution === market.marketId && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-white/10 rounded-lg max-w-md w-full p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resolve Market</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select the final winning outcome. This will close the market permanently.
                  </p>
                  <div className="space-y-2 mb-4">
                    {market.outcomeNames.map((name: string, idx: number) => {
                      const isEliminated = eliminated.includes(idx);
                      if (isEliminated) return null;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleResolveMarket(market.marketId, idx)}
                          disabled={isProcessing}
                          className="w-full p-3 text-left bg-gray-50 dark:bg-neutral-900 hover:bg-green-50 dark:hover:bg-green-500/10 border border-gray-200 dark:border-white/10 hover:border-green-500 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <span className="text-sm text-gray-900 dark:text-white font-medium">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedMarketForResolution(null)}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AdminPage() {
  const { user, isLoading, logout } = useMagic();
  const isSignedIn = !!user;
  const isLoaded = !isLoading;
  
  // Check if user is admin (based on email)
  const adminEmails = ['mwangihenry336@gmail.com', 'warukirahenry336@gmail.com'];
  const isAdmin = user && adminEmails.includes(user.email);

  // Wallet connection
  const { isConnected } = useWallet();
  const { writeContract } = useWriteContract();
  const { watch } = useWatchTransactionReceipt();
  const { readContract } = useReadContract();

  // Convex mutations
  const createEventMutation = useMutation(api.events.createEvent);

  // Toast notifications
  const { toast } = useToast();

  // State management
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.CRYPTO);
  const [currentContractId, setCurrentContractId] = useState<string>(getContractId(Category.CRYPTO));
  const [resolutionPrices, setResolutionPrices] = useState<Map<string, [number, number][]>>(new Map());
  const [manualPrices, setManualPrices] = useState<Map<string, string>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tick counter that increments every 60s so the price-fetch effect re-runs
  // and picks up bets whose resolution time has just passed.
  const [priceTick, setPriceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setPriceTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);
  const [selectedBucket, setSelectedBucket] = useState<string>('all');
  
  // Event creation state
  const [showEventModal, setShowEventModal] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // Crypto market creation state
  const [showCryptoMarketModal, setShowCryptoMarketModal] = useState(false);

  // CLOB market creation state
  const [showClobMarketModal, setShowClobMarketModal] = useState(false);
  const [showClobResolveModal, setShowClobResolveModal] = useState(false);
  const [isCreatingClobMarket, setIsCreatingClobMarket] = useState(false);
  const [clobMarketForm, setClobMarketForm] = useState({
    question: '',
    category: 'politics',
    outcomeNames: ['Yes', 'No'],
    imageUrl: '',
    description: '',
    resolutionTimestamp: '',
  });
  const [cryptoMarketForm, setCryptoMarketForm] = useState({
    tokenSymbol: '',
    tokenName: '',
    priceDecimals: 8,
    imageUrl: '',
    description: '',
  });
  const createCryptoMarketMutation = useMutation(api.events.createCryptoMarket);
  const finalizeBetsMutation = useMutation(api.sync.finalizeBetsForBucket);
  const updateBetOnChainIdMutation = useMutation(api.sync.updateBetOnChainId);

  // Protocol fee state
  const [feeData, setFeeData] = useState<Record<string, { fees: string; balance: string; isOwner: boolean; loading: boolean }>>({});
  const [isWithdrawing, setIsWithdrawing] = useState<string | null>(null);

  // Fetch fee data for all deployed contracts
  const fetchFeeData = async () => {
    if (!readContract || !isConnected) return;
    const categories = Object.values(CATEGORIES).filter(c => c.enabled && isCategoryDeployed(c.id));
    const results: Record<string, { fees: string; balance: string; isOwner: boolean; loading: boolean }> = {};

    for (const cat of categories) {
      const addr = getContractAddress(cat.id);
      const abi = cat.id === Category.CRYPTO ? CryptoPredictionMarketABI.abi : 
                  cat.id === Category.POLITICS ? PoliticsPredictionMarketABI.abi :
                  cat.id === Category.SPORTS ? SportsPredictionMarketABI.abi : TechnologyPredictionMarketABI.abi;
      try {
        const [fees, owner] = await Promise.all([
          readContract({ address: addr, abi, functionName: 'totalFeesCollected', args: [] }),
          readContract({ address: addr, abi, functionName: 'owner', args: [] }),
        ]);
        // Hedera RPC does not support eth_getBalance via the wallet SDK, so we show fees only
        results[cat.id] = {
          fees: fees ? (isTokenMode() ? (Number(fees.toString()) / Math.pow(10, getStakingCurrency().decimals)).toString() : ethers.utils.formatEther(fees.toString())) : '0',
          balance: '--',
          isOwner: owner ? owner.toString().toLowerCase() === (window as any)?.ethereum?.selectedAddress?.toLowerCase() : true,
          loading: false,
        };
      } catch {
        results[cat.id] = { fees: '0', balance: '--', isOwner: false, loading: false };
      }
    }
    setFeeData(results);
  };

  useEffect(() => {
    if (isConnected && isAdmin) fetchFeeData();
  }, [isConnected, isAdmin, readContract]);

  const handleWithdrawFees = async (category: Category) => {
    const contractId = getContractId(category);
    const abi = category === Category.CRYPTO ? CryptoPredictionMarketABI.abi :
                category === Category.POLITICS ? PoliticsPredictionMarketABI.abi :
                category === Category.SPORTS ? SportsPredictionMarketABI.abi : TechnologyPredictionMarketABI.abi;
    setIsWithdrawing(category);
    try {
      const result = await writeContract({
        contractId,
        abi,
        functionName: 'withdrawFees',
        args: [],
        metaArgs: { gas: 300000 },
      });
      toast({ variant: 'default', title: 'Withdrawing fees...', description: 'Confirm in your wallet' });
      watch(result as string, {
        onSuccess: (tx: any) => {
          toast({ variant: 'success', title: 'Fees withdrawn', description: `TX: ${tx?.transaction_id || 'confirmed'}` });
          setIsWithdrawing(null);
          fetchFeeData();
          return tx;
        },
        onError: (r: any, e: any) => {
          toast({ variant: 'destructive', title: 'Withdrawal failed', description: typeof e === 'string' ? e : 'Transaction failed' });
          setIsWithdrawing(null);
          return r;
        },
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Withdrawal failed', description: err instanceof Error ? err.message : 'Unknown error' });
      setIsWithdrawing(null);
    }
  };

  // Update contract ID when category changes
  useEffect(() => {
    setCurrentContractId(getContractId(selectedCategory));
    setSelectedBucket('all');
    setResolutionPrices(new Map());
    setManualPrices(new Map());
  }, [selectedCategory]);

  // Fetch bets from Convex instead of subgraph
  const convexBetsRaw = useConvexQuery(
    api.sync.getUnfinalizedBetsByMarket,
    isLoaded && isSignedIn && isAdmin
      ? { marketId: getContractAddress(selectedCategory).toLowerCase() }
      : 'skip'
  );

  // Also fetch ALL bets (including finalized) for the Sync Results to DB button
  const allConvexBetsRaw = useConvexQuery(
    api.sync.getAllBetsByMarket,
    isLoaded && isSignedIn && isAdmin
      ? { marketId: getContractAddress(selectedCategory).toLowerCase() }
      : 'skip'
  );
  const loading = !!(convexBetsRaw === undefined && isLoaded && isSignedIn && isAdmin);
  const refetch = () => {}; // Convex auto-updates in real time

  // Map Convex bets to the Bet interface shape used by the rest of the admin page
  const data = convexBetsRaw
    ? {
        bets: convexBetsRaw.map((b: any) => ({
          id: b.betId,
          stake: b.stake,
          priceMin: b.priceMin,
          priceMax: b.priceMax,
          timestamp: typeof b.timestamp === 'number' && b.timestamp > 1e12 ? Math.floor(b.timestamp / 1000) : b.timestamp,
          targetTimestamp: b.targetTimestamp,
          bucket: b.bucket ?? 0,
          finalized: b.finalized,
          won: b.won,
          claimed: b.claimed,
          payout: Number(b.payout || 0),
          expectedPayout: Number(b.expectedPayout || 0),
          weight: Number(b.weight || 0),
          qualityBps: b.qualityBps,
          asset: b.asset,
          user: { id: b.userAddress, bets: [], totalBets: 0, totalStaked: 0, totalPayout: 0 },
          market: { id: b.marketId, category: b.category },
          bucketRef: undefined,
        })),
      }
    : null;

  // Get available buckets for filtering
  const allBets = data?.bets ?? [];
  const availableBuckets: string[] = allBets.length > 0
    ? Array.from(new Set<string>(allBets.map((bet: Bet) => bet.bucket.toString()))).sort(
        (a, b) => Number(a) - Number(b)
      )
    : [];

  // Filter bets by selected bucket
  const filteredBets = allBets.length > 0
    ? selectedBucket === 'all'
      ? allBets
      : allBets.filter((bet: Bet) => bet.bucket.toString() === selectedBucket)
    : [];

  // Stable fingerprint of bet IDs so the price-fetch effect doesn't re-fire on every Convex tick
  const betFingerprint = allBets.map((b: Bet) => b.id).sort().join(',');

  // Format a bucket value for display. Per-timestamp buckets are Unix timestamps
  // (large numbers), legacy day-based buckets are small integers (0, 1, 2, ...).
  const formatBucketLabel = (bucket: number | string): string => {
    const n = Number(bucket);
    if (n > 1_000_000) return new Date(n * 1000).toLocaleString();
    return `Bucket ${bucket}`;
  };

  // Infer asset from price range when the asset field is missing.
  // Prices are stored with 8 decimals, so dividing by 1e8 gives the USD price.
  // BTC: ~$30k-$150k, ETH: ~$1k-$10k, SOL: ~$10-$500, HBAR: ~$0.01-$1
  const inferAssetFromPrice = (bet: Bet): string => {
    if ((bet as any).asset) return (bet as any).asset;
    const midPrice = (Number(bet.priceMin) + Number(bet.priceMax)) / 2 / 1e8;
    if (midPrice > 10000) return 'BTC';
    if (midPrice > 500) return 'ETH';
    if (midPrice > 5) return 'SOL';
    return 'HBAR';
  };

  useEffect(() => {
    console.log(`[admin-prices] Effect check: isLoaded=${isLoaded}, isSignedIn=${isSignedIn}, isAdmin=${isAdmin}, loading=${loading}, bets=${allBets.length}, category=${selectedCategory}`);
    if (!isLoaded || !isSignedIn || !isAdmin || loading) return;
    if (allBets.length === 0) return;
    // Only fetch CoinGecko prices for crypto category
    if (selectedCategory !== Category.CRYPTO) return;

    console.log(`[admin-prices] Fetching prices for ${allBets.length} bets, fingerprint: ${betFingerprint.slice(0, 50)}...`);

    const fetchPrices = async () => {
      try {
        // Group bets by asset symbol so we fetch the correct price for each
        const assetSet: Record<string, number[]> = {};
        for (const bet of allBets) {
          const asset = inferAssetFromPrice(bet);
          if (!assetSet[asset]) assetSet[asset] = [];
          assetSet[asset].push(bet.targetTimestamp);
        }

        const priceMap = new Map<string, [number, number][]>();

        const assets = Object.keys(assetSet);
        for (const asset of assets) {
          const timestamps = assetSet[asset];
          const rawStart = Math.min(...timestamps);
          const rawEnd = Math.max(...timestamps);
          const nowSec = Math.floor(Date.now() / 1000);

          // Only fetch prices for past resolution times
          // Use the earliest past timestamp as start, capped end to now
          const pastTimestamps = timestamps.filter(t => t <= nowSec);
          if (pastTimestamps.length === 0) continue; // all bets still in the future

          const start = Math.min(...pastTimestamps) - 7200; // 2 hours before earliest
          const end = Math.min(Math.max(...pastTimestamps) + 7200, nowSec); // 2 hours after latest, capped to now

          if (start >= end) continue; // safety guard

          try {
            const res = await fetch(`/api/hbar-price?symbol=${asset}&from=${start}&to=${end}`);
            if (!res.ok) {
              console.error(`[admin] Price fetch failed for ${asset}: ${res.status}`);
              continue;
            }
            const data = await res.json();
            if (data.prices && data.prices.length > 0) {
              priceMap.set(asset, data.prices);
            } else {
              // CoinGecko range API may not have data for very recent timestamps.
              // Fall back to the current spot price as a close approximation.
              console.warn(`[admin] No historical data for ${asset} (${start}-${end}), trying spot price`);
              try {
                const spotRes = await fetch(`/api/hbar-price?symbol=${asset}`);
                if (spotRes.ok) {
                  const spotData = await spotRes.json();
                  if (typeof spotData.price === 'number') {
                    // Create synthetic data points at each past timestamp using the spot price
                    const syntheticPrices: [number, number][] = pastTimestamps.map(ts => [ts * 1000, spotData.price]);
                    priceMap.set(asset, syntheticPrices);
                    console.warn(`[admin] Using spot price $${spotData.price} for ${asset} as fallback`);
                  }
                }
              } catch (spotErr) {
                console.error(`[admin] Spot price fallback failed for ${asset}:`, spotErr);
              }
            }
          } catch (err) {
            console.error(`Error fetching ${asset} prices:`, err);
          }
        }

        setResolutionPrices(priceMap);
      } catch (err) {
        console.error('Error fetching prices:', err);
      }
    };

    fetchPrices();
  }, [isLoaded, loading, isSignedIn, isAdmin, betFingerprint, selectedCategory, priceTick]);

  const findClosestPrice = (timestamp: number, asset?: string): number | null => {
    // Do not return a price if the resolution time is still in the future
    const nowSec = Math.floor(Date.now() / 1000);
    if (timestamp > nowSec) return null;

    const assetKey = asset || 'HBAR';
    const prices = resolutionPrices.get(assetKey);
    if (!prices || !prices.length) {
      return null;
    }

    const targetMs = timestamp * 1000;
    let closest = prices[0];
    let minDiff = Math.abs(targetMs - closest[0]);

    for (let i = 1; i < prices.length; i++) {
      const [ts, price] = prices[i];
      const diff = Math.abs(ts - targetMs);
      if (diff < minDiff) {
        closest = [ts, price];
        minDiff = diff;
      }
    }

    // If the closest data point is more than 2 hours away, the data is unreliable
    if (minDiff > 7200 * 1000) return null;

    return closest?.[1] ?? null;
  };

  // Get final price (manual override or fetched)
  const getFinalPrice = (timestamp: number, asset?: string): number | null => {
    const assetKey = asset || 'HBAR';
    const manualPrice = manualPrices.get(`${assetKey}:${timestamp}`);

    if (manualPrice !== undefined) {
      const parsed = parseFloat(manualPrice);
      return isNaN(parsed) ? null : parsed;
    }

    return findClosestPrice(timestamp, asset);
  };

  // Handle manual price input
  const handlePriceChange = (key: string, value: string) => {
    if (value === '') {
      setManualPrices((prev) => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    } else {
      setManualPrices((prev) => new Map(prev).set(key, value));
    }
  };

  // Handle event creation
  const handleCreateEvent = async (eventData: any) => {
    setIsCreatingEvent(true);
    try {
      toast({
        variant: 'default',
        title: 'Creating event...',
        description: 'Please confirm the transaction in your wallet',
      });

      // Convert datetime-local to Unix timestamp
      const eventTimestamp = Math.floor(new Date(eventData.eventTimestamp).getTime() / 1000);

      let result;
      
      if (selectedCategory === Category.POLITICS) {
        // Call createPoliticalEvent
        result = await writeContract({
          contractId: currentContractId,
          abi: PoliticsPredictionMarketABI.abi,
          functionName: 'createPoliticalEvent',
          args: [
            eventData.eventName,
            eventData.candidate,
            parseInt(eventData.predictionType),
            eventTimestamp,
          ],
          metaArgs: {
            gas: 3000000,
          },
        });
      } else if (selectedCategory === Category.SPORTS) {
        // Call createSportsEvent
        result = await writeContract({
          contractId: currentContractId,
          abi: SportsPredictionMarketABI.abi,
          functionName: 'createSportsEvent',
          args: [
            eventData.eventName,
            eventData.team1,
            eventData.team2,
            eventData.player || '',
            parseInt(eventData.sportType),
            parseInt(eventData.predictionType),
            eventTimestamp,
          ],
          metaArgs: {
            gas: 3000000,
          },
        });
      } else if (selectedCategory === Category.TECHNOLOGY) {
        // Call createTechEvent
        result = await writeContract({
          contractId: currentContractId,
          abi: TechnologyPredictionMarketABI.abi,
          functionName: 'createTechEvent',
          args: [
            eventData.eventName,
            eventData.company,
            parseInt(eventData.predictionType),
            eventTimestamp,
            parseInt(eventData.decimals || '2'),
          ],
          metaArgs: {
            gas: 3000000,
          },
        });
      }

      // Watch the transaction
      watch(result as string, {
        onSuccess: (transaction) => {
          console.log('Event creation transaction successful:', transaction);
          
          // Store event metadata in Convex (off-chain data) -- fire and forget
          (async () => {
            try {
              const convexEventId = await createEventMutation({
                eventId: transaction.transaction_id || `${selectedCategory}-${Date.now()}`,
                category: selectedCategory,
                eventName: eventData.eventName,
                eventTimestamp: eventTimestamp,
                imageUrl: eventData.imageUrl,
                description: eventData.description,
                candidate: eventData.candidate,
                predictionType: eventData.predictionType,
                team1: eventData.team1,
                team2: eventData.team2,
                player: eventData.player,
                sportType: eventData.sportType,
                company: eventData.company,
                decimals: eventData.decimals ? parseInt(eventData.decimals) : undefined,
              });
              console.log('Event metadata stored in Convex successfully. Convex ID:', convexEventId);
              
              toast({
                variant: 'success',
                title: 'Event created!',
                description: 'The event has been created successfully',
              });
            } catch (err) {
              console.error('CONVEX MUTATION FAILED:', err);
              toast({
                variant: 'destructive',
                title: 'Warning: Event created on blockchain',
                description: 'But metadata storage failed. Check console for details.',
              });
            }
          })();

          setShowEventModal(false);
          setIsCreatingEvent(false);
          return transaction;
        },
        onError: (receipt, error) => {
          console.error('Event creation failed:', receipt, error);
          toast({
            variant: 'destructive',
            title: 'Failed to create event',
            description: typeof error === 'string' ? error : 'Transaction failed',
          });
          setIsCreatingEvent(false);
          return receipt;
        },
      });
    } catch (err) {
      console.error('Error creating event:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to create event',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
      });
      setIsCreatingEvent(false);
    }
  };

  // Handle crypto market creation
  const handleCreateCryptoMarket = async () => {
    if (!cryptoMarketForm.tokenSymbol || !cryptoMarketForm.tokenName) {
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description: 'Please fill in token symbol and name',
      });
      return;
    }

    try {
      toast({
        variant: 'default',
        title: 'Creating crypto market...',
        description: 'Storing market metadata in Convex',
      });

      const result = await createCryptoMarketMutation({
        tokenSymbol: cryptoMarketForm.tokenSymbol,
        tokenName: cryptoMarketForm.tokenName,
        priceDecimals: cryptoMarketForm.priceDecimals,
        imageUrl: cryptoMarketForm.imageUrl,
        description: cryptoMarketForm.description || `Predict ${cryptoMarketForm.tokenSymbol} token price in USD`,
        contractId: currentContractId,
      });

      toast({
        variant: 'success',
        title: 'Crypto market created!',
        description: `${cryptoMarketForm.tokenSymbol} market is now available`,
      });

      setShowCryptoMarketModal(false);
      setCryptoMarketForm({
        tokenSymbol: '',
        tokenName: '',
        priceDecimals: 8,
        imageUrl: '',
        description: '',
      });
    } catch (err) {
      console.error('Error creating crypto market:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to create crypto market',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
      });
    }
  };

  // CLOB market creation handler
  const handleCreateClobMarket = async () => {
    if (!clobMarketForm.question || !clobMarketForm.imageUrl || !clobMarketForm.resolutionTimestamp) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Fill in all required fields' });
      return;
    }
    setIsCreatingClobMarket(true);
    try {
      const marketId = `clob-${clobMarketForm.category}-${Date.now()}`;
      const res = await fetch('/api/clob/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId,
          question: clobMarketForm.question,
          category: clobMarketForm.category,
          outcomeNames: clobMarketForm.outcomeNames.filter(n => n.trim()),
          imageUrl: clobMarketForm.imageUrl,
          description: clobMarketForm.description,
          resolutionTimestamp: Math.floor(new Date(clobMarketForm.resolutionTimestamp).getTime() / 1000),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create market');
      toast({ title: 'CLOB Market Created', description: `Market ID: ${marketId}` });
      setShowClobMarketModal(false);
      setClobMarketForm({ question: '', category: 'politics', outcomeNames: ['Yes', 'No'], imageUrl: '', description: '', resolutionTimestamp: '' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to create CLOB market', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsCreatingClobMarket(false);
    }
  };

  // Sync finalization results to Convex DB (for bets already processed on-chain)
  const [isSyncing, setIsSyncing] = useState(false);

  const syncResultsToConvex = async () => {
    setIsSyncing(true);
    try {
      // Step 1: Run processBatch on-chain for all past-resolution buckets
      const allSyncBetsForBuckets = (allConvexBetsRaw || []).map((b: any) => ({
        bucket: b.bucket ?? getOnChainBucket(b.targetTimestamp, selectedCategory),
        targetTimestamp: b.targetTimestamp,
      }));
      const nowSec = Math.floor(Date.now() / 1000);
      const pastBets = allSyncBetsForBuckets.filter((b: any) => b.targetTimestamp <= nowSec);
      const uniqueBucketsForProcess = Array.from(new Set(pastBets.map((b: any) => b.bucket)));

      let batchProcessed = 0;
      let batchAlreadyComplete = 0;
      const batchErrors: string[] = [];

      for (const bucket of uniqueBucketsForProcess) {
        try {
          const res = await fetch('/api/admin/process-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: selectedCategory.toLowerCase(), bucket }),
          });
          const data = await res.json();
          if (!res.ok) {
            batchErrors.push(`Bucket ${bucket}: ${data.error}`);
          } else if (data.alreadyComplete) {
            batchAlreadyComplete++;
          } else {
            batchProcessed += data.totalProcessed || 0;
          }
        } catch (err) {
          batchErrors.push(`Bucket ${bucket}: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      }

      if (batchProcessed > 0) {
        console.log(`[admin] processBatch: processed ${batchProcessed} bet(s), ${batchAlreadyComplete} already complete, ${batchErrors.length} error(s)`);
      }

      // Step 2: Use ALL bets (including already-finalized) for re-syncing payouts
      const allSyncBets = (allConvexBetsRaw || []).map((b: any) => ({
        id: b.betId,
        stake: b.stake,
        priceMin: b.priceMin,
        priceMax: b.priceMax,
        timestamp: typeof b.timestamp === 'number' && b.timestamp > 1e12 ? Math.floor(b.timestamp / 1000) : b.timestamp,
        targetTimestamp: b.targetTimestamp,
        bucket: b.bucket ?? 0,
        finalized: b.finalized,
        won: b.won,
        claimed: b.claimed,
        payout: Number(b.payout || 0),
        expectedPayout: Number(b.expectedPayout || 0),
        weight: Number(b.weight || 0),
        qualityBps: b.qualityBps,
        asset: b.asset,
        user: { id: b.userAddress, bets: [], totalBets: 0, totalStaked: 0, totalPayout: 0 },
        market: { id: b.marketId, category: b.category },
        bucketRef: undefined,
      }));

      // Step 0: Populate on-chain bet IDs for managed bets that don't have them yet.
      // Read all on-chain bets and match by (stake, priceMin, priceMax, targetTimestamp).
      const contractAddr = getContractAddress(selectedCategory);
      const managedBetsMissingOnChainId = (allConvexBetsRaw || []).filter(
        (b: any) => b.betId.startsWith('managed-') && (b.onChainBetId === undefined || b.onChainBetId === null)
      );

      if (managedBetsMissingOnChainId.length > 0 && readContract) {
        try {
          // Read nextBetId to know how many on-chain bets exist
          const contractStats = await readContract({
            address: contractAddr,
            abi: CryptoPredictionMarketABI.abi,
            functionName: 'getContractStats',
            args: [],
          }) as any;
          const totalOnChainBets = Number(contractStats?.[0] || contractStats?.nextBetId || 0);
          console.log('[admin-sync] Total on-chain bets:', totalOnChainBets);

          // Read each on-chain bet and build a lookup
          const onChainBets: Array<{ id: number; stake: string; priceMin: string; priceMax: string; targetTimestamp: number }> = [];
          for (let i = 0; i < totalOnChainBets; i++) {
            try {
              const betData = await readContract({
                address: contractAddr,
                abi: CryptoPredictionMarketABI.abi,
                functionName: 'getBet',
                args: [i],
              }) as any;
              onChainBets.push({
                id: i,
                stake: betData?.stake?.toString() || betData?.[4]?.toString() || '0',
                priceMin: betData?.priceMin?.toString() || betData?.[2]?.toString() || '0',
                priceMax: betData?.priceMax?.toString() || betData?.[3]?.toString() || '0',
                targetTimestamp: Number(betData?.targetTimestamp || betData?.[1] || 0),
              });
            } catch (err) {
              console.error(`[admin-sync] Failed to read on-chain bet ${i}:`, err);
            }
          }

          // Match each managed bet missing an on-chain ID
          const usedOnChainIds = new Set<number>();
          // First, mark IDs already assigned to other bets
          for (const b of (allConvexBetsRaw || [])) {
            if ((b as any).onChainBetId !== undefined && (b as any).onChainBetId !== null) {
              usedOnChainIds.add((b as any).onChainBetId);
            }
          }

          let matched = 0;
          for (const convexBet of managedBetsMissingOnChainId) {
            // On-chain stake = gross - 1% fee (FEE_BPS=100, BPS_DENOM=10000)
            // Convex stores the gross amount, contract stores net after fee
            const grossStake = BigInt(convexBet.stake);
            const expectedNetStake = grossStake - (grossStake * BigInt(100)) / BigInt(10000);

            const match = onChainBets.find(
              (ob) =>
                !usedOnChainIds.has(ob.id) &&
                (ob.stake === convexBet.stake || ob.stake === expectedNetStake.toString()) &&
                ob.priceMin === convexBet.priceMin &&
                ob.priceMax === convexBet.priceMax &&
                ob.targetTimestamp === convexBet.targetTimestamp
            );
            if (match) {
              usedOnChainIds.add(match.id);
              await updateBetOnChainIdMutation({
                betId: convexBet.betId,
                onChainBetId: match.id,
              });
              matched++;
              console.log(`[admin-sync] Matched ${convexBet.betId} -> on-chain ID ${match.id} (on-chain stake: ${match.stake}, convex stake: ${convexBet.stake}, expected net: ${expectedNetStake.toString()})`);
            } else {
              console.warn(`[admin-sync] No match for ${convexBet.betId} (stake: ${convexBet.stake}, net: ${expectedNetStake.toString()}, priceMin: ${convexBet.priceMin}, priceMax: ${convexBet.priceMax}, ts: ${convexBet.targetTimestamp})`);
            }
          }
          if (matched > 0) {
            console.log(`[admin-sync] Populated on-chain IDs for ${matched} managed bets`);
          }
        } catch (err) {
          console.error('[admin-sync] Error populating on-chain IDs:', err);
        }
      }

      // Filter to only bets that need syncing: won with zero payout, or not yet finalized
      const betsNeedingSync = allSyncBets.filter((b: any) =>
        !b.finalized || (b.finalized && b.won && b.payout === 0)
      );

      if (betsNeedingSync.length === 0) {
        // No new bets to finalize, but still auto-claim any unclaimed winners
        const unclaimedWinners = allSyncBets.filter((b: any) => b.finalized && b.won && !b.claimed);
        if (unclaimedWinners.length > 0) {
          const bucketsSet = new Set(unclaimedWinners.map((b: any) => b.bucket || getOnChainBucket(b.targetTimestamp, selectedCategory)));
          const buckets = Array.from(bucketsSet);
          let totalClaimed = 0;
          for (const bucket of buckets) {
            try {
              const claimRes = await fetch('/api/bet/auto-claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  marketId: contractAddr,
                  bucket,
                  category: selectedCategory.toLowerCase(),
                }),
              });
              if (claimRes.ok) {
                const claimData = await claimRes.json();
                totalClaimed += claimData.claimed || 0;
              }
            } catch (claimErr) {
              console.error(`[admin] Auto-claim failed for bucket ${bucket}:`, claimErr);
            }
          }
          const claimMsg = totalClaimed > 0 ? ` Auto-claimed ${totalClaimed} winning bet(s).` : '';
          toast({ variant: 'success', title: 'Sync complete', description: `Bets already finalized.${claimMsg}` });
        } else {
          const idMsg = managedBetsMissingOnChainId.length > 0
            ? `Matched on-chain IDs for managed bets.`
            : 'No bets need payout updates.';
          toast({ variant: 'default', title: 'Sync complete', description: idMsg });
        }
        setIsSyncing(false);
        return;
      }

      // Group bets by bucket, only past-resolution bets with prices
      const bucketMap = new Map<number, { targetTimestamp: number; price: number }[]>();
      const bucketBetIds = new Map<number, string[]>();
      for (const bet of betsNeedingSync) {
        if (bet.targetTimestamp > nowSec) continue;
        const betAsset = inferAssetFromPrice(bet as Bet);
        const price = getFinalPrice(bet.targetTimestamp, betAsset);
        if (price === null) continue;

        const bucket = bet.bucket;
        if (!bucketMap.has(bucket)) {
          bucketMap.set(bucket, []);
          bucketBetIds.set(bucket, []);
        }
        const priceTinybars = Math.round(price * 1e8);
        const existing = bucketMap.get(bucket)!;
        if (!existing.some((p) => p.targetTimestamp === bet.targetTimestamp)) {
          existing.push({ targetTimestamp: bet.targetTimestamp, price: priceTinybars });
        }
        bucketBetIds.get(bucket)!.push(bet.id);
      }

      let totalUpdated = 0;
      const bucketEntries = Array.from(bucketMap.entries());
      for (let i = 0; i < bucketEntries.length; i++) {
        const [bucket, prices] = bucketEntries[i];
        const betIds = bucketBetIds.get(bucket) || [];

        // Read bucket info from contract for DPM payout calculation
        let poolData: { totalStaked: string; totalExited: string; totalWinningWeight: string } | undefined;
        let betWeights: { betId: string; weight: string }[] | undefined;

        try {
          if (readContract) {
            // Read bucket stats: totalStaked, totalWeight, price
            const bucketStats = await readContract({
              address: contractAddr,
              abi: CryptoPredictionMarketABI.abi,
              functionName: 'getBucketStats',
              args: [bucket],
            }) as any;

            // Read bucket info: totalBets, totalWinningWeight, nextProcessIndex, aggregationComplete
            const bucketInfo = await readContract({
              address: contractAddr,
              abi: CryptoPredictionMarketABI.abi,
              functionName: 'getBucketInfo',
              args: [bucket],
            }) as any;

            // getBucketStats returns (totalStaked, totalWeight, price)
            // getBucketInfo returns (totalBets, totalWinningWeight, nextProcessIndex, aggregationComplete)
            const totalStaked = bucketStats?.[0]?.toString() || '0';
            const totalWinningWeight = bucketInfo?.[1]?.toString() || '0';

            // Read totalExited from the buckets mapping directly
            // buckets is a public mapping, so buckets(bucket) returns the struct fields
            const bucketData = await readContract({
              address: contractAddr,
              abi: CryptoPredictionMarketABI.abi,
              functionName: 'buckets',
              args: [bucket],
            }) as any;
            // Public mapping returns: totalStaked, totalWeight, totalWinningWeight, nextProcessIndex, aggregationComplete, totalExited
            // The exact order depends on the struct layout
            const totalExited = bucketData?.totalExited?.toString() || bucketData?.[5]?.toString() || '0';

            poolData = { totalStaked, totalExited, totalWinningWeight };

            // Read each bet's weight from the contract using on-chain bet IDs
            betWeights = [];
            for (const betId of betIds) {
              try {
                // Look up the on-chain bet ID from Convex data
                const convexBet = (allConvexBetsRaw || []).find((b: any) => b.betId === betId);
                const numericId = convexBet?.onChainBetId ?? (betId.includes('-') ? undefined : betId);
                if (numericId === undefined) {
                  console.warn(`[admin-sync] No on-chain ID for bet ${betId}, skipping weight read`);
                  continue;
                }
                const betData = await readContract({
                  address: contractAddr,
                  abi: CryptoPredictionMarketABI.abi,
                  functionName: 'getBet',
                  args: [numericId],
                }) as any;
                const weight = betData?.weight?.toString() || betData?.[4]?.toString() || '0';
                betWeights.push({ betId, weight });
              } catch (err) {
                console.error(`[admin] Failed to read bet ${betId} from contract:`, err);
              }
            }
          }
        } catch (err) {
          console.error(`[admin] Failed to read contract data for bucket ${bucket}:`, err);
        }

        const result = await finalizeBetsMutation({
          marketId: contractAddr,
          bucket,
          prices,
          category: selectedCategory.toLowerCase(),
          poolData,
          betWeights,
        });
        totalUpdated += result.updated;
      }

      // Auto-claim winning bets for each bucket
      let totalClaimed = 0;
      for (const [bucket] of bucketEntries) {
        try {
          const claimRes = await fetch('/api/bet/auto-claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              marketId: contractAddr,
              bucket,
              category: selectedCategory.toLowerCase(),
            }),
          });
          if (claimRes.ok) {
            const claimData = await claimRes.json();
            totalClaimed += claimData.claimed || 0;
          }
        } catch (claimErr) {
          console.error(`[admin] Auto-claim failed for bucket ${bucket}:`, claimErr);
        }
      }

      const claimMsg = totalClaimed > 0 ? ` Auto-claimed ${totalClaimed} winning bet(s).` : '';
      const batchMsg = batchProcessed > 0 ? ` Processed ${batchProcessed} bet(s) on-chain.` : '';
      toast({
        variant: 'success',
        title: 'Settle complete',
        description: `Finalized ${totalUpdated} bet(s) in Convex.${batchMsg}${claimMsg}`,
      });
    } catch (err) {
      console.error('[admin] syncResultsToConvex error:', err);
      toast({
        variant: 'destructive',
        title: 'Sync failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Submit prices to contract
  const submitPrices = async () => {
    setIsSubmitting(true);
    try {
      // Determine which bets to process based on selected bucket
      const betsToProcess = selectedBucket === 'all' ? allBets : filteredBets;

      if (!betsToProcess || betsToProcess.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No bets to process',
          description: 'Please select a bucket with bets.',
        });
        setIsSubmitting(false);
        return;
      }

      // Get unique buckets from the bets we're processing
      const bucketsToProcess = Array.from(new Set(betsToProcess.map((bet: Bet) => bet.bucket)));

      // For each bucket, we need ALL bets in that bucket (not just visible ones)
      const allBetsInBuckets = allBets.filter((bet: Bet) =>
        bucketsToProcess.includes(bet.bucket)
      );

      // Get unique timestamps from ALL bets in the buckets being processed
      const uniqueTimestamps = Array.from(
        new Set(allBetsInBuckets.map((bet: Bet) => bet.targetTimestamp))
      );

      // Only consider timestamps that are in the past (resolution time has passed)
      const nowSec = Math.floor(Date.now() / 1000);
      const futureTimestamps = uniqueTimestamps.filter((ts) => (ts as number) > nowSec);

      // Contract constraint: processBatch iterates ALL bets in a bucket sequentially.
      // If any bet has a targetTimestamp without a price, the tx reverts with "Price not set for timestamp".
      // Therefore we can ONLY submit+process buckets where every single timestamp is in the past.
      if (futureTimestamps.length > 0) {
        // Check per-bucket: which buckets are fully resolved vs mixed
        const bucketHasFuture = new Set<number>();
        for (const bet of allBetsInBuckets) {
          if (bet.targetTimestamp > nowSec) bucketHasFuture.add(bet.bucket);
        }

        // Filter bucketsToProcess to only fully-past buckets
        const safeToProcess = bucketsToProcess.filter((b) => !bucketHasFuture.has(b));
        const blockedBuckets = bucketsToProcess.filter((b) => bucketHasFuture.has(b));

        if (safeToProcess.length === 0) {
          const nextFutureTs = Math.min(...futureTimestamps.map(Number));
          const nextDate = new Date(nextFutureTs * 1000).toLocaleString();
          toast({
            variant: 'destructive',
            title: 'Cannot process yet',
            description: `The smart contract requires ALL bets in a bucket to have prices set before processBatch can run. ${blockedBuckets.map(formatBucketLabel).join(', ')} still have future resolution times. Earliest: ${nextDate}. Wait for all timestamps to pass, then try again.`,
          });
          setIsSubmitting(false);
          return;
        }

        // Some buckets are safe, some are blocked -- narrow scope
        if (blockedBuckets.length > 0) {
          toast({
            variant: 'default',
            title: 'Partial submission',
            description: `Skipping ${blockedBuckets.map(formatBucketLabel).join(', ')} (still have future bets). Processing ${safeToProcess.map(formatBucketLabel).join(', ')} only.`,
          });
        }

        // Narrow to only bets in safe buckets
        bucketsToProcess.length = 0;
        bucketsToProcess.push(...safeToProcess);
      }

      // Re-filter bets and timestamps to only the safe buckets
      const safeBetsInBuckets = allBets.filter((bet: Bet) => bucketsToProcess.includes(bet.bucket));
      const safeTimestamps = Array.from(new Set(safeBetsInBuckets.map((bet: Bet) => bet.targetTimestamp)));

      // Rebuild asset map for safe timestamps only
      const safeTimestampAssetMap = new Map<number, string>();
      for (const bet of safeBetsInBuckets) {
        safeTimestampAssetMap.set(bet.targetTimestamp, inferAssetFromPrice(bet));
      }

      if (safeTimestamps.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No resolved bets',
          description: 'All bet resolution times are still in the future.',
        });
        setIsSubmitting(false);
        return;
      }

      // Filter safe timestamps that have prices
      const timestampsWithPrices = safeTimestamps
        .filter((ts) => getFinalPrice(ts as number, safeTimestampAssetMap.get(ts as number)) !== null)
        .sort((a, b) => (a as number) - (b as number));

      if (timestampsWithPrices.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No prices to submit',
          description: 'Please enter prices for the resolved bets.',
        });
        setIsSubmitting(false);
        return;
      }

      // Check if all safe timestamps have prices
      const timestampsWithoutPrices = safeTimestamps.filter(
        (ts) => getFinalPrice(ts as number, safeTimestampAssetMap.get(ts as number)) === null
      );

      if (timestampsWithoutPrices.length > 0) {
        const betsWithoutPrices = safeBetsInBuckets.filter((bet: Bet) =>
          timestampsWithoutPrices.includes(bet.targetTimestamp)
        );

        const missingInfo = betsWithoutPrices
          .map(
            (bet: Bet) =>
              `Bet ${bet.id} (${formatBucketLabel(bet.bucket)}, ${new Date(bet.targetTimestamp * 1000).toLocaleString()})`
          )
          .join(', ');

        toast({
          variant: 'destructive',
          title: 'Missing prices',
          description: `Cannot proceed - prices missing for: ${missingInfo}`,
        });
        setIsSubmitting(false);
        return;
      }

      const timestamps = timestampsWithPrices;
      const prices = timestampsWithPrices.map((ts) => {
        const price = getFinalPrice(ts as number, safeTimestampAssetMap.get(ts as number))!;
        // Convert to contract format (price in tinybars, 8 decimals)
        return parseUnits(price.toFixed(8), 8).toString();
      });

      // Process only the buckets that contain our selected bets
      const uniqueBuckets = bucketsToProcess;

      toast({
        variant: 'default',
        title: 'Submitting prices...',
        description: `Preparing to submit ${timestampsWithPrices.length} prices`,
      });

      // Submit prices first
      const setPricesResult = await writeContract({
        contractId: currentContractId,
        abi: CryptoPredictionMarketABI.abi,
        functionName: 'setPricesForTimestamps',
        args: [timestamps, prices],
        metaArgs: {
          gas: 5000000, // Increased gas limit
        },
      });

      toast({
        variant: 'default',
        title: 'Waiting for price transaction...',
        description: 'Please confirm in your wallet',
      });

      // Watch the setPrices transaction
      watch(setPricesResult as string, {
        onSuccess: (transaction) => {
          toast({
            variant: 'success',
            title: 'Prices submitted!',
            description: `Successfully submitted ${timestampsWithPrices.length} prices. Starting batch processing...`,
          });

          // Process batches after price submission succeeds
          const processBatches = async () => {
            try {
              toast({
                variant: 'default',
                title: 'Processing batches...',
                description: `Found ${uniqueBuckets.length} bucket(s) to process`,
              });

              // Process each unique bucket after price submission succeeds
              for (const bucketIndex of uniqueBuckets) {
                toast({
                  variant: 'default',
                  title: `Processing ${formatBucketLabel(bucketIndex)}...`,
                  description: 'Please confirm in your wallet',
                });

                const processBatchResult = await writeContract({
                  contractId: currentContractId,
                  abi: CryptoPredictionMarketABI.abi,
                  functionName: 'processBatch',
                  args: [bucketIndex],
                  metaArgs: {
                    gas: 10000000, // Increased gas limit for batch processing
                  },
                });

                // Watch each processBatch transaction
                watch(processBatchResult as string, {
                  onSuccess: (batchTransaction) => {
                    // Update Convex: mark bets in this bucket as finalized with win/loss
                    const bucketBets = safeBetsInBuckets.filter((b: Bet) => b.bucket === bucketIndex);
                    const bucketTimestamps = Array.from(new Set(bucketBets.map((b: Bet) => b.targetTimestamp)));
                    const bucketPrices = bucketTimestamps.map((ts) => {
                      const idx = (timestampsWithPrices as number[]).indexOf(ts);
                      return {
                        targetTimestamp: ts,
                        price: idx >= 0 ? Number(prices[idx]) : 0,
                      };
                    });

                    // Read contract data for DPM payout calculation, then finalize in Convex
                    const finalizeWithContractData = async () => {
                      let poolData: { totalStaked: string; totalExited: string; totalWinningWeight: string } | undefined;
                      let betWeights: { betId: string; weight: string }[] | undefined;
                      try {
                        if (readContract) {
                          const bucketStats = await readContract({
                            address: getContractAddress(selectedCategory),
                            abi: CryptoPredictionMarketABI.abi,
                            functionName: 'getBucketStats',
                            args: [bucketIndex],
                          }) as any;
                          const bucketInfoData = await readContract({
                            address: getContractAddress(selectedCategory),
                            abi: CryptoPredictionMarketABI.abi,
                            functionName: 'getBucketInfo',
                            args: [bucketIndex],
                          }) as any;
                          const bucketRaw = await readContract({
                            address: getContractAddress(selectedCategory),
                            abi: CryptoPredictionMarketABI.abi,
                            functionName: 'buckets',
                            args: [bucketIndex],
                          }) as any;

                          poolData = {
                            totalStaked: bucketStats?.[0]?.toString() || '0',
                            totalExited: bucketRaw?.totalExited?.toString() || bucketRaw?.[5]?.toString() || '0',
                            totalWinningWeight: bucketInfoData?.[1]?.toString() || '0',
                          };

                          betWeights = [];
                          for (const bet of bucketBets) {
                            try {
                              const numericId = bet.id.includes('-') ? bet.id.split('-')[1] : bet.id;
                              const betData = await readContract({
                                address: getContractAddress(selectedCategory),
                                abi: CryptoPredictionMarketABI.abi,
                                functionName: 'getBet',
                                args: [numericId],
                              }) as any;
                              betWeights.push({ betId: bet.id, weight: betData?.weight?.toString() || betData?.[4]?.toString() || '0' });
                            } catch { /* skip */ }
                          }
                        }
                      } catch (err) {
                        console.error(`[admin] Failed to read contract data for bucket ${bucketIndex}:`, err);
                      }

                      return finalizeBetsMutation({
                        marketId: getContractAddress(selectedCategory),
                        bucket: bucketIndex,
                        prices: bucketPrices,
                        category: selectedCategory.toLowerCase(),
                        poolData,
                        betWeights,
                      });
                    };

                    finalizeWithContractData().then((result) => {
                      console.log(`[admin] Finalized ${result.updated} bets in Convex for bucket ${bucketIndex}`);
                      // Auto-claim winning bets
                      fetch('/api/bet/auto-claim', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          marketId: getContractAddress(selectedCategory),
                          bucket: bucketIndex,
                          category: selectedCategory.toLowerCase(),
                        }),
                      }).then(res => res.json()).then(data => {
                        if (data.claimed > 0) {
                          console.log(`[admin] Auto-claimed ${data.claimed} winning bet(s) for bucket ${bucketIndex}`);
                        }
                      }).catch(err => {
                        console.error(`[admin] Auto-claim failed for bucket ${bucketIndex}:`, err);
                      });
                    }).catch((err) => {
                      console.error(`[admin] Failed to finalize bets in Convex for bucket ${bucketIndex}:`, err);
                    });

                    toast({
                      variant: 'success',
                      title: `${formatBucketLabel(bucketIndex)} processed!`,
                      description: 'Successfully processed batch',
                    });
                    return batchTransaction;
                  },
                  onError: (receipt, error) => {
                    console.error(`processBatch ERROR for bucket ${bucketIndex}`);
                    console.error('Receipt:', receipt);
                    console.error('Error:', error);
                    toast({
                      variant: 'destructive',
                      title: `Failed to process ${formatBucketLabel(bucketIndex)}`,
                      description:
                        typeof error === 'string' ? error : 'An unexpected error occurred.',
                    });
                    return receipt;
                  },
                });
              }

              toast({
                variant: 'success',
                title: 'All operations completed!',
                description: `Successfully submitted ${timestampsWithPrices.length} price${timestampsWithPrices.length === 1 ? '' : 's'} and initiated processing for ${uniqueBuckets.length} bucket${uniqueBuckets.length === 1 ? '' : 's'}.`,
              });

              setManualPrices(new Map());
              setIsSubmitting(false);
              // Refresh fee data after batch processing
              fetchFeeData();
            } catch (batchError) {
              console.error('Error processing batches:', batchError);
              setIsSubmitting(false);
              toast({
                variant: 'destructive',
                title: 'Prices submitted but batch processing failed',
                description:
                  batchError instanceof Error
                    ? batchError.message
                    : 'Failed to process some batches.',
              });
            }
          };

          processBatches();
          return transaction;
        },
        onError: (receipt, error) => {
          console.error('setPrices transaction failed:', receipt, error);
          setIsSubmitting(false);
          toast({
            variant: 'destructive',
            title: 'Failed to submit prices',
            description:
              typeof error === 'string'
                ? error
                : 'An unexpected error occurred while submitting prices.',
          });
          return receipt;
        },
      });
    } catch (err) {
      console.error('Error submitting prices:', err);
      setIsSubmitting(false);
      toast({
        variant: 'destructive',
        title: 'Failed to submit prices',
        description:
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while submitting prices.',
      });
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white dark:bg-black"><Header />
        <div className="flex flex-col items-center justify-center my-12 w-full space-y-2 ">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Loading...</h1>
          <p className="text-gray-500 dark:text-gray-400">Please wait while we check your access permissions.</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-white dark:bg-black"><Header />
        <div className="flex flex-col items-center justify-center my-12 w-full space-y-2 ">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            You need to sign in to access the admin dashboard.
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Please sign in with an account that has admin privileges.
          </p>

          <Button 
            variant="predensity" 
            className="w-48"
            onClick={() => window.location.href = '/'}
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-white dark:bg-black"><Header />

        <div className="flex flex-col items-center justify-center my-12 w-full space-y-2 ">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Access Denied</h1>
          <p className="text-gray-500 dark:text-gray-400">
            You do not have permission to access the admin dashboard.
          </p>
          <Button variant="predensity" className="w-48" onClick={() => logout()}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Check for wallet connection after admin check
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white dark:bg-black"><Header />
        <main className="container mx-auto px-4 py-8">
          <NoWalletConnectedContainer />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black"><Header />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Category Selector */}
        <Card className="bg-white dark:bg-neutral-950/50 border-white/10">
          <CardContent className="p-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Select Market Category</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.values(CATEGORIES)
                  .filter((cat) => cat.enabled && isCategoryDeployed(cat.id))
                  .map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedCategory === category.id
                          ? 'border-predensity-purple bg-predensity-purple/10'
                          : 'border-gray-200 dark:border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                            selectedCategory === category.id
                              ? 'bg-predensity-purple text-white'
                              : 'bg-gray-100 dark:bg-neutral-800 text-gray-400'
                          }`}
                        >
                          {category.icon}
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{category.name}</p>
                          <p className="text-xs text-gray-400">{category.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Selected: <span className="text-gray-900 dark:text-white font-medium">{CATEGORIES[selectedCategory].name}</span>
                  {' | '}
                  Contract ID: <span className="text-gray-900 dark:text-white font-mono text-xs">{currentContractId}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Protocol Fees */}
        <Card className="bg-white dark:bg-neutral-950/50 border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Protocol Fees</h2>
                <p className="text-sm text-gray-400 mt-1">Collected entry and exit fees across all contracts</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/5"
                onClick={fetchFeeData}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.values(CATEGORIES)
                .filter(cat => cat.enabled && isCategoryDeployed(cat.id))
                .map(cat => {
                  const info = feeData[cat.id];
                  const feesNum = info ? parseFloat(info.fees) : 0;
                  return (
                    <div key={cat.id} className="p-4 bg-gray-100 dark:bg-neutral-900 rounded-lg border border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-predensity-purple/20 flex items-center justify-center text-sm font-bold text-predensity-purple">
                          {cat.icon}
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{cat.name}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Fees Collected</span>
                          <span className={feesNum > 0 ? 'text-bright-green font-medium' : 'text-gray-500'}>
                            {info?.loading ? '...' : `${feesNum.toFixed(4)} ${getStakingCurrency().symbol}`}
                          </span>
                        </div>
                        <Button
                          variant="predensity"
                          size="sm"
                          className="w-full mt-2"
                          disabled={!info || feesNum === 0 || isWithdrawing === cat.id}
                          onClick={() => handleWithdrawFees(cat.id)}
                        >
                          {isWithdrawing === cat.id ? 'Withdrawing...' : `Withdraw ${feesNum > 0 ? feesNum.toFixed(4) : '0'} ${getStakingCurrency().symbol}`}
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* CLOB Market Management (Politics, Sports, Tech, International) */}
        <Card className="bg-white dark:bg-neutral-950/50 border-gray-200 dark:border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">CLOB Market Management</h2>
                <p className="text-sm text-gray-400 mt-1">Create prediction markets with YES/NO or multi-outcome trading</p>
              </div>
              <Button variant="predensity" onClick={() => setShowClobMarketModal(true)} className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Create CLOB Market
              </Button>
            </div>
            <ClobMarketsDisplay category={selectedCategory} />
          </CardContent>
        </Card>

        {/* Crypto Market Management - Only for Crypto Category */}
        {selectedCategory === Category.CRYPTO && (
          <Card className="bg-white dark:bg-neutral-950/50 border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Crypto Market Management</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Create new crypto token markets (BTC, ETH, SOL, etc.)
                  </p>
                </div>
                <Button
                  variant="predensity"
                  onClick={() => setShowCryptoMarketModal(true)}
                  className="flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Crypto Market
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Event Creation Section - Only for Politics, Sports, Technology */}
        {selectedCategory !== Category.CRYPTO && (
          <Card className="bg-white dark:bg-neutral-950/50 border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Event Management</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Create events for users to place bets on
                  </p>
                </div>
                <Button
                  variant="predensity"
                  onClick={() => setShowEventModal(true)}
                  className="flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Event
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events List - Only for Politics, Sports, Technology */}
        {selectedCategory !== Category.CRYPTO && (
          <EventsList category={selectedCategory} />
        )}

        {/* Event Resolution Section - Only for Politics, Sports, Technology */}
        {selectedCategory !== Category.CRYPTO && (
          <EventResolutionSection category={selectedCategory} contractId={currentContractId} />
        )}

        {/* Controls Card */}
        <Card className="bg-white dark:bg-neutral-950/50 border-white/10">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Bucket Navigation */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-predensity-purple" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {CATEGORIES[selectedCategory].name} - Bet Resolution by Bucket
                  </h2>
                </div>

                {/* Bucket Filter */}
                <div className="flex items-center gap-2">
                  <label htmlFor="bucket-filter" className="text-sm text-gray-400">
                    Filter by bucket:
                  </label>
                  <select
                    id="bucket-filter"
                    value={selectedBucket}
                    onChange={(e) => setSelectedBucket(e.target.value)}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-predensity-purple"
                  >
                    <option value="all">All Buckets</option>
                    {availableBuckets.map((bucket: string) => {
                      const label = formatBucketLabel(bucket);
                      return (
                        <option key={bucket} value={bucket}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Stats and Actions */}
              <div className="flex items-center gap-4">
                {filteredBets && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400">
                      {selectedBucket === 'all' ? 'Total' : 'Filtered'} bets:
                      <span className="text-gray-900 dark:text-white font-medium ml-1">{filteredBets.length}</span>
                    </span>
                    <div className="w-px h-4 bg-gray-600" />
                    <span className="text-gray-400">
                      Unique times:{' '}
                      <span className="text-gray-900 dark:text-white font-medium">
                        {
                          Array.from(new Set(filteredBets.map((b: Bet) => b.targetTimestamp)))
                            .length
                        }
                      </span>
                    </span>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/5"
                  onClick={() => refetch()}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
            </div>

            {/* Selected Bucket Display */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
              <p className="text-sm text-gray-400">
                {selectedBucket === 'all'
                  ? 'Showing all incomplete bets across all buckets'
                  : `Showing bets from ${formatBucketLabel(selectedBucket)}`}
                {filteredBets.length > 0 && (
                  <span className="ml-2 text-white font-medium">
                    ({filteredBets.length} bet{filteredBets.length !== 1 ? 's' : ''})
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
              <table className="min-w-[800px] w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">Bet ID</th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">Bet Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">
                      {selectedCategory === Category.CRYPTO ? 'Min price' : 'Range Min'}
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">
                      {selectedCategory === Category.CRYPTO ? 'Max price' : 'Range Max'}
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">
                      Placed At ({getLocalTimezoneAbbr()})
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">
                      Resolution Time ({getLocalTimezoneAbbr()})
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">
                      {selectedCategory === Category.CRYPTO ? 'Resolution price' : 'Resolution value'}
                    </th>
                  </tr>
                </thead>
                <tbody className="max-h-[600px] overflow-y-auto">
                  {loading && (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="w-8 h-8 border-2 border-predensity-purple border-t-transparent rounded-full animate-spin" />
                          <p className="text-medium-gray">Loading bets...</p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && (!filteredBets || filteredBets.length === 0) && (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <div className="flex flex-col items-center space-y-3">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
                            <svg
                              className="w-8 h-8 text-medium-gray"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div className="space-y-1">
                            <p className="text-gray-900 dark:text-white font-medium">No bets found</p>
                            <p className="text-medium-gray text-sm">
                              {selectedBucket === 'all'
                                ? 'No incomplete bets found in any buckets'
                                : `No bets found in ${formatBucketLabel(selectedBucket)}`}
                            </p>
                            {selectedBucket !== 'all' && (
                              <p className="text-medium-gray text-sm">
                                Try selecting a different bucket or "All Buckets"
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filteredBets?.map((bet: Bet) => {
                      const betAsset = inferAssetFromPrice(bet);
                      const betPriceKey = `${betAsset}:${bet.targetTimestamp}`;
                      const finalPrice = getFinalPrice(bet.targetTimestamp, betAsset);
                      const fetchedPrice = findClosestPrice(bet.targetTimestamp, betAsset);
                      const isManual = manualPrices.has(betPriceKey);
                      const isCrypto = selectedCategory === Category.CRYPTO;

                      // Format range values based on category
                      let displayMin: string;
                      let displayMax: string;
                      let rangeMin: number;
                      let rangeMax: number;

                      if (selectedCategory === Category.POLITICS) {
                        // Politics: BPS values (0-10000) -> percentage
                        rangeMin = Number(bet.priceMin);
                        rangeMax = Number(bet.priceMax);
                        displayMin = (rangeMin / 100).toFixed(1) + '%';
                        displayMax = (rangeMax / 100).toFixed(1) + '%';
                      } else if (selectedCategory === Category.SPORTS || selectedCategory === Category.TECHNOLOGY) {
                        // Sports/Tech: raw numeric values
                        rangeMin = Number(bet.priceMin);
                        rangeMax = Number(bet.priceMax);
                        displayMin = rangeMin.toLocaleString();
                        displayMax = rangeMax.toLocaleString();
                      } else {
                        // Crypto: 8-decimal format -> dollar price
                        rangeMin = parseFloat(formatTinybarsToHbar(bet.priceMin));
                        rangeMax = parseFloat(formatTinybarsToHbar(bet.priceMax));
                        displayMin = '$' + rangeMin.toFixed(4);
                        displayMax = '$' + rangeMax.toFixed(4);
                      }

                      const isInRange =
                        finalPrice !== null && finalPrice >= rangeMin && finalPrice <= rangeMax;

                      return (
                        <tr key={bet.id} className="border-b border-white/5 hover:bg-white dark:bg-neutral-950/50">
                          <td className="py-3 px-4 text-sm text-light-gray font-mono">{bet.id}</td>
                          <td className="py-3 px-4 text-sm text-light-gray">
                            {formatTinybarsToHbar(bet.stake)} {getStakingCurrency().symbol}
                          </td>
                          <td className="py-3 px-4 text-sm text-light-gray">{displayMin}</td>
                          <td className="py-3 px-4 text-sm text-light-gray">{displayMax}</td>
                          <td className="py-3 px-4 text-sm text-light-gray">
                            {formatDateUTC(bet.timestamp)}
                          </td>
                          <td className="py-3 px-4 text-sm text-light-gray">
                            {formatDateUTC(bet.targetTimestamp)}
                          </td>
                          <td className="py-3 px-4 text-sm text-medium-gray">
                            {finalPrice !== null ? (
                              isInRange ? (
                                <span className="text-green-500">Win</span>
                              ) : (
                                <span className="text-red-500">Loss</span>
                              )
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {isCrypto ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className={`w-32 px-2 py-1 bg-transparent border rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    isManual ? 'border-yellow-500' : 'border-gray-600'
                                  }`}
                                  placeholder="Enter price"
                                  value={
                                    manualPrices.get(betPriceKey) ??
                                    (fetchedPrice !== null ? fetchedPrice.toFixed(4) : '')
                                  }
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                                      handlePriceChange(betPriceKey, value);
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">
                                Resolved via event
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {selectedCategory === Category.CRYPTO && (
              <div className="flex justify-end gap-3 mt-4">
                {allConvexBetsRaw && allConvexBetsRaw.length > 0 && (
                  <>
                    {filteredBets && filteredBets.length > 0 && (
                      <Button
                        variant="predensity"
                        className="w-auto"
                        onClick={submitPrices}
                        disabled={isSubmitting || isSyncing}
                      >
                        {isSubmitting ? 'Submitting...' : '1. Submit Prices to Contract'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="w-auto"
                      onClick={syncResultsToConvex}
                      disabled={isSyncing || isSubmitting}
                    >
                      {isSyncing ? 'Settling...' : '2. Settle & Pay Winners'}
                    </Button>
                  </>
                )}
              </div>
            )}
            {filteredBets && filteredBets.length > 0 && selectedCategory !== Category.CRYPTO && (
              <div className="mt-4 p-3 bg-gray-100 dark:bg-neutral-800/50 rounded border border-white/10">
                <p className="text-sm text-gray-400">
                  {CATEGORIES[selectedCategory].name} bets are resolved via the Event Resolution section above.
                  Submit the actual result for the event to trigger bet settlement.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Event Creation Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-white/10 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-neutral-950">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Create {CATEGORIES[selectedCategory].name} Event
              </h2>
              <button
                onClick={() => setShowEventModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <EventCreationForm
                category={selectedCategory}
                onSubmit={handleCreateEvent}
                onCancel={() => setShowEventModal(false)}
                isSubmitting={isCreatingEvent}
              />
            </div>
          </div>
        </div>
      )}

      {/* Crypto Market Creation Modal */}
      {showCryptoMarketModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-white/10 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-neutral-950">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Create Crypto Market
              </h2>
              <button
                onClick={() => setShowCryptoMarketModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Token Symbol (e.g., BTC, ETH, SOL)
                </label>
                <input
                  type="text"
                  value={cryptoMarketForm.tokenSymbol}
                  onChange={(e) => setCryptoMarketForm({
                    ...cryptoMarketForm,
                    tokenSymbol: e.target.value.toUpperCase()
                  })}
                  placeholder="BTC"
                  className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Token Name (e.g., Bitcoin, Ethereum)
                </label>
                <input
                  type="text"
                  value={cryptoMarketForm.tokenName}
                  onChange={(e) => setCryptoMarketForm({
                    ...cryptoMarketForm,
                    tokenName: e.target.value
                  })}
                  placeholder="Bitcoin"
                  className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Price Decimals (usually 8)
                </label>
                <input
                  type="number"
                  value={cryptoMarketForm.priceDecimals}
                  onChange={(e) => setCryptoMarketForm({
                    ...cryptoMarketForm,
                    priceDecimals: parseInt(e.target.value) || 8
                  })}
                  className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-predensity-purple"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Number of decimal places for price (8 for most cryptocurrencies)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Image URL (token logo)
                </label>
                <input
                  type="text"
                  value={cryptoMarketForm.imageUrl}
                  onChange={(e) => setCryptoMarketForm({
                    ...cryptoMarketForm,
                    imageUrl: e.target.value
                  })}
                  placeholder="https://i.ibb.co/..."
                  className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Direct image URL (use ImgBB format: https://i.ibb.co/...)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={cryptoMarketForm.description}
                  onChange={(e) => setCryptoMarketForm({
                    ...cryptoMarketForm,
                    description: e.target.value
                  })}
                  placeholder="Predict BTC token price in USD"
                  className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-predensity-purple"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCryptoMarketModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="predensity"
                  onClick={handleCreateCryptoMarket}
                  className="flex-1"
                  disabled={!cryptoMarketForm.tokenSymbol || !cryptoMarketForm.tokenName}
                >
                  Create Market
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLOB Market Creation Modal */}
      {showClobMarketModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-white/10 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create CLOB Market</h2>
              <button onClick={() => setShowClobMarketModal(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select value={clobMarketForm.category} onChange={(e) => setClobMarketForm({ ...clobMarketForm, category: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm">
                  <option value="politics">Politics</option>
                  <option value="sports">Sports</option>
                  <option value="technology">Technology</option>
                  <option value="international">International</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question *</label>
                <input type="text" value={clobMarketForm.question} onChange={(e) => setClobMarketForm({ ...clobMarketForm, question: e.target.value })} placeholder="Who will win the 2026 World Cup?" className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm placeholder:text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Outcomes (one per line, min 2) *</label>
                <textarea value={clobMarketForm.outcomeNames.join('\n')} onChange={(e) => setClobMarketForm({ ...clobMarketForm, outcomeNames: e.target.value.split('\n') })} rows={4} placeholder={"Yes\nNo"} className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm placeholder:text-gray-400 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image URL *</label>
                <input type="url" value={clobMarketForm.imageUrl} onChange={(e) => setClobMarketForm({ ...clobMarketForm, imageUrl: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm placeholder:text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={clobMarketForm.description} onChange={(e) => setClobMarketForm({ ...clobMarketForm, description: e.target.value })} rows={2} placeholder="Describe the market..." className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm placeholder:text-gray-400 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Resolution Date *</label>
                <input type="datetime-local" value={clobMarketForm.resolutionTimestamp} onChange={(e) => setClobMarketForm({ ...clobMarketForm, resolutionTimestamp: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm" />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowClobMarketModal(false)} className="flex-1">Cancel</Button>
                <Button variant="predensity" onClick={handleCreateClobMarket} disabled={isCreatingClobMarket} className="flex-1">
                  {isCreatingClobMarket ? 'Creating...' : 'Create Market'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}
