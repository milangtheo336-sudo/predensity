# Predensity Frontend

A Next.js-based prediction market platform with non-custodial wallet integration using Magic Link.

## Features

- Non-custodial authentication with Magic Link (Google OAuth + Email)
- Multi-category prediction markets (Crypto, Politics, Sports, Technology)
- CLOB (Central Limit Order Book) trading system
- Real-time market data with Convex
- Arc blockchain integration (EVM-compatible L1)
- M-Pesa payment integration (Kenya)
- Dark/Light theme support
- Mobile-responsive design

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Authentication**: Magic Link SDK
- **Database**: Convex
- **Blockchain**: Hedera Hashgraph
- **Wallet**: Hashgraph React Wallets
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **State Management**: React Context + Convex

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Convex account
- Magic Link account
- Hedera testnet account (for development)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/i-mwangi/frontend.git
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your own credentials:
- `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` - Get from Magic Link dashboard
- `MAGIC_SECRET_KEY` - Get from Magic Link dashboard
- `NEXT_PUBLIC_CONVEX_URL` - Get from Convex dashboard
- `CONVEX_DEPLOYMENT` - Your Convex deployment ID
- Other API keys as needed

4. Run Convex development:
```bash
npm run convex:dev
```

5. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

See `.env.local.example` for all required environment variables.

**Important**: Never commit your `.env.local` file. It contains sensitive API keys.

## Project Structure

```
frontend/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── context/          # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   └── styles/           # Global styles
├── convex/               # Convex backend functions
├── abi/                  # Smart contract ABIs
├── public/               # Static assets
└── scripts/              # Utility scripts
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run convex:dev` - Start Convex development
- `npm run convex:deploy` - Deploy Convex functions

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms

Build the project:
```bash
npm run build
```

Start the production server:
```bash
npm run start
```

## License

Private - All rights reserved

## Support

For issues or questions, contact: mwangihenry336@gmail.com
