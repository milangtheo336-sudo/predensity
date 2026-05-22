// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract Place10BetsScript is Script {
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
        
        // Define the 10 bets based on the table
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: Day 1, 2100-2550 BPS
        bets[0] = BetData({
            dayOffset: 1,
            priceMin: 2100,
            priceMax: 2550,
            stakeAmount: 0.001 ether
        });
        
        // Bet 2: Day 1, 2320-2820 BPS
        bets[1] = BetData({
            dayOffset: 1,
            priceMin: 2320,
            priceMax: 2820,
            stakeAmount: 0.0015 ether
        });
        
        // Bet 3: Day 1, 2000-2600 BPS
        bets[2] = BetData({
            dayOffset: 1,
            priceMin: 2000,
            priceMax: 2600,
            stakeAmount: 0.002 ether
        });
        
        // Bet 4: Day 2, 2650-3150 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2650,
            priceMax: 3150,
            stakeAmount: 0.0025 ether
        });
        
        // Bet 5: Day 2, 2450-2930 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2450,
            priceMax: 2930,
            stakeAmount: 0.003 ether
        });
        
        // Bet 6: Day 2, 2200-2650 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2200,
            priceMax: 2650,
            stakeAmount: 0.0012 ether
        });
        
        // Bet 7: Day 3, 2050-2800 BPS
        bets[6] = BetData({
            dayOffset: 3,
            priceMin: 2050,
            priceMax: 2800,
            stakeAmount: 0.0018 ether
        });
        
        // Bet 8: Day 3, 2750-3450 BPS
        bets[7] = BetData({
            dayOffset: 3,
            priceMin: 2750,
            priceMax: 3450,
            stakeAmount: 0.0022 ether
        });
        
        // Bet 9: Day 3, 2900-3500 BPS
        bets[8] = BetData({
            dayOffset: 3,
            priceMin: 2900,
            priceMax: 3500,
            stakeAmount: 0.0028 ether
        });
        
        // Bet 10: Day 2, 2200-3200 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2200,
            priceMax: 3200,
            stakeAmount: 0.0017 ether
        });
        
        console.log("=== Placing 10 Bets ===");
        
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