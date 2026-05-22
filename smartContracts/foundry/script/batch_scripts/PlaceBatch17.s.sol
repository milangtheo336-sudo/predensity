// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch17Script is Script {
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
        
        // Define the 10 bets from mock data (bets 161-170)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1755603263, 0.00824 ETH, 2783-2906 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2783,
            priceMax: 2906,
            stakeAmount: 0.00824 ether
        });
        
        // Bet 2: 1755606503, 0.010004 ETH, 2795-2936 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2795,
            priceMax: 2936,
            stakeAmount: 0.010004 ether
        });
        
        // Bet 3: 1755640208, 0.008279 ETH, 2841-2931 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2841,
            priceMax: 2931,
            stakeAmount: 0.008279 ether
        });
        
        // Bet 4: 1755640928, 0.02458 ETH, 2719-2876 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2719,
            priceMax: 2876,
            stakeAmount: 0.02458 ether
        });
        
        // Bet 5: 1755649545, 0.012096 ETH, 2855-3001 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2855,
            priceMax: 3001,
            stakeAmount: 0.012096 ether
        });
        
        // Bet 6: 1755651705, 0.387885 ETH, 2884-3009 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2884,
            priceMax: 3009,
            stakeAmount: 0.387885 ether
        });
        
        // Bet 7: 1755695075, 0.00909 ETH, 2792-3007 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2792,
            priceMax: 3007,
            stakeAmount: 0.00909 ether
        });
        
        // Bet 8: 1755759480, 0.040955 ETH, 3600-3747 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 3600,
            priceMax: 3747,
            stakeAmount: 0.040955 ether
        });
        
        // Bet 9: 1755760159, 0.045414 ETH, 2846-2922 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2846,
            priceMax: 2922,
            stakeAmount: 0.045414 ether
        });
        
        // Bet 10: 1755760928, 0.005304 ETH, 2884-2995 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2884,
            priceMax: 2995,
            stakeAmount: 0.005304 ether
        });
        
        console.log("=== Placing Batch 17 (10 Bets) ===");
        
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
