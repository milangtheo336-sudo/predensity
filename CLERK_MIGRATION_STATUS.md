# Clerk to Magic Link Migration Status

## Completed

### 1. Core Infrastructure
- [x] Installed Magic SDK packages
- [x] Created Magic Link library (`frontend/src/lib/magic.ts`)
- [x] Created MagicContext (`frontend/src/context/MagicContext.tsx`)
- [x] Updated layout.tsx (replaced ClerkProvider with MagicProvider)
- [x] Updated API auth library (`frontend/src/lib/api-auth.ts`)
- [x] Deleted Clerk middleware
- [x] Uninstalled Clerk and Turnkey packages
- [x] Deleted Turnkey files

### 2. Smart Contracts
- [x] Upgraded to EIP-1167 minimal proxy
- [x] Added Hedera token association
- [x] Created deployment script

### 3. API Routes
- [x] Wallet creation API (uses Magic)
- [x] M-Pesa bridge API
- [x] Order API (signature verification)

### 4. Database Schema
- [x] Updated managedWallets table
- [x] Added orderNonces table

### 5. Components Updated
- [x] mobile-bottom-nav.tsx
- [x] support-chat.tsx
- [x] category-tabs.tsx
- [x] profile/[id]/page.tsx
- [x] my-bets/page.tsx
- [x] prediction-card.tsx
- [x] clob-prediction-card.tsx
- [x] ctrl-x7k9m2/page.tsx (admin)
- [x] settings/page.tsx

## Still Needs Work

### 1. Header Component (`frontend/src/components/header.tsx`)

**Issues:**
- Still imports `SignInButton, SignUpButton, useUser, useClerk`
- Uses `signOut` from Clerk
- Multiple references to `user.id` (should be `user.issuer`)

**What to do:**
1. Replace imports:
```typescript
import { useMagic } from '@/context/MagicContext';
import Link from 'next/link';
```

2. Replace SignInButton/SignUpButton with Link to `/auth`:
```typescript
<Link href="/auth">
  <Button>Log in</Button>
</Link>
```

3. Replace `useUser()` with `useMagic()`:
```typescript
const { user, logout } = useMagic();
const isSignedIn = !!user;
```

4. Replace `signOut()` with `logout()`:
```typescript
onClick={() => { logout(); onClose(); }}
```

5. Replace `user.id` with `user.issuer` throughout

### 2. CLOB Card - Add Order Signing

**File:** `frontend/src/components/clob-prediction-card.tsx`

**What to add:**
```typescript
import { signTypedData, getDIDToken } from '@/lib/magic';

// When placing order:
const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);

const domain = {
  name: 'Predensity CLOB',
  version: '1',
  chainId: 296,
};

const types = {
  Order: [
    { name: 'marketId', type: 'string' },
    { name: 'outcomeIndex', type: 'uint256' },
    { name: 'side', type: 'string' },
    { name: 'price', type: 'uint256' },
    { name: 'quantity', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

const message = {
  marketId: market.id,
  outcomeIndex: selectedOutcome,
  side: 'buy',
  price: Math.floor(price * 100),
  quantity: Math.floor(quantity * 1e6),
  nonce,
};

const signature = await signTypedData(domain, types, message);
const didToken = await getDIDToken();

const response = await fetch('/api/clob/order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${didToken}`,
  },
  body: JSON.stringify({
    userId: user.issuer,
    marketId: market.id,
    outcomeIndex: selectedOutcome,
    side: 'buy',
    price: Math.floor(price * 100),
    quantity: Math.floor(quantity * 1e6),
    signature,
    nonce,
  }),
});
```

### 3. Wallet Creation Flow

**File:** `frontend/src/components/header.tsx`

**Issue:** Still references `/api/wallet/create-turnkey`

**Fix:** Update to use `/api/wallet/create` with Magic:
```typescript
const didToken = await getDIDToken();
const userInfo = await getUserInfo();

fetch('/api/wallet/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${didToken}`,
  },
  body: JSON.stringify({
    userId: userInfo.issuer,
    email: userInfo.email,
    magicEOAAddress: userInfo.publicAddress,
  }),
});
```

### 4. Deploy Smart Contracts

```bash
cd smartContracts
npx hardhat compile
node scripts/deploy-proxy-factory.js

# Add to .env.local:
# PROXY_WALLET_FACTORY_CONTRACT_ID=0.0.XXXXXXX
```

### 5. Withdraw Old Treasury

```bash
node frontend/scripts/withdraw-treasury.js
```

## Testing Checklist

- [ ] Sign up with Magic Link
- [ ] Verify proxy wallet deployed
- [ ] Make M-Pesa deposit
- [ ] Verify USDC bridged
- [ ] Place CLOB order with signature
- [ ] Cancel order with signature
- [ ] Test admin page access
- [ ] Verify no Clerk references remain

## Search Commands

Find remaining Clerk references:
```bash
grep -r "@clerk" frontend/src --include="*.ts" --include="*.tsx"
grep -r "useUser()" frontend/src --include="*.ts" --include="*.tsx"
grep -r "SignInButton\|SignUpButton" frontend/src --include="*.ts" --include="*.tsx"
grep -r "user\.id" frontend/src --include="*.ts" --include="*.tsx"
```

Find remaining Turnkey references:
```bash
grep -r "turnkey\|TURNKEY" frontend/src --include="*.ts" --include="*.tsx"
```
