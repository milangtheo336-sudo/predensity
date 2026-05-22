'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FINANCE_TAXONOMY } from '@/lib/types/finance';

type FinanceSubType =
  | 'hourly' | 'daily' | 'weekly'
  | 'this-vs-that'
  | 'stocks' | 'ai-stocks' | 'commodities' | 'oil-gas'
  | 'economy' | 'company-news' | 'military'
  | 'fed-rates';

type Shape = 'binary-template' | 'this-vs-that' | 'mixed' | 'fed-rates';

const SUBTYPE_SHAPE: Record<FinanceSubType, Shape> = {
  hourly: 'binary-template',
  daily: 'binary-template',
  weekly: 'binary-template',
  'this-vs-that': 'this-vs-that',
  stocks: 'mixed',
  'ai-stocks': 'mixed',
  commodities: 'mixed',
  'oil-gas': 'mixed',
  economy: 'mixed',
  'company-news': 'mixed',
  military: 'mixed',
  'fed-rates': 'fed-rates',
};

const SUBTYPE_GROUP: Record<FinanceSubType, 'duration' | 'finance-events'> = {
  hourly: 'duration',
  daily: 'duration',
  weekly: 'duration',
  'this-vs-that': 'finance-events',
  stocks: 'finance-events',
  'ai-stocks': 'finance-events',
  commodities: 'finance-events',
  'oil-gas': 'finance-events',
  economy: 'finance-events',
  'company-news': 'finance-events',
  military: 'finance-events',
  'fed-rates': 'finance-events',
};

const FED_RATES_PRESETS = [
  'No change',
  '25 bps increase',
  '25+ bps increase',
  '25 bps decrease',
  '50+ bps decrease',
];

export interface FinanceMarketPayload {
  marketId: string;
  question: string;
  category: 'finance';
  outcomeNames: string[];
  outcomesData: { name: string; imageUrl: string }[];
  imageUrl: string;
  description: string;
  resolutionTimestamp: number;
  sport: string;
  league: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: FinanceMarketPayload) => Promise<void>;
  isSubmitting: boolean;
}

