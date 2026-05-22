# Place Single Bet Script Usage

This script places a single bet on the PredensityPredictionMarket contract with configurable parameters.

## Setup

Add these environment variables to your `.env` file:

```bash
# Bet parameters
DAY_OFFSET=1          # Days ahead (1, 2, or 3)
PRICE_MIN=2100        # Minimum price in BPS
PRICE_MAX=2550        # Maximum price in BPS  
STAKE_AMOUNT=1000000000000000  # Stake amount in wei (0.001 ETH)
```

## Usage

### 1. Simulate the bet first:
```bash
forge script script/PlaceSingleBet.s.sol --fork-url $MAINNET_RPC_URL
```

### 2. Broadcast the bet:
```bash
forge script script/PlaceSingleBet.s.sol --fork-url $MAINNET_RPC_URL --broadcast
```

### 3. Wait 3-5 seconds between bets to avoid rate limiting

## Example Bet Configurations

### Bet 1:
```bash
export DAY_OFFSET=1
export PRICE_MIN=2100
export PRICE_MAX=2550
export STAKE_AMOUNT=1000000000000000  # 0.001 ETH
```

### Bet 2:
```bash
export DAY_OFFSET=1
export PRICE_MIN=2320
export PRICE_MAX=2820
export STAKE_AMOUNT=1500000000000000  # 0.0015 ETH
```

### Bet 3:
```bash
export DAY_OFFSET=1
export PRICE_MIN=2000
export PRICE_MAX=2600
export STAKE_AMOUNT=2000000000000000  # 0.002 ETH
```

## Stake Amounts (in wei)
- 0.001 ETH = 1000000000000000
- 0.0012 ETH = 1200000000000000
- 0.0015 ETH = 1500000000000000
- 0.0017 ETH = 1700000000000000
- 0.0018 ETH = 1800000000000000
- 0.002 ETH = 2000000000000000
- 0.0022 ETH = 2200000000000000
- 0.0025 ETH = 2500000000000000
- 0.0028 ETH = 2800000000000000
- 0.003 ETH = 3000000000000000

## Process to Place All 10 Bets

1. Set the environment variables for the first bet
2. Run the script with `--broadcast`
3. Wait 3-5 seconds
4. Update environment variables for the next bet
5. Repeat until all 10 bets are placed

This approach avoids rate limiting and nonce issues by spacing out the transactions. 