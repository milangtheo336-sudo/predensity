# Quick Bot Setup - 3 Steps

## Step 1: Get Your User ID

Visit: **http://localhost:3000/bot-setup**

This page shows your Magic Link user ID and generates the complete bot configuration file.

## Step 2: Save Configuration

Copy the environment file from the bot-setup page and save it as:

```
frontend/scripts/.env.market-maker
```

## Step 3: Run the Bot

```bash
cd frontend
npx ts-node --project tsconfig.json scripts/market-maker-bot-v2.ts
```

That's it! The bot will start making markets.

## What You Need

1. **Signed in account** - Go to `/auth` to sign up/login
2. **USDC in wallet** - Deposit via M-Pesa or transfer USDC to your wallet
3. **Bot API key** - Already configured in `.env.local`

## Checking Your Balance

Go to Convex dashboard:
1. https://dashboard.convex.dev
2. Select project: `dynamic-anaconda-79`
3. Data > `managedWallets` table
4. Find your wallet by email
5. Check `usdcBalance` field

## Troubleshooting

**Bot can't place orders?**
- Check BOT_API_KEY matches in both `.env.local` and `.env.market-maker`
- Verify MM_USER_ID is correct (from /bot-setup page)
- Ensure wallet has USDC balance

**Can't find user ID?**
- Visit `/bot-setup` page while logged in
- Or check Convex `managedWallets` table

**Orders not appearing?**
- Check bot logs for errors
- Verify market exists and is open
- Ensure prices are valid (1-99)

## More Details

See `frontend/scripts/BOT_SETUP_GUIDE.md` for complete documentation.
