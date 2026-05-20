# Predensity v2: Hybrid CLOB Politics Prediction Market

## Integration Analysis with Current System

### How Your Current System Actually Works (The Operator Model)

Your system is NOT a typical DApp where users connect wallets and sign transactions. It's a **custodial operator model**:

1. User signs up via Clerk (email/social auth, no wallet needed)
2. Server auto-creates a Hedera account for them (managed wallet) with an encrypted private key stored in Convex
3. User deposits USDC via QR code transfer or M-Pesa -- balance tracked in Convex `managedWallets.usdcBalance`
4. When user places a bet, the **server-side API route** uses the **operator/treasury key** to call `placeBetWithToken()` on the smart contract
5. The contract sees the operator as the bettor (not the user). The user's identity is tracked off-chain in Convex as `managed:{userId}`
6. On resolution, the admin submits prices, processes batches, and auto-claims winning bets -- all using the operator key
7. Winnings are credited back to the user's Convex `usdcBalance`

This means: **EIP-712 signed intents are NOT needed**. Your users never sign anything on-chain. The operator handles all chain interactions.

---

### Mapping the New Architecture onto Your Operator Model

The executive summary proposes a Hybrid CLOB with YES/NO tokens. Here's how each layer maps to your existing system:


#### Layer 1: Off-Chain Trading (Convex) -- MAPS DIRECTLY

**Current system**: Convex stores bets, balances, user data. Bets are placed via API routes.
**New system**: Convex stores the order book (bids/asks), matches orders, tracks positions.

What changes:
- New Convex tables: `orders` (bid/ask with price, quantity, side), `trades` (matched pairs), `positions` (user YES/NO token balances)
- New Convex mutations: `placeOrder`, `cancelOrder`, `matchOrders`
- The matching engine runs as a Convex mutation (deterministic, reactive, free)
- Frontend subscribes to order book changes in real-time (Convex reactive queries)

What stays the same:
- `managedWallets` table and balance tracking
- User auth via Clerk
- Deposit/withdraw flow
- The operator model (server signs all chain transactions)

Cost impact on Convex:
- NO cron jobs needed for matching (mutations trigger on order placement)
- NO mirror node polling (all state is in Convex)
- Reactive queries replace polling (cheaper than intervals)
- Only the operator bot submission triggers chain calls

#### Layer 2: Token Layer (HTS YES/NO Tokens) -- NEW

**Current system**: No outcome tokens. Bets are stored as contract state (struct in mapping).
**New system**: Each market has two native HTS fungible tokens (YES and NO).

What changes:
- Admin creates a market: deploys YES token + NO token via HTS `createFungibleToken`
- The Market Manager contract mints/burns these tokens
- Users "split" USDC into YES+NO tokens (1 USDC = 1 YES + 1 NO)
- Users trade YES/NO tokens on the order book

How it works with your operator model:
- User wants to buy YES shares at $0.65
- API route receives the order, stores in Convex order book
- Matching engine finds a seller
- Operator bot calls the Exchange contract to execute the atomic swap
- Operator signs the transaction (same as current bet placement)
- NO EIP-712 needed -- the operator is the trusted intermediary


#### Layer 3: On-Chain Settlement (Hedera Contracts) -- REPLACES CURRENT CONTRACTS

**Current system**: Single `BasePredictionMarket.sol` per category. Holds USDC, tracks bets, resolves, pays out.
**New system**: Two contracts per market type.

Contract A: Market Manager (Split/Redeem)
- `splitPosition(uint256 usdcAmount)`: Takes USDC from operator, mints equal YES+NO tokens to operator
- `redeemWinning(uint256 tokenAmount)`: After resolution, burns winning tokens, returns USDC to operator
- Uses HTS pre-compiles: `IHederaTokenService.mintToken()`, `IHederaTokenService.burnToken()`
- Operator calls this on behalf of users (same pattern as current `placeBetWithToken`)

Contract B: Exchange Settlement (Atomic Swap)
- `settleTrade(address maker, address taker, uint256 yesAmount, uint256 usdcAmount, bool makerBuysYes)`: Executes atomic swap
- Uses HTS pre-compile: `IHederaTokenService.cryptoTransfer()` for atomic multi-token transfer
- Operator submits matched trades from Convex order book
- Both sides of the trade use the operator's token balances (since all users are managed)

