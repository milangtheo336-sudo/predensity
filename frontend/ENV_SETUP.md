# Environment Setup

To run this project, you need to create a `.env.local` file in the frontend directory with the following content:

```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_WALLET_CONNECT_PROJECT_ID"
```

## Getting a WalletConnect Project ID

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Sign up or log in
3. Create a new project
4. Copy the Project ID
5. Replace `YOUR_WALLET_CONNECT_PROJECT_ID` in the `.env.local` file with your actual Project ID

## Networks Supported

The application now supports:

- Ethereum Mainnet
- Arbitrum
- Hedera Testnet (default)

## Running the Application

After setting up the environment variables:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`