export function FinanceMarketModal({ open, onClose, onSubmit, isSubmitting }: Props) {
  const [subtype, setSubtype] = useState<FinanceSubType | ''>('');

  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [resolutionDatetime, setResolutionDatetime] = useState('');

  const [assetName, setAssetName] = useState('');
  const [assetSymbol, setAssetSymbol] = useState('');
  const [targetPrice, setTargetPrice] = useState('');

  const [assetAName, setAssetAName] = useState('');
  const [assetAImage, setAssetAImage] = useState('');
  const [assetBName, setAssetBName] = useState('');
  const [assetBImage, setAssetBImage] = useState('');

  const [mixedShape, setMixedShape] = useState<'binary' | 'multi'>('binary');
  const [freeformQuestion, setFreeformQuestion] = useState('');
  const [freeformOutcomes, setFreeformOutcomes] = useState<{ name: string; imageUrl: string }[]>([
    { name: '', imageUrl: '' },
    { name: '', imageUrl: '' },
  ]);

  const [fedQuestion, setFedQuestion] = useState('Fed decision in April?');
  const [fedOutcomes, setFedOutcomes] = useState<string[]>(FED_RATES_PRESETS);

  const [error, setError] = useState<string | null>(null);

  const shape = subtype ? SUBTYPE_SHAPE[subtype] : null;

  const reset = () => {
    setSubtype('');
    setImageUrl('');
    setDescription('');
    setResolutionDatetime('');
    setAssetName('');
    setAssetSymbol('');
    setTargetPrice('');
    setAssetAName('');
    setAssetAImage('');
    setAssetBName('');
    setAssetBImage('');
    setMixedShape('binary');
    setFreeformQuestion('');
    setFreeformOutcomes([{ name: '', imageUrl: '' }, { name: '', imageUrl: '' }]);
    setFedQuestion('Fed decision in April?');
    setFedOutcomes(FED_RATES_PRESETS);
    setError(null);
  };

  const formatPrice = (p: string) => {
    const n = parseFloat(p);
    if (Number.isNaN(n)) return p;
    return n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  const build = (): FinanceMarketPayload | string => {
    if (!subtype) return 'Pick a sub-category';
    if (!resolutionDatetime) return 'Resolution datetime required';
    if (!imageUrl) return 'Market image required';
    const resolutionTimestamp = Math.floor(new Date(resolutionDatetime).getTime() / 1000);
    const group = SUBTYPE_GROUP[subtype];
    const marketId = `finance-${subtype}-${Date.now()}`;

    let question = '';
    let outcomesData: { name: string; imageUrl: string }[] = [];

    if (shape === 'binary-template' || (shape === 'mixed' && mixedShape === 'binary')) {
      if (!assetName || !assetSymbol || !targetPrice) {
        return 'Asset name, symbol, and target price required';
      }
      const d = new Date(resolutionDatetime);
      const mmm = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const day = d.getUTCDate();
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      question = `${assetName} (${assetSymbol}) above $${formatPrice(targetPrice)} on ${mmm} ${day}, ${hh}:${mm} UTC?`;
      outcomesData = [
        { name: 'Yes', imageUrl: '' },
        { name: 'No', imageUrl: '' },
      ];
    } else if (shape === 'this-vs-that') {
      if (!assetAName || !assetBName) return 'Both asset names required';
      question = `${assetAName} vs ${assetBName}`;
      outcomesData = [
        { name: assetAName, imageUrl: assetAImage },
        { name: assetBName, imageUrl: assetBImage },
      ];
    } else if (shape === 'mixed' && mixedShape === 'multi') {
      if (!freeformQuestion) return 'Question required';
      const valid = freeformOutcomes.filter((o) => o.name.trim());
      if (valid.length < 2) return 'At least 2 outcomes required';
      question = freeformQuestion;
      outcomesData = valid;
    } else if (shape === 'fed-rates') {
      if (!fedQuestion) return 'Question required';
      const valid = fedOutcomes.filter((o) => o.trim());
      if (valid.length < 2) return 'At least 2 outcomes required';
      question = fedQuestion;
      outcomesData = valid.map((n) => ({ name: n, imageUrl: '' }));
    }

    return {
      marketId,
      question,
      category: 'finance',
      outcomeNames: outcomesData.map((o) => o.name),
      outcomesData,
      imageUrl,
      description,
      resolutionTimestamp,
      sport: group,
      league: subtype,
    };
  };

  const handleSubmit = async () => {
    const result = build();
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    setError(null);
    await onSubmit(result);
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-white/10 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create Finance Market</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sub-category *</label>
            <select
              value={subtype}
              onChange={(e) => {
                setSubtype(e.target.value as FinanceSubType);
                setError(null);
              }}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm"
            >
              <option value="">— Pick one —</option>
              {FINANCE_TAXONOMY.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {!subtype && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pick a sub-category to reveal the relevant fields.
            </p>
          )}

          {shape === 'binary-template' && (
            <BinaryTemplateFields
              assetName={assetName} setAssetName={setAssetName}
              assetSymbol={assetSymbol} setAssetSymbol={setAssetSymbol}
              targetPrice={targetPrice} setTargetPrice={setTargetPrice}
              description={description} setDescription={setDescription}
              resolutionDatetime={resolutionDatetime} setResolutionDatetime={setResolutionDatetime}
              imageUrl={imageUrl} setImageUrl={setImageUrl}
            />
          )}

          {shape === 'this-vs-that' && (
            <>
              <PairFields
                assetAName={assetAName} setAssetAName={setAssetAName}
                assetAImage={assetAImage} setAssetAImage={setAssetAImage}
                assetBName={assetBName} setAssetBName={setAssetBName}
                assetBImage={assetBImage} setAssetBImage={setAssetBImage}
              />
              <SharedFields
                description={description} setDescription={setDescription}
                resolutionDatetime={resolutionDatetime} setResolutionDatetime={setResolutionDatetime}
                imageUrl={imageUrl} setImageUrl={setImageUrl}
              />
            </>
          )}

          {shape === 'mixed' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Market Shape</label>
                <div className="flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMixedShape('binary')}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      mixedShape === 'binary'
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Binary (above $X)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMixedShape('multi')}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      mixedShape === 'multi'
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Multi (custom outcomes)
                  </button>
                </div>
              </div>

              {mixedShape === 'binary' ? (
                <BinaryTemplateFields
                  assetName={assetName} setAssetName={setAssetName}
                  assetSymbol={assetSymbol} setAssetSymbol={setAssetSymbol}
                  targetPrice={targetPrice} setTargetPrice={setTargetPrice}
                  description={description} setDescription={setDescription}
                  resolutionDatetime={resolutionDatetime} setResolutionDatetime={setResolutionDatetime}
                  imageUrl={imageUrl} setImageUrl={setImageUrl}
                />
              ) : (
                <>
                  <FreeformMultiFields
                    question={freeformQuestion} setQuestion={setFreeformQuestion}
                    outcomes={freeformOutcomes} setOutcomes={setFreeformOutcomes}
                  />
                  <SharedFields
                    description={description} setDescription={setDescription}
                    resolutionDatetime={resolutionDatetime} setResolutionDatetime={setResolutionDatetime}
                    imageUrl={imageUrl} setImageUrl={setImageUrl}
                  />
                </>
              )}
            </>
          )}

          {shape === 'fed-rates' && (
            <>
              <FedRatesFields
                question={fedQuestion} setQuestion={setFedQuestion}
                outcomes={fedOutcomes} setOutcomes={setFedOutcomes}
              />
              <SharedFields
                description={description} setDescription={setDescription}
                resolutionDatetime={resolutionDatetime} setResolutionDatetime={setResolutionDatetime}
                imageUrl={imageUrl} setImageUrl={setImageUrl}
              />
            </>
          )}

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
            <Button
              variant="predensity"
              onClick={handleSubmit}
              disabled={isSubmitting || !subtype}
              className="flex-1"
            >
              {isSubmitting ? 'Creating...' : 'Create Market'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SharedFieldsProps {
  description: string;
  setDescription: (v: string) => void;
  resolutionDatetime: string;
  setResolutionDatetime: (v: string) => void;
  imageUrl: string;
  setImageUrl: (v: string) => void;
}

function SharedFields({ description, setDescription, resolutionDatetime, setResolutionDatetime, imageUrl, setImageUrl }: SharedFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Market Image URL *</label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm placeholder:text-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Describe the market and resolution criteria..."
          className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm placeholder:text-gray-400 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Resolution Date (UTC) *</label>
        <input
          type="datetime-local"
          value={resolutionDatetime}
          onChange={(e) => setResolutionDatetime(e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Your local browser time; stored and displayed in UTC.
        </p>
      </div>
    </>
  );
}

interface BinaryTemplateFieldsProps extends SharedFieldsProps {
  assetName: string;
  setAssetName: (v: string) => void;
  assetSymbol: string;
  setAssetSymbol: (v: string) => void;
  targetPrice: string;
  setTargetPrice: (v: string) => void;
}

function BinaryTemplateFields(props: BinaryTemplateFieldsProps) {
  const { assetName, setAssetName, assetSymbol, setAssetSymbol, targetPrice, setTargetPrice } = props;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset Name *</label>
          <input
            type="text"
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            placeholder="Gold"
            className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm placeholder:text-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Symbol *</label>
          <input
            type="text"
            value={assetSymbol}
            onChange={(e) => setAssetSymbol(e.target.value.toUpperCase())}
            placeholder="PAXG"
            className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm placeholder:text-gray-400"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Price (USD) *</label>
        <input
          type="number"
          step="0.0001"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          placeholder="4782.48"
          className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm placeholder:text-gray-400"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Outcomes: <strong>Yes</strong> / <strong>No</strong>. Resolves YES if asset price is above this target at resolution time.
        </p>
      </div>
      <SharedFields
        description={props.description} setDescription={props.setDescription}
        resolutionDatetime={props.resolutionDatetime} setResolutionDatetime={props.setResolutionDatetime}
        imageUrl={props.imageUrl} setImageUrl={props.setImageUrl}
      />
    </>
  );
}

interface PairFieldsProps {
  assetAName: string;
  setAssetAName: (v: string) => void;
  assetAImage: string;
  setAssetAImage: (v: string) => void;
  assetBName: string;
  setAssetBName: (v: string) => void;
  assetBImage: string;
  setAssetBImage: (v: string) => void;
}

function PairFields({ assetAName, setAssetAName, assetAImage, setAssetAImage, assetBName, setAssetBName, assetBImage, setAssetBImage }: PairFieldsProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Asset pair * (2 outcomes — no Draw)</label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 p-3 bg-gray-50 dark:bg-neutral-900 rounded border border-gray-200 dark:border-neutral-700">
          <input
            type="text"
            value={assetAName}
            onChange={(e) => setAssetAName(e.target.value)}
            placeholder="Asset A (e.g., BTC)"
            className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
          />
          <input
            type="url"
            value={assetAImage}
            onChange={(e) => setAssetAImage(e.target.value)}
            placeholder="Asset A logo URL"
            className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>
        <div className="space-y-2 p-3 bg-gray-50 dark:bg-neutral-900 rounded border border-gray-200 dark:border-neutral-700">
          <input
            type="text"
            value={assetBName}
            onChange={(e) => setAssetBName(e.target.value)}
            placeholder="Asset B (e.g., Gold)"
            className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
          />
          <input
            type="url"
            value={assetBImage}
            onChange={(e) => setAssetBImage(e.target.value)}
            placeholder="Asset B logo URL"
            className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>
      </div>
    </div>
  );
}

interface FreeformMultiFieldsProps {
  question: string;
  setQuestion: (v: string) => void;
  outcomes: { name: string; imageUrl: string }[];
  setOutcomes: (v: { name: string; imageUrl: string }[]) => void;
}

function FreeformMultiFields({ question, setQuestion, outcomes, setOutcomes }: FreeformMultiFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question *</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What will WTI Crude Oil hit in April 2026?"
          className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm placeholder:text-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Outcomes (min 2) *</label>
        <div className="space-y-2">
          {outcomes.map((o, i) => (
            <div key={i} className="flex gap-2 p-3 bg-gray-50 dark:bg-neutral-900 rounded border border-gray-200 dark:border-neutral-700">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={o.name}
                  onChange={(e) => {
                    const next = [...outcomes];
                    next[i] = { ...next[i], name: e.target.value };
                    setOutcomes(next);
                  }}
                  placeholder={`Outcome ${i + 1} (e.g., "$3.800" or "↑ $120")`}
                  className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                />
                <input
                  type="url"
                  value={o.imageUrl}
                  onChange={(e) => {
                    const next = [...outcomes];
                    next[i] = { ...next[i], imageUrl: e.target.value };
                    setOutcomes(next);
                  }}
                  placeholder="Outcome image URL (optional)"
                  className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                />
              </div>
              {outcomes.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOutcomes(outcomes.filter((_, idx) => idx !== i))}
                  className="px-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOutcomes([...outcomes, { name: '', imageUrl: '' }])}
            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-neutral-500"
          >
            + Add outcome
          </button>
        </div>
      </div>
    </>
  );
}

interface FedRatesFieldsProps {
  question: string;
  setQuestion: (v: string) => void;
  outcomes: string[];
  setOutcomes: (v: string[]) => void;
}

function FedRatesFields({ question, setQuestion, outcomes, setOutcomes }: FedRatesFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question *</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Fed decision in April?"
          className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-gray-900 dark:text-white text-sm placeholder:text-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Outcomes (edit presets) *</label>
        <div className="space-y-2">
          {outcomes.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={o}
                onChange={(e) => {
                  const next = [...outcomes];
                  next[i] = e.target.value;
                  setOutcomes(next);
                }}
                className="flex-1 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-900 dark:text-white"
              />
              {outcomes.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOutcomes(outcomes.filter((_, idx) => idx !== i))}
                  className="px-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOutcomes([...outcomes, ''])}
            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-neutral-500"
          >
            + Add outcome
          </button>
        </div>
      </div>
    </>
  );
}