Key simplification: Since ALL users are managed wallets and the operator holds all tokens, the atomic swap is actually just the operator moving tokens between its own internal accounting. The on-chain swap is between the operator and itself (or between the operator's sub-accounts). This massively simplifies the token association problem.

---

### The Real Nightmares (Specific to Your System)


1. **HTS Token Creation from Solidity**
   - Creating HTS tokens via the pre-compile requires the contract to have a supply key
   - The contract must be the treasury for the YES/NO tokens (or have mint/burn authority)
   - Token association: the operator account must associate with every YES/NO token pair for every market
   - Cost: ~0.05 HBAR per token association, ~1 HBAR per token creation
   - With 50 politics markets, that's 100 token creations + 100 operator associations = ~150 HBAR upfront

2. **Operator Balance Accounting**
   - Currently: operator holds USDC, contract holds USDC after bet placement
   - New system: operator holds USDC + YES tokens + NO tokens for ALL users
   - You need bulletproof off-chain accounting in Convex to track which user owns which tokens
   - If Convex state and on-chain state diverge, users lose money
   - Solution: every on-chain transaction must be verified against Convex state before and after

3. **Order Book Matching Edge Cases**
   - Partial fills: User A wants to buy 100 YES at $0.65, but only 40 are available
   - Stale orders: User places order, then withdraws their USDC before it fills
   - Race conditions: Two orders match simultaneously in Convex mutations (Convex handles this with serializable transactions, but you need to design for it)
   - Price boundaries: YES price must be 0-1 USDC. YES + NO must always equal 1 USDC.

4. **Resolution and Redemption**
   - Current system: admin submits price, processBatch finalizes bets, auto-claim pays winners
   - New system: admin resolves market (YES wins or NO wins), winning token holders redeem 1:1 for USDC
   - The operator must redeem on behalf of all managed wallet users
   - Need a new auto-redeem endpoint similar to current auto-claim

5. **Migration from Current Politics Contract**
   - Existing bets on the current BasePredictionMarket cannot be migrated
   - You need to let current markets resolve naturally before switching
   - New markets use the new system, old markets stay on the old contract
   - Frontend detects which system a market uses and renders the appropriate UI

---

### What Changes in the Frontend


The `politics-prediction-card.tsx` gets a complete rewrite:

**Current UI**: Price range selector (min/max) + stake amount + resolution date
**New UI**: YES/NO share buying interface

- Order book display (bids on left, asks on right)
- Buy YES / Buy NO buttons with price input
- Current YES price shown as percentage (e.g., YES at $0.65 = 65% probability)
- Position display: "You hold 50 YES shares (cost basis: $0.60)"
- Sell button to exit position before resolution
- Price chart showing YES share price over time (replaces KDE chart)

The `prediction-card.tsx` (crypto) stays unchanged -- it uses the existing DPM system.

---

### Convex Cost Reduction

Current costs:
- Cron jobs (disabled but designed for): syncFromMirrorNode every 30s, detectDeposits every 60s
- Client-side mirror node polling in header (every 30s for deposit detection)
- Multiple Convex queries per page load for bets, markets, events

New system costs:
- NO cron jobs at all -- order book is native to Convex
- NO mirror node polling -- all state is in Convex
- Matching engine runs as mutations (included in Convex free tier)
- Operator bot only hits the chain when trades are matched (batched, not per-order)
- Reactive subscriptions replace polling (more efficient)

Estimated reduction: 60-80% fewer Convex function calls.

---

### Implementation Order

1. **Smart Contracts**: Market Manager + Exchange Settlement (Solidity + HTS pre-compiles)
2. **Convex Schema**: orders, trades, positions tables + matching engine mutations
3. **API Routes**: /api/market/split, /api/market/redeem, /api/trade/settle
4. **Operator Bot**: Convex action that watches for matched trades and submits to chain
5. **Frontend**: New politics prediction card with order book UI
6. **Admin**: Market creation (deploy YES/NO tokens), resolution, auto-redeem

### What You Keep

- Clerk auth, managed wallets, deposit/withdraw flow
- Operator key model (server signs everything)
- Convex as the source of truth for user balances
- Header, portfolio page, profile system
- Crypto prediction card (unchanged)
- All existing infrastructure (Vercel, Convex, Hedera)


---

## Early Exit (Secondary Market Trading) -- How It Works in Your System

The CLOB architecture enables buying low and selling high before resolution. Here's exactly how it flows through your operator model:

### The Mechanism

The order book in Convex is a two-sided market. At any time, there are:
- **Bids**: Users wanting to BUY YES tokens at a certain price
- **Asks**: Users wanting to SELL YES tokens at a certain price

When a bid and ask match (same price), the Convex matching engine records the trade. The operator bot then settles it on-chain via the Exchange contract's atomic swap.

### How Early Exit Works with Your Operator Model

Since all users are managed wallets and the operator holds all tokens on-chain, the "atomic swap" is actually the operator updating its internal ledger in Convex, then periodically reconciling with the chain.

**Step-by-step flow for an early exit:**

1. User A holds 100 YES tokens (tracked in Convex `positions` table, not in their wallet)
2. User A submits a sell order: "Sell 100 YES at $0.80" via API route
3. Convex stores this as an ask in the `orders` table
4. User B submits a buy order: "Buy 100 YES at $0.80" via API route
5. Convex matching engine detects the match in a mutation
6. Convex atomically updates:
   - User A: -100 YES tokens, +80 USDC to `managedWallets.usdcBalance`
   - User B: +100 YES tokens, -80 USDC from `managedWallets.usdcBalance`
   - Trade recorded in `trades` table
7. Operator bot batches this trade and settles on-chain (for auditability)

The user sees instant execution because Convex updates are reactive. The on-chain settlement happens asynchronously.

### Profit Scenario (Your Political Election Example)

```
Entry:  Buy 100 YES at $0.40 = 40 USDC deducted from Convex balance
        Convex positions: { userId: "user_abc", market: "election-2026", yes: 100, costBasis: 40 }

Shift:  Market moves to $0.80 (news favors Candidate A)
        Order book shows bids at $0.80

Exit:   User places sell order: 100 YES at $0.80
        Matching engine fills against a buyer
        Convex balance: +80 USDC
        Convex positions: { yes: 0 }

Result: Entered with 40 USDC, exited with 80 USDC = +40 USDC profit (100%)
        Never waited for resolution
```

### Loss Mitigation Scenario (Your Sports Example)

```
Entry:  Buy 100 YES at $0.70 = 70 USDC deducted
        Convex positions: { yes: 100, costBasis: 70 }

Shift:  Star player injured, market crashes to $0.20

Exit:   User places sell order: 100 YES at $0.20
        Matching engine fills
        Convex balance: +20 USDC
        Convex positions: { yes: 0 }

Result: Entered with 70 USDC, exited with 20 USDC = -50 USDC loss
        But saved 20 USDC vs losing all 70 at resolution
```

### What Makes This Work in Your System

1. **No wallet interaction needed**: User clicks "Sell" in the UI, API route handles everything
2. **Instant execution**: Convex mutation matches and updates balances in milliseconds
3. **No gas for users**: Operator settles on-chain in batches
4. **Price discovery**: The order book naturally discovers the probability price through supply/demand
5. **Liquidity**: The more users trading, the tighter the spread between bid and ask

### On-Chain Settlement (Auditability Layer)

The operator bot periodically settles matched trades on-chain:

```
Operator bot detects: Trade #1234 matched (User A sells 100 YES to User B at $0.80)
Operator calls: Exchange.settleTrade(operatorAddress, operatorAddress, 100 YES, 80 USDC)
On-chain: YES tokens move within operator's balance, USDC moves within operator's balance
Result: On-chain state matches Convex state (auditable)
```

Since the operator holds all tokens for all managed users, the on-chain settlement is between the operator and itself. The real accounting happens in Convex. The chain provides an immutable audit trail.

### Edge Case: No Buyer Available

If a user wants to exit but no one is buying:
- Their sell order sits in the order book as an ask
- They can lower their price to attract buyers
- Or they can wait for resolution (same as current system)
- The UI shows "Open Orders" with the ability to cancel

This is identical to how stock markets work -- you can always place a limit order, but it only fills if someone takes the other side.
