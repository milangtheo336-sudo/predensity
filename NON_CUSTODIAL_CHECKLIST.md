# Non-Custodial Implementation Checklist

## Phase 1: Smart Contracts (30 minutes)

- [ ] Deploy SimpleProxyWallet.sol to Hedera testnet
- [ ] Deploy ProxyWalletFactory.sol to Hedera testnet
- [ ] Save factory contract ID to .env.local
- [ ] Test wallet creation with factory
- [ ] Verify wallet ownership on Hedera explorer

**Commands:**
```bash
cd smartContracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy-proxy-factory.js --network hedera-testnet
```

---

## Phase 2: Magic Link Setup (15 minutes)

- [ ] Sign up at https://dashboard.magic.link
- [ ] Create new app
- [ ] Get publishable key (pk_live_...)
- [ ] Get secret key (sk_live_...)
- [ ] Add keys to frontend/.env.local
- [ ] Install Magic SDK: `npm install magic-sdk @magic-ext/hedera`

**Environment variables:**
```
NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY=pk_live_XXXXXXXX
MAGIC_SECRET_KEY=sk_live_XXXXXXXX
PROXY_WALLET_FACTORY_CONTRACT_ID=0.0.XXXXXX
USDC_TOKEN_ID=0.0.XXXXXX
```

---

## Phase 3: Remove Clerk (20 minutes)

- [ ] Uninstall Clerk: `npm uninstall @clerk/nextjs`
- [ ] Remove ClerkProvider from app layout
- [ ] Remove Clerk middleware
- [ ] Delete frontend/src/middleware.ts (if Clerk-only)
- [ ] Remove all `useUser()` imports from @clerk/nextjs
- [ ] Remove all `requireAuthMatchingUser()` calls (replaced by signature verification)

---

## Phase 4: Update Frontend Components (45 minutes)

### 4.1 Authentication Pages
- [ ] Update frontend/src/app/signup/page.tsx - Use Magic Link
- [ ] Update frontend/src/app/login/page.tsx - Use Magic Link
- [ ] Create logout button with `logoutMagic()`

### 4.2 CLOB Trading Card
- [ ] Update frontend/src/components/clob-prediction-card.tsx
- [ ] Add Magic Link signing to handlePlaceOrder
- [ ] Add Magic Link signing to handleCancelOrder
- [ ] Show "Sign with Magic Link" prompt
- [ ] Handle signature errors gracefully

### 4.3 User Context
- [ ] Create frontend/src/context/magic-user-context.tsx
- [ ] Replace Clerk user context with Magic user context
- [ ] Update all components using user.id

**Reference:** See `frontend/src/components/clob-order-signing-example.tsx`

---

## Phase 5: Database Migration (10 minutes)

- [ ] Run Convex schema push: `npx convex dev`
- [ ] Verify managedWallets table updated
- [ ] Verify orderNonces table created
- [ ] Check indexes created successfully

---

## Phase 6: Testing (30 minutes)

### 6.1 Wallet Creation
- [ ] Sign up with test email
- [ ] Verify Magic Link email received
- [ ] Click magic link
- [ ] Verify proxy wallet deployed
- [ ] Check wallet address on Hedera explorer

### 6.2 M-Pesa Deposit
- [ ] Make test M-Pesa deposit (100 KES)
- [ ] Verify USDC transferred to proxy wallet
- [ ] Check transaction on Hedera explorer
- [ ] Verify balance updated in UI

### 6.3 Order Placement
- [ ] Place buy order
- [ ] Verify Magic Link signature prompt appears
- [ ] Sign order
- [ ] Verify order appears in order book
- [ ] Check funds deducted from wallet

### 6.4 Order Matching
- [ ] Place matching sell order
- [ ] Verify trade executes
- [ ] Check positions updated
- [ ] Verify settlement bot picks up trade

### 6.5 Settlement
- [ ] Run settlement bot
- [ ] Verify trade settled on-chain
- [ ] Check outcome tokens transferred
- [ ] Verify using proxy wallet addresses

---

## Phase 7: Security Audit (15 minutes)

- [ ] Verify NO private keys in database
- [ ] Verify NO encryptedPrivateKey fields populated
- [ ] Check operator key only used for: deployment, bridging, settlement
- [ ] Verify signature verification works
- [ ] Test nonce replay attack (should fail)
- [ ] Test signature from wrong address (should fail)

---

## Phase 8: Cleanup (10 minutes)

- [ ] Delete frontend/src/app/api/wallet/create-turnkey/route.ts
- [ ] Delete frontend/src/lib/turnkey.ts
- [ ] Remove Turnkey dependencies from package.json
- [ ] Remove WALLET_ENCRYPTION_KEY from .env.local
- [ ] Remove Clerk keys from .env.local
- [ ] Update README.md with new auth flow

---

## Total Time: ~3 hours

## Rollback Plan

If something breaks:
1. Keep old custodial code in git branch
2. Can revert database schema
3. Re-enable Clerk temporarily
4. Debug Magic Link integration
5. Test with small amounts first

---

## Success Criteria

- [ ] New users can sign up with Magic Link
- [ ] Proxy wallets deploy successfully
- [ ] M-Pesa deposits bridge to user wallets
- [ ] Orders require user signatures
- [ ] Settlement uses proxy wallet addresses
- [ ] NO private keys stored on backend
- [ ] Operator key cannot drain user funds
