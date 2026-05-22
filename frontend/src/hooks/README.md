# Contract Reading Hooks

Production-ready React hooks for interacting with deployed Hedera prediction market contracts.

## Available Hooks

### useBetSimulation(category?: Category)

Comprehensive hook for reading bet data and simulating bets across all categories.

**Functions:**
- `simulatePlaceBet(targetTimestamp, priceMin, priceMax, stakeAmount?, targetCategory?)` - Simulate a bet before placing
- `getBet(betId, targetCategory?)` - Get bet details by ID
- `getBucketInfo(bucket, targetCategory?)` - Get aggregated bucket information
- `getResolvedValue(timestamp, targetCategory?)` - Get resolved value for a timestamp
- `getStats(targetCategory?)` - Get contract statistics (total bets, fees, balance)
- `isTrustedOracle(address, targetCategory?)` - Check if address is a trusted oracle
- `getRequiredConfirmations(targetCategory?)` - Get required oracle confirmations

**Usage:**
```typescript
import { useBetSimulation } from '@/hooks/useBetSimulation';
import { Category } from '@/lib/types/categories';

// For a specific category
const { simulatePlaceBet, getBet, getStats } = useBetSimulation(Category.CRYPTO);

// Simulate a bet
const simulation = await simulatePlaceBet(
  '1710000000', // target timestamp
  '0.26',       // min price
  '0.29',       // max price
  '10'          // stake amount in HBAR
);

// Get bet details
const bet = await getBet('0');

// Get contract stats
const stats = await getStats();
```

### useContractMultipliers(category?: Category)

Hook for calculating quality multipliers (sharpness and time).

**Functions:**
- `getSharpnessMultiplier(priceMin, priceMax, targetCategory?)` - Calculate sharpness multiplier based on range width
- `getTimeMultiplier(targetTimestamp, targetCategory?)` - Calculate time multiplier based on lead time

**Usage:**
```typescript
import { useContractMultipliers } from '@/hooks/useContractMultipliers';
import { Category } from '@/lib/types/categories';

const { getSharpnessMultiplier, getTimeMultiplier } = useContractMultipliers(Category.CRYPTO);

// Get multipliers
const sharpness = await getSharpnessMultiplier('26000000', '29000000');
const time = await getTimeMultiplier('1710000000');
```

### useHbarPrice()

Hook for fetching current HBAR price from CoinGecko API.

**Functions:**
- `fetchHbarPrice()` - Get current HBAR price in USD

**Usage:**
```typescript
import { useHbarPrice } from '@/hooks/useHbarPrice';

const { fetchHbarPrice } = useHbarPrice();
const price = await fetchHbarPrice();
```

## Multi-Category Support

All hooks support multi-category contracts. You can:

1. **Set default category on hook initialization:**
```typescript
const { getBet } = useBetSimulation(Category.CRYPTO);
const bet = await getBet('0'); // Uses CRYPTO contract
```

2. **Override category per function call:**
```typescript
const { getBet } = useBetSimulation(Category.CRYPTO);
const cryptoBet = await getBet('0', Category.CRYPTO);
const politicsBet = await getBet('1', Category.POLITICS);
```

## Deployed Contracts

Current testnet deployments:
- Crypto: `0x6838b522df4E7666E72dbDe1d79B4CA0fE00c683`
- Politics: `0xA5004b50F5806b2008415E9189721D57A0cd5cdB`
- Sports: `0x556972230eb075dc2B8De643EBd6E81b25A234a4`
- Technology: `0x6C72970f92c96955b1b0C169b0C442444cd3c119`

See `frontend/src/lib/contracts/contract-config.ts` for configuration.

## Error Handling

All hooks include error handling and return `null` on failure. Always check for null returns:

```typescript
const bet = await getBet('0');
if (bet) {
  // Use bet data
} else {
  // Handle error
}
```

## Type Safety

All hooks are fully typed with TypeScript interfaces. Import types as needed:

```typescript
import type { Bet, BetSimulation, BucketInfo, ContractStats } from '@/hooks/useBetSimulation';
```

## Production Considerations

1. **Network Configuration**: Update `CURRENT_NETWORK` in `contract-config.ts` for mainnet
2. **Error Monitoring**: Add error tracking service integration
3. **Caching**: Consider implementing React Query or SWR for data caching
4. **Rate Limiting**: Implement request throttling for high-frequency calls
5. **Fallback**: Add fallback RPC endpoints for reliability
