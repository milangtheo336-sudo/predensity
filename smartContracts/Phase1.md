# 🚀 Predensity Prediction Market - Smart Contract Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [3-Step Development Process](#3-step-development-process)
4. [Function Reference](#function-reference)
5. [BPS System Explained](#bps-system-explained)
6. [Frontend Integration Guide](#frontend-integration-guide)
7. [Testing Guide](#testing-guide)
8. [Graph Indexing Guide](#graph-indexing-guide)

---

## 🎯 Overview

The **TestPredensityPredictionMarket** smart contract implements a prediction market system with:

- **Basis Points (BPS) System** for precise calculations
- **Quality Multipliers** based on prediction sharpness and time
- **3-Step Development Process** for frontend integration
- **Graph-ready events** for indexing and analytics

### Key Features

- ✅ Real-time validation without gas costs
- ✅ Complete fee transparency (0.5% protocol fee)
- ✅ Quality-based betting system
- ✅ Day-based bucket organization
- ✅ Graph indexing support

---

## 🔧 Core Concepts

### Basis Points (BPS) System

- **BPS_DENOM = 10000** (100% = 10000 BPS)
- **FIXED_PRICE = 3000** ($0.30 = 3000 BPS)
- **FEE_BPS = 50** (0.5% = 50 BPS)

### Quality Multipliers

1. **Sharpness Multiplier**: Based on price range precision
   - Very sharp (<2%): 2×
   - Sharp (2-5%): 1.5×
   - Moderate (5-10%): 1×
   - Wide (10-20%): 0.5×
   - Very wide (20-40%): 0.3×
   - Extremely wide (>40%): 0.1×

2. **Time Multiplier**: Based on prediction lead time
   - > 4 days: 2×
   - 2-4 days: 1.5×
   - 1-2 days: 1×
   - 8-24 hours: 0.5×
   - 2-4 hours: 0.3×
   - 1-2 hours: 0.1×
   - <1 hour: 0.1×

### Bet Weight Calculation

```
Weight = (StakeNet × QualityBps) / BPS_DENOM
QualityBps = (SharpnessBps × TimeBps) / BPS_DENOM
StakeNet = StakeAmount - Fee
Fee = (StakeAmount × FEE_BPS) / BPS_DENOM
```

---

## 🎯 3-Step Development Process

### Step 1: Simulation (Validation)

**Function:** `getBetSimulation()` / `simulatePlaceBet()`
**Purpose:** Validate user input and show preview without any transaction

```solidity
function getBetSimulation(
    uint256 targetTimestamp,
    uint256 priceMin,
    uint256 priceMax,
    uint256 stakeAmount
) external view returns (BetSimulation memory)
```

**What it does:**

- ✅ Validates all inputs (future timestamp, valid range, positive stake)
- ✅ Calculates all fees, multipliers, and weights
- ✅ Returns detailed breakdown for UI display
- ✅ **No gas cost** - pure view function
- ✅ **No on-chain changes** - just simulation

**Frontend Usage:**

```javascript
// As user types, validate in real-time
const simulation = await contract.getBetSimulation(
  futureTimestamp,
  priceMinBPS,
  priceMaxBPS,
  stakeAmountWei,
);

if (simulation.isValid) {
  showPreview({
    fee: `${(simulation.feePercentage / 100).toFixed(2)}%`,
    netStake: ethers.formatEther(simulation.stakeNet),
    quality: `${(simulation.qualityMultiplier / 10000).toFixed(1)}×`,
    weight: ethers.formatEther(simulation.weight),
  });
} else {
  showError(simulation.errorMessage);
}
```

### Step 2: Graph Indexing (Testing/Development)

**Function:** `placeBetWithoutValue()`
**Purpose:** Execute transaction without ETH for Graph indexing and testing

```solidity
function placeBetWithoutValue(
    uint256 targetTimestamp,
    uint256 priceMin,
    uint256 priceMax,
    uint256 stakeAmount
) external returns (uint256)
```

**What it does:**

- ✅ **Same logic as `placeBet()`** - identical calculations
- ✅ **Stores bet data on-chain** - creates actual bet record
- ✅ **Emits `BetPlaced` event** - perfect for Graph indexing
- ✅ **Updates bucket totals** - maintains pool state
- ✅ **No ETH required** - perfect for testing/development
- ✅ **Returns betId** - for tracking

**Use Cases:**

- 🧪 **Testing:** Verify contract logic without spending ETH
- 📊 **Graph Indexing:** Create test data for subgraph development
- 🔍 **Debugging:** Validate on-chain state changes
- 🎯 **Development:** Build frontend with real contract data

### Step 3: Production (Real Betting)

**Function:** `placeBet()`
**Purpose:** Execute transaction with ETH for real betting

```solidity
function placeBet(
    uint256 targetTimestamp,
    uint256 priceMin,
    uint256 priceMax
) external payable returns (uint256)
```

**What it does:**

- ✅ **Requires `msg.value`** - user sends actual ETH
- ✅ **Deducts protocol fee** - 0.5% fee collected
- ✅ **Stores bet data** - creates permanent bet record
- ✅ **Updates pool totals** - affects real betting pools
- ✅ **Emits events** - for frontend updates and indexing
- ✅ **Returns betId** - for bet tracking

---

## 📚 Function Reference

### Core Betting Functions

#### `placeBet()`

```solidity
function placeBet(
    uint256 targetTimestamp,
    uint256 priceMin,
    uint256 priceMax
) external payable returns (uint256)
```

**Purpose:** Place a real bet with ETH
**Parameters:**

- `targetTimestamp`: Future timestamp for prediction
- `priceMin`: Minimum price in BPS
- `priceMax`: Maximum price in BPS
- `msg.value`: ETH amount to stake
  **Returns:** Bet ID
  **Events:** `BetPlaced`, `FeeCollected`

#### `placeBetWithoutValue()`

```solidity
function placeBetWithoutValue(
    uint256 targetTimestamp,
    uint256 priceMin,
    uint256 priceMax,
    uint256 stakeAmount
) external returns (uint256)
```

**Purpose:** Place bet without ETH (for testing/Graph)
**Parameters:**

- `targetTimestamp`: Future timestamp for prediction
- `priceMin`: Minimum price in BPS
- `priceMax`: Maximum price in BPS
- `stakeAmount`: Stake amount in wei
  **Returns:** Bet ID
  **Events:** `BetPlaced`

### Simulation Functions

#### `getBetSimulation()`

```solidity
function getBetSimulation(
    uint256 targetTimestamp,
    uint256 priceMin,
    uint256 priceMax,
    uint256 stakeAmount
) external view returns (BetSimulation memory)
```

**Purpose:** Get detailed simulation with human-readable values
**Returns:** `BetSimulation` struct with all calculated values

#### `simulatePlaceBet()`

```solidity
function simulatePlaceBet(
    uint256 targetTimestamp,
    uint256 priceMin,
    uint256 priceMax,
    uint256 stakeAmount
) external view returns (
    uint256 fee,
    uint256 stakeNet,
    uint256 sharpnessBps,
    uint256 timeBps,
    uint256 qualityBps,
    uint256 weight,
    uint256 bucket,
    bool isValid,
    string memory errorMessage
)
```

**Purpose:** Basic simulation with raw values
**Returns:** Tuple with all calculated values and validation status

### Quality Calculation Functions

#### `getSharpnessMultiplier()`

```solidity
function getSharpnessMultiplier(
    uint256 priceMin,
    uint256 priceMax
) public pure returns (uint256)
```

**Purpose:** Calculate sharpness multiplier based on price range width
**Returns:** Sharpness multiplier in BPS (1000-20000)

#### `getTimeMultiplier()`

```solidity
function getTimeMultiplier(
    uint256 targetTimestamp
) public view returns (uint256)
```

**Purpose:** Calculate time multiplier based on prediction lead time
**Returns:** Time multiplier in BPS (1000-20000)

#### `getQuality()`

```solidity
function getQuality(
    uint256 priceMin,
    uint256 priceMax,
    uint256 targetTimestamp
) external view returns (uint256)
```

**Purpose:** Calculate combined quality (sharpness × time)
**Returns:** Combined quality in BPS

#### `getWeight()`

```solidity
function getWeight(
    uint256 stake,
    uint256 qualityBps
) external pure returns (uint256)
```

**Purpose:** Calculate final bet weight
**Returns:** Weight in wei

### Utility Functions

#### `bucketIndex()`

```solidity
function bucketIndex(uint256 targetTs) public view returns (uint256)
```

**Purpose:** Map timestamp to day bucket
**Returns:** Bucket index (days since contract deployment)

---

## 📊 BPS System Explained

### Price Conversion

- **$0.25** = 2500 BPS
- **$0.30** = 3000 BPS (FIXED_PRICE)
- **$0.35** = 3500 BPS

### Multiplier Conversion

- **0.1×** = 1000 BPS
- **0.3×** = 3000 BPS
- **0.5×** = 5000 BPS
- **1.0×** = 10000 BPS
- **1.5×** = 15000 BPS
- **2.0×** = 20000 BPS

### Percentage Conversion

- **0.5%** = 50 BPS
- **33.33%** = 3333 BPS
- **100%** = 10000 BPS

### Example Calculation

```
Input: $0.25-$0.35 bet, 1 ETH stake, 1 day ahead

1. Price Range: 3500 - 2500 = 1000 BPS ($0.10)
2. Width: (1000 / 3000) × 10000 = 3333 BPS (33.33%)
3. Sharpness: 3000 BPS (0.3× for 33.33% width)
4. Time: 10000 BPS (1.0× for 1+ day)
5. Quality: (3000 × 10000) / 10000 = 3000 BPS (0.3×)
6. Fee: (1 ETH × 50) / 10000 = 0.005 ETH
7. Net Stake: 1 ETH - 0.005 ETH = 0.995 ETH
8. Weight: (0.995 ETH × 3000) / 10000 = 0.2985 ETH
```

---

## 🎨 Frontend Integration Guide

### Real-Time Validation

```javascript
// As user adjusts parameters
const validateBet = async (priceMin, priceMax, stakeAmount) => {
  const simulation = await contract.getBetSimulation(
    futureTimestamp,
    priceMin,
    priceMax,
    stakeAmount,
  );

  if (simulation.isValid) {
    return {
      priceRange: `$${(simulation.priceMinDollars / 10000).toFixed(4)} - $${(simulation.priceMaxDollars / 10000).toFixed(4)}`,
      precision: `${(simulation.widthPercentage / 100).toFixed(1)}%`,
      sharpness: `${(simulation.sharpnessMultiplier / 10000).toFixed(1)}×`,
      timeBonus: `${(simulation.timeMultiplier / 10000).toFixed(1)}×`,
      quality: `${(simulation.qualityMultiplier / 10000).toFixed(1)}×`,
      fee: `${(simulation.feePercentage / 100).toFixed(2)}%`,
      netStake: ethers.formatEther(simulation.stakeNet),
      weight: ethers.formatEther(simulation.weight),
    };
  } else {
    throw new Error(simulation.errorMessage);
  }
};
```

### User-Friendly Display

```javascript
const displayBetPreview = (simulation) => {
  return {
    summary: `Betting $${(simulation.priceMinDollars / 10000).toFixed(4)} - $${(simulation.priceMaxDollars / 10000).toFixed(4)}`,
    details: [
      `Precision: ${(simulation.widthPercentage / 100).toFixed(1)}%`,
      `Sharpness Bonus: ${(simulation.sharpnessMultiplier / 10000).toFixed(1)}×`,
      `Time Bonus: ${(simulation.timeMultiplier / 10000).toFixed(1)}×`,
      `Combined Quality: ${(simulation.qualityMultiplier / 10000).toFixed(1)}×`,
      `Protocol Fee: ${(simulation.feePercentage / 100).toFixed(2)}%`,
      `Net Stake: ${ethers.formatEther(simulation.stakeNet)} ETH`,
      `Voting Power: ${ethers.formatEther(simulation.weight)} ETH`,
    ],
  };
};
```

### Error Handling

```javascript
const handleBetValidation = async (params) => {
  try {
    const simulation = await contract.getBetSimulation(...params);

    if (!simulation.isValid) {
      switch (simulation.errorMessage) {
        case "must be future timestamp":
          return "Please select a future date";
        case "invalid price range":
          return "Maximum price must be higher than minimum price";
        case "stake must be > 0":
          return "Please enter a stake amount";
        default:
          return simulation.errorMessage;
      }
    }

    return { isValid: true, simulation };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
};
```

---

## 🧪 Testing Guide

### Running Tests

```bash
# Run all tests
npx hardhat test

# Run specific test
npx hardhat test --grep "BPS system"

# Run with gas reporting
npx hardhat test --gas
```

### Test Categories

1. **Unit Tests**: Individual function testing
2. **Integration Tests**: End-to-end scenarios
3. **BPS System Tests**: Calculation validation
4. **Simulation Tests**: Frontend validation functions
5. **Graph Indexing Tests**: Event emission validation

### Example Test Output

```
BPS System Test Results:
Range: 1000 BPS ($0.1000)
Width: 3333.33 BPS (33.33% of $0.30)
Sharpness Multiplier: 3000 BPS (0.3×)
Time Multiplier: 10000 BPS (1.0×)
Quality: 3000 BPS (0.3×)
Stake: 0.995 ETH
Weight: 0.2985 ETH
```

---

## 📊 Graph Indexing Guide

### Events for Indexing

```solidity
event BetPlaced(
    uint256 indexed betId,
    address indexed bettor,
    uint256 bucket,
    uint256 stake,
    uint256 qualityBps
);

event FeeCollected(uint256 amount);
```

### Subgraph Schema Example

```graphql
type Bet @entity {
  id: ID!
  betId: BigInt!
  bettor: Bytes!
  targetTimestamp: BigInt!
  priceMin: BigInt!
  priceMax: BigInt!
  stake: BigInt!
  qualityBps: BigInt!
  weight: BigInt!
  bucket: BigInt!
  finalized: Boolean!
  claimed: Boolean!
  createdAt: BigInt!
}

type Bucket @entity {
  id: ID!
  bucketIndex: BigInt!
  totalStaked: BigInt!
  totalWeight: BigInt!
  bets: [Bet!]! @derivedFrom(field: "bucket")
}
```

### Development Workflow

1. **Use `placeBetWithoutValue()`** to create test data
2. **Deploy subgraph** with test events
3. **Query indexed data** for frontend development
4. **Switch to `placeBet()`** for production

---

## 🚀 Development Workflow

### Phase 1: Frontend Development

1. **Use `getBetSimulation()`** for real-time validation
2. **Build UI** with preview and error handling
3. **Test user experience** without any transactions

### Phase 2: Testing & Graph Development

1. **Use `placeBetWithoutValue()`** for testing
2. **Create test data** for Graph indexing
3. **Validate contract logic** without ETH costs
4. **Build subgraphs** with real event data

### Phase 3: Production Deployment

1. **Use `placeBet()`** for real betting
2. **Deploy with real ETH** transactions
3. **Monitor events** for frontend updates
4. **Index data** with production subgraphs

---

## 📈 Function Comparison

| Function                 | ETH Required | On-Chain Changes | Use Case      | Gas Cost |
| ------------------------ | ------------ | ---------------- | ------------- | -------- |
| `getBetSimulation()`     | ❌           | ❌               | Validation    | Free     |
| `placeBetWithoutValue()` | ❌           | ✅               | Testing/Graph | Low      |
| `placeBet()`             | ✅           | ✅               | Production    | Normal   |

---

## 🔗 Contract Addresses

### Testnet

- **Contract:** `TestPredensityPredictionMarket`
- **Network:** Hardhat Local
- **Deployment:** `npx hardhat deploy`

### Mainnet (Future)

- **Contract:** `PredensityPredictionMarket`
- **Network:** Ethereum Mainnet
- **Deployment:** TBD

---

## 📞 Support

For questions or issues:

- **GitHub:** [Repository Link]
- **Documentation:** [This File]
- **Testing:** Run `npx hardhat test` for examples

---

_Last Updated: [Current Date]_
_Version: 1.0.0_
