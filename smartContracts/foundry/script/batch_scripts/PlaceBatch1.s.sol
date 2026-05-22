// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch1Script is Script {
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
        
        // Define the 10 bets from mock data (first 10)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1754579794, 0.00867 ETH, 2376-2454 BPS
        bets[0] = BetData({
            dayOffset: 1,
            priceMin: 2376,
            priceMax: 2454,
            stakeAmount: 0.00867 ether
        });
        
        // Bet 2: 1754582022, 0.01262 ETH, 2437-2475 BPS
        bets[1] = BetData({
            dayOffset: 1,
            priceMin: 2437,
            priceMax: 2475,
            stakeAmount: 0.01262 ether
        });
        
        // Bet 3: 1754584122, 0.029848 ETH, 2364-2504 BPS
        bets[2] = BetData({
            dayOffset: 1,
            priceMin: 2364,
            priceMax: 2504,
            stakeAmount: 0.029848 ether
        });
        
        // Bet 4: 1754590000, 0.12 ETH, 4000-5000 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 4000,
            priceMax: 5000,
            stakeAmount: 0.12 ether
        });
        
        // Bet 5: 1754591352, 0.023352 ETH, 2347-2510 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2347,
            priceMax: 2510,
            stakeAmount: 0.023352 ether
        });
        
        // Bet 6: 1754592954, 0.00644 ETH, 2415-2528 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2415,
            priceMax: 2528,
            stakeAmount: 0.00644 ether
        });
        
        // Bet 7: 1754590000, 0.2 ETH, 3000-3500 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 3000,
            priceMax: 3500,
            stakeAmount: 0.2 ether
        });
        
        // Bet 8: 1754593314, 0.11715 ETH, 2492-2523 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2492,
            priceMax: 2523,
            stakeAmount: 0.11715 ether
        });
        
        // Bet 9: 1754892147, 0.5 ETH, 2000-2500 BPS
        bets[8] = BetData({
            dayOffset: 3,
            priceMin: 2000,
            priceMax: 2500,
            stakeAmount: 0.5 ether
        });
        
        // Bet 10: 1754594652, 0.076362 ETH, 2432-2585 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2432,
            priceMax: 2585,
            stakeAmount: 0.076362 ether
        });
        
        console.log("=== Placing Batch 1 (10 Bets) ===");
        
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