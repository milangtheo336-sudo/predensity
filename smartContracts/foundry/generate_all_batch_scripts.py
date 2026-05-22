#!/usr/bin/env python3
import json
import os

def generate_batch_script(batch_num, bets_data):
    """Generate a batch script for 10 bets"""
    
    script_content = f'''// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {{Script, console}} from "forge-std/Script.sol";
import {{PredensityPredictionMarket}} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch{batch_num}Script is Script {{
    function run() external {{
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        
        address marketAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V4");
        console.log("Using market at:", marketAddress);
        
        PredensityPredictionMarket market = PredensityPredictionMarket(marketAddress);
        
        // Get current timestamp
        uint256 currentTimestamp = block.timestamp;
        console.log("Current timestamp:", currentTimestamp);
        
        // Define the 10 bets from mock data (bets {batch_num*10-9}-{batch_num*10})
        BetData[] memory bets = new BetData[](10);
        
'''
    
    # Add bet definitions
    for i, bet in enumerate(bets_data):
        price_min_bps = int(bet['priceMin'] * 10000)
        price_max_bps = int(bet['priceMax'] * 10000)
        stake_eth = bet['stake']
        
        script_content += f'''        // Bet {i+1}: {bet['targetTimestamp']}, {stake_eth} ETH, {price_min_bps}-{price_max_bps} BPS
        bets[{i}] = BetData({{
            dayOffset: 2,
            priceMin: {price_min_bps},
            priceMax: {price_max_bps},
            stakeAmount: {stake_eth} ether
        }});
        
'''
    
    # Add the rest of the script
    script_content += f'''        console.log("=== Placing Batch {batch_num} (10 Bets) ===");
        
        // Prepare arrays for batch placement
        uint256[] memory targetTimestamps = new uint256[](bets.length);
        uint256[] memory priceMins = new uint256[](bets.length);
        uint256[] memory priceMaxs = new uint256[](bets.length);
        uint256[] memory stakeAmounts = new uint256[](bets.length);
        uint256 totalValue = 0;
        
        // Calculate total value and prepare arrays
        for (uint256 i = 0; i < bets.length; i++) {{
            BetData memory bet = bets[i];
            
            // Calculate target timestamp starting from current time
            // Add MIN_DAYS_AHEAD + dayOffset to ensure it's at least 1 day ahead
            uint256 targetTimestamp = currentTimestamp + ((market.MIN_DAYS_AHEAD() + bet.dayOffset) * market.SECONDS_PER_DAY());
            
            targetTimestamps[i] = targetTimestamp;
            priceMins[i] = bet.priceMin;
            priceMaxs[i] = bet.priceMax;
            stakeAmounts[i] = bet.stakeAmount;
            totalValue += bet.stakeAmount;
            
            console.log("--- Bet");
            console.log(i + 1);
            console.log("---");
            console.log("Day offset:", bet.dayOffset);
            console.log("Target timestamp:", targetTimestamp);
            console.log("Price range:");
            console.log(bet.priceMin);
            console.log("-");
            console.log(bet.priceMax);
            console.log("BPS");
            console.log("Stake amount:", bet.stakeAmount);
        }}
        
        console.log("Total value to send:", totalValue);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Place all bets in a single batch transaction
        uint256[] memory betIds = market.placeBatchBets{{value: totalValue}}(
            targetTimestamps,
            priceMins,
            priceMaxs,
            stakeAmounts
        );
        
        console.log("All bets placed with IDs:");
        for (uint256 i = 0; i < betIds.length; i++) {{
            console.log("Bet", i + 1, "ID:", betIds[i]);
        }}
        
        vm.stopBroadcast();
        
        console.log("=== All 10 bets placed successfully! ===");
        
        // Get final stats
        (uint256 totalBets, uint256 totalFees, uint256 contractBalance) = market.getStats();
        console.log("Total bets in contract:", totalBets);
        console.log("Total fees collected:", totalFees);
        console.log("Contract balance:", contractBalance);
    }}
    
    struct BetData {{
        uint256 dayOffset;
        uint256 priceMin;
        uint256 priceMax;
        uint256 stakeAmount;
    }}
}}
'''
    
    return script_content

def main():
    # Read the JSON data
    with open('mock_bet_data_4_Aug07.json', 'r') as f:
        data = json.load(f)
    
    # Create batch_scripts directory if it doesn't exist
    os.makedirs('script/batch_scripts', exist_ok=True)
    
    # Calculate number of batches needed
    total_bets = len(data)
    num_batches = (total_bets + 9) // 10  # Ceiling division
    
    print(f"Total bets: {total_bets}")
    print(f"Number of batches needed: {num_batches}")
    
    # Generate all batch scripts
    for batch_num in range(7, num_batches + 1):  # Start from 7 since we already have 1-6
        start_idx = (batch_num - 1) * 10
        end_idx = min(start_idx + 10, total_bets)
        
        batch_bets = data[start_idx:end_idx]
        
        script_content = generate_batch_script(batch_num, batch_bets)
        
        filename = f"script/batch_scripts/PlaceBatch{batch_num}.s.sol"
        with open(filename, 'w') as f:
            f.write(script_content)
        
        print(f"Generated {filename} with {len(batch_bets)} bets")

if __name__ == "__main__":
    main() 