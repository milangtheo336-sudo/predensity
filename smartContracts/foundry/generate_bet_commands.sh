#!/bin/bash

# Generate 10 ready-to-run forge commands for placing bets
# Each command sets the environment variables and runs the script

echo "# Bet 1: Day 1, 2100-2550 BPS, 0.001 ETH"
echo "DAY_OFFSET=1 PRICE_MIN=2100 PRICE_MAX=2550 STAKE_AMOUNT=1000000000000000 forge script script/PlaceSingleBet.s.sol --rpc-url \$MAINNET_RPC_URL --broadcast"
echo ""

echo "# Bet 2: Day 1, 2320-2820 BPS, 0.0015 ETH"
echo "DAY_OFFSET=1 PRICE_MIN=2320 PRICE_MAX=2820 STAKE_AMOUNT=1500000000000000 forge script script/PlaceSingleBet.s.sol --rpc-url \$MAINNET_RPC_URL --broadcast"
echo ""

echo "# Bet 3: Day 1, 2000-2600 BPS, 0.002 ETH"
echo "DAY_OFFSET=1 PRICE_MIN=2000 PRICE_MAX=2600 STAKE_AMOUNT=2000000000000000 forge script script/PlaceSingleBet.s.sol --rpc-url \$MAINNET_RPC_URL --broadcast"
echo ""

echo "# Bet 4: Day 2, 2650-3150 BPS, 0.0025 ETH"
echo "DAY_OFFSET=2 PRICE_MIN=2650 PRICE_MAX=3150 STAKE_AMOUNT=2500000000000000 forge script script/PlaceSingleBet.s.sol --rpc-url \$MAINNET_RPC_URL --broadcast"
echo ""

echo "# Bet 5: Day 2, 2450-2930 BPS, 0.003 ETH"
echo "DAY_OFFSET=2 PRICE_MIN=2450 PRICE_MAX=2930 STAKE_AMOUNT=3000000000000000 forge script script/PlaceSingleBet.s.sol --rpc-url \$MAINNET_RPC_URL --broadcast"
echo ""

echo "# Bet 6: Day 2, 2200-2650 BPS, 0.0012 ETH"
echo "DAY_OFFSET=2 PRICE_MIN=2200 PRICE_MAX=2650 STAKE_AMOUNT=1200000000000000 forge script script/PlaceSingleBet.s.sol --rpc-url \$MAINNET_RPC_URL --broadcast"
echo ""

echo "# Bet 7: Day 3, 2050-2800 BPS, 0.0018 ETH"
echo "DAY_OFFSET=3 PRICE_MIN=2050 PRICE_MAX=2800 STAKE_AMOUNT=1800000000000000 forge script script/PlaceSingleBet.s.sol --rpc-url \$MAINNET_RPC_URL --broadcast"
echo ""

echo "# Bet 8: Day 3, 2750-3450 BPS, 0.0022 ETH"
echo "DAY_OFFSET=3 PRICE_MIN=2750 PRICE_MAX=3450 STAKE_AMOUNT=2200000000000000 forge script script/PlaceSingleBet.s.sol --rpc-url \$MAINNET_RPC_URL --broadcast"
echo ""

echo "# Bet 9: Day 3, 2900-3500 BPS, 0.0028 ETH"
echo "DAY_OFFSET=3 PRICE_MIN=2900 PRICE_MAX=3500 STAKE_AMOUNT=2800000000000000 forge script script/PlaceSingleBet.s.sol --rpc-url \$MAINNET_RPC_URL --broadcast"
echo ""

echo "# Bet 10: Day 2, 2200-3200 BPS, 0.0017 ETH"
echo "DAY_OFFSET=2 PRICE_MIN=2200 PRICE_MAX=3200 STAKE_AMOUNT=1700000000000000 forge script script/PlaceSingleBet.s.sol --rpc-url \$MAINNET_RPC_URL --broadcast"
echo ""

echo "# Instructions:"
echo "# 1. Copy each command above"
echo "# 2. Paste and run one at a time"
echo "# 3. Wait 3-5 seconds between each command"
echo "# 4. Make sure MAINNET_RPC_URL is set in your environment" 