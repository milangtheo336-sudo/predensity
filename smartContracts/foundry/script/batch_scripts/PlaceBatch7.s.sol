// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch7Script is Script {
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
        
        // Define the 10 bets from mock data (bets 61-70)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1754711567, 0.20606 ETH, 2454-2508 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2454,
            priceMax: 2508,
            stakeAmount: 0.20606 ether
        });
        
        // Bet 2: 1754712522, 0.129136 ETH, 2388-2491 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2388,
            priceMax: 2491,
            stakeAmount: 0.129136 ether
        });
        
        // Bet 3: 1754710000, 0.72 ETH, 5100-6000 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 5100,
            priceMax: 6000,
            stakeAmount: 0.72 ether
        });
        
        // Bet 4: 1754714267, 0.006578 ETH, 2475-2682 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2475,
            priceMax: 2682,
            stakeAmount: 0.006578 ether
        });
        
        // Bet 5: 1754715942, 0.037226 ETH, 2415-2530 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2415,
            priceMax: 2530,
            stakeAmount: 0.037226 ether
        });
        
        // Bet 6: 1754710000, 0.39 ETH, 5200-5500 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 5200,
            priceMax: 5500,
            stakeAmount: 0.39 ether
        });
        
        // Bet 7: 1754717295, 0.006768 ETH, 2553-2602 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2553,
            priceMax: 2602,
            stakeAmount: 0.006768 ether
        });
        
        // Bet 8: 1754719215, 0.0062 ETH, 2484-2577 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2484,
            priceMax: 2577,
            stakeAmount: 0.0062 ether
        });
        
        // Bet 9: 1754759127, 0.019248 ETH, 2486-2651 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2486,
            priceMax: 2651,
            stakeAmount: 0.019248 ether
        });
        
        // Bet 10: 1754759667, 0.02244 ETH, 2584-2655 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2584,
            priceMax: 2655,
            stakeAmount: 0.02244 ether
        });
        
        console.log("=== Placing Batch 7 (10 Bets) ===");
        
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
