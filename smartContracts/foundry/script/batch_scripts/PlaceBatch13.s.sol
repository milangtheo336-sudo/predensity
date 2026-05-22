// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch13Script is Script {
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
        
        // Define the 10 bets from mock data (bets 121-130)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1755123529, 0.010701 ETH, 2733-2893 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2733,
            priceMax: 2893,
            stakeAmount: 0.010701 ether
        });
        
        // Bet 2: 1755132561, 0.009136 ETH, 2663-2826 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2663,
            priceMax: 2826,
            stakeAmount: 0.009136 ether
        });
        
        // Bet 3: 1755133461, 0.1197 ETH, 2690-2809 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2690,
            priceMax: 2809,
            stakeAmount: 0.1197 ether
        });
        
        // Bet 4: 1755140220, 0.169328 ETH, 1588-1762 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 1588,
            priceMax: 1762,
            stakeAmount: 0.169328 ether
        });
        
        // Bet 5: 1755144326, 0.016352 ETH, 2732-2822 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2732,
            priceMax: 2822,
            stakeAmount: 0.016352 ether
        });
        
        // Bet 6: 1755147746, 0.009114 ETH, 2643-2828 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2643,
            priceMax: 2828,
            stakeAmount: 0.009114 ether
        });
        
        // Bet 7: 1755173398, 0.004744 ETH, 2648-2815 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2648,
            priceMax: 2815,
            stakeAmount: 0.004744 ether
        });
        
        // Bet 8: 1755201316, 0.00778 ETH, 2709-2824 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2709,
            priceMax: 2824,
            stakeAmount: 0.00778 ether
        });
        
        // Bet 9: 1755202396, 0.0402 ETH, 2681-2733 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2681,
            priceMax: 2733,
            stakeAmount: 0.0402 ether
        });
        
        // Bet 10: 1755204343, 0.000636 ETH, 2799-2844 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2799,
            priceMax: 2844,
            stakeAmount: 0.000636 ether
        });
        
        console.log("=== Placing Batch 13 (10 Bets) ===");
        
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
