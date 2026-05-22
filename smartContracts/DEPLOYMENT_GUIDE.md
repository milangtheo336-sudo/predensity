# Multi-Category Prediction Markets - Deployment Guide

## Step 1: Deploy Contracts to Testnet

### Prerequisites
- Node.js and npm installed
- Hedera testnet account with HBAR balance
- Private key and account ID configured in `.env.local`

### Current Configuration
Your `.env.local` is already configured with:
- Testnet endpoint: https://testnet.hashio.io/api
- Operator account: 0.0.5792828
- Private key: configured

### Deployment Steps

#### 1. Verify Environment Setup
```bash
cd smartContracts
cat .env.local
```

Ensure these variables are set:
- TESTNET_ENDPOINT
- TESTNET_OPERATOR_PRIVATE_KEY
- TESTNET_OPERATOR_ID

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Compile Contracts
```bash
npx hardhat compile
```

#### 4. Deploy to Testnet
```bash
npx hardhat run scripts/deployMultiCategory.js --network testnet
```

This will deploy:
- CryptoPredictionMarket (for HBAR and other crypto assets)
- PoliticsPredictionMarket
- SportsPredictionMarket
- TechnologyPredictionMarket

#### 5. Save Deployment Addresses
The script automatically saves deployment info to:
- `deployments/deployment-testnet-{timestamp}.json`
- `deployments/latest-testnet.json`

### Post-Deployment Tasks

#### 1. Add Additional Oracle Addresses
You'll need 3-5 trusted oracle addresses for the multisig (currently only deployer is added).

```bash
# Add oracle to Crypto market
npx hardhat console --network testnet
> const market = await ethers.getContractAt("CryptoPredictionMarket", "CONTRACT_ADDRESS")
> await market.addTrustedOracle("ORACLE_ADDRESS_1")
> await market.addTrustedOracle("ORACLE_ADDRESS_2")
> await market.addTrustedOracle("ORACLE_ADDRESS_3")
```

Repeat for all four category contracts.

#### 2. Create Initial Markets
Create test markets for each category:

```javascript
// Crypto: HBAR price prediction
await cryptoMarket.createMarket(
  "Will HBAR reach $0.30 by March 15?",
  targetTimestamp,
  minPrice,
  maxPrice
);

// Politics: Election prediction
await politicsMarket.createMarket(
  "Will Trump win the 2024 Presidential Election?",
  targetTimestamp
);

// Sports: Game outcome
await sportsMarket.createMarket(
  "Will Lakers win the championship?",
  targetTimestamp
);

// Technology: IPO prediction
await techMarket.createMarket(
  "Will Reddit's IPO be successful by March 1, 2025?",
  targetTimestamp
);
```

#### 3. Update Frontend Configuration
Copy the contract addresses from `deployments/latest-testnet.json` to:
- `frontend/src/lib/contracts/contract-config.ts`

#### 4. Verify Deployment
Check contracts on HashScan:
- https://hashscan.io/testnet/contract/CONTRACT_ADDRESS

### Troubleshooting

**Issue: Insufficient balance**
- Fund your testnet account at: https://portal.hedera.com/
- Minimum recommended: 100 HBAR for deployment

**Issue: Network timeout**
- Increase timeout in hardhat.config.js
- Check testnet status: https://status.hedera.com/

**Issue: Contract deployment fails**
- Verify Solidity version compatibility (0.8.9)
- Check for compilation errors: `npx hardhat compile`

### Next Steps
After successful deployment:
1. Proceed to Step 2: Create basic contract reading hooks
2. Set up subgraph indexing
3. Replace mock data in frontend

### Deployment Checklist
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Contracts compiled successfully
- [ ] Deployed to testnet
- [ ] Deployment addresses saved
- [ ] Additional oracles added (3-5 total)
- [ ] Initial test markets created
- [ ] Frontend config updated
- [ ] Contracts verified on HashScan
