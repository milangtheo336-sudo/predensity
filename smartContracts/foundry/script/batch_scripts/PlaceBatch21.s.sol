// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch21Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        
        address marketAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V4");
        console.log("Using market at:", marketAddress);
        
        PredensityPredictionMarket market = PredensityPredictionMarket(marketAddress);
        
        // Get current timestamp
        uint256 currentTimestamp = block.timestamp;
        console.log("Current timestamp:", currentTimestamp);
        
        // Define the 10 bets from mock data (bets 201-210)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1756213713, 0.00654 ETH, 2966-3048 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2966,
            priceMax: 3048,
            stakeAmount: 0.00654 ether
        });
        
        // Bet 2: 1756214875, 0.001128 ETH, 3040-3151 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 3040,
            priceMax: 3151,
            stakeAmount: 0.001128 ether
        });
        
        // Bet 3: 1756255513, 0.235315 ETH, 3036-3134 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 3036,
            priceMax: 3134,
            stakeAmount: 0.235315 ether
        });
        
        // Bet 4: 1756265065, 0.212394 ETH, 2982-3127 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2982,
            priceMax: 3127,
            stakeAmount: 0.212394 ether
        });
        
        // Bet 5: 1756267045, 0.01326 ETH, 2977-3144 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2977,
            priceMax: 3144,
            stakeAmount: 0.01326 ether
        });
        
        // Bet 6: 1756305013, 0.015598 ETH, 2949-3100 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2949,
            priceMax: 3100,
            stakeAmount: 0.015598 ether
        });
        
        // Bet 7: 1756307833, 0.008442 ETH, 3030-3155 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 3030,
            priceMax: 3155,
            stakeAmount: 0.008442 ether
        });
        
        // Bet 8: 1756356119, 0.037086 ETH, 3067-3188 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 3067,
            priceMax: 3188,
            stakeAmount: 0.037086 ether
        });
        
        // Bet 9: 1756356479, 0.224 ETH, 3090-3273 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 3090,
            priceMax: 3273,
            stakeAmount: 0.224 ether
        });
        
        // Bet 10: 1756365280, 0.00048 ETH, 3042-3081 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 3042,
            priceMax: 3081,
            stakeAmount: 0.00048 ether
        });
        
        console.log("=== Placing Batch 21 (10 Bets) ===");
        
        // Prepare arrays for batch placement
        uint256[] memory targetTimestamps = new uint256[](bets.length);
        uint256[] memory priceMins = new uint256[](bets.length);
        uint256[] memory priceMaxs = new uint256[](bets.length);
        uint256[] memory stakeAmounts = new uint256[](bets.length);
        uint256 totalValue = 0;
        
        // Calculate total value and prepare arrays
        for (uint256 i = 0; i < bets.length; i++) {
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
        }
        
        console.log("Total value to send:", totalValue);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Place all bets in a single batch transaction
        uint256[] memory betIds = market.placeBatchBets{value: totalValue}(
            targetTimestamps,
            priceMins,
            priceMaxs,
            stakeAmounts
        );
        
        console.log("All bets placed with IDs:");
        for (uint256 i = 0; i < betIds.length; i++) {
            console.log("Bet", i + 1, "ID:", betIds[i]);
        }
        
        vm.stopBroadcast();
        
        console.log("=== All 10 bets placed successfully! ===");
        
        // Get final stats
        (uint256 totalBets, uint256 totalFees, uint256 contractBalance) = market.getStats();
        console.log("Total bets in contract:", totalBets);
        console.log("Total fees collected:", totalFees);
        console.log("Contract balance:", contractBalance);
    }
    
    struct BetData {
        uint256 dayOffset;
        uint256 priceMin;
        uint256 priceMax;
        uint256 stakeAmount;
    }
}
