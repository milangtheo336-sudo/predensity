// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch15Script is Script {
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
        
        // Define the 10 bets from mock data (bets 141-150)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1755273874, 0.010998 ETH, 2743-2818 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2743,
            priceMax: 2818,
            stakeAmount: 0.010998 ether
        });
        
        // Bet 2: 1755274954, 0.018105 ETH, 2710-2872 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2710,
            priceMax: 2872,
            stakeAmount: 0.018105 ether
        });
        
        // Bet 3: 1755313636, 0.267345 ETH, 2879-2936 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2879,
            priceMax: 2936,
            stakeAmount: 0.267345 ether
        });
        
        // Bet 4: 1755314596, 0.000282 ETH, 2824-2862 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2824,
            priceMax: 2862,
            stakeAmount: 0.000282 ether
        });
        
        // Bet 5: 1755345933, 0.22814 ETH, 2841-2881 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2841,
            priceMax: 2881,
            stakeAmount: 0.22814 ether
        });
        
        // Bet 6: 1755348513, 0.06684 ETH, 2921-2987 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2921,
            priceMax: 2987,
            stakeAmount: 0.06684 ether
        });
        
        // Bet 7: 1755395611, 0.006097 ETH, 2870-2950 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2870,
            priceMax: 2950,
            stakeAmount: 0.006097 ether
        });
        
        // Bet 8: 1755403698, 0.092264 ETH, 2673-2829 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2673,
            priceMax: 2829,
            stakeAmount: 0.092264 ether
        });
        
        // Bet 9: 1755406938, 0.000438 ETH, 2697-2852 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2697,
            priceMax: 2852,
            stakeAmount: 0.000438 ether
        });
        
        // Bet 10: 1755428418, 0.006798 ETH, 2657-2769 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2657,
            priceMax: 2769,
            stakeAmount: 0.006798 ether
        });
        
        console.log("=== Placing Batch 15 (10 Bets) ===");
        
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
