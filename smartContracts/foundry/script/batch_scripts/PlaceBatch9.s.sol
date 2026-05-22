// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch9Script is Script {
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
        
        // Define the 10 bets from mock data (bets 81-90)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1754829199, 0.0033 ETH, 2600-2693 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2600,
            priceMax: 2693,
            stakeAmount: 0.0033 ether
        });
        
        // Bet 2: 1754830107, 0.004122 ETH, 2549-2731 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2549,
            priceMax: 2731,
            stakeAmount: 0.004122 ether
        });
        
        // Bet 3: 1754831787, 0.2607 ETH, 2620-2811 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2620,
            priceMax: 2811,
            stakeAmount: 0.2607 ether
        });
        
        // Bet 4: 1754830000, 0.28 ETH, 2889-3054 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2889,
            priceMax: 3054,
            stakeAmount: 0.28 ether
        });
        
        // Bet 5: 1754833380, 0.10574 ETH, 1636-1868 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 1636,
            priceMax: 1868,
            stakeAmount: 0.10574 ether
        });
        
        // Bet 6: 1754835153, 0.20524 ETH, 2547-2602 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2547,
            priceMax: 2602,
            stakeAmount: 0.20524 ether
        });
        
        // Bet 7: 1754835993, 0.025539 ETH, 2564-2600 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2564,
            priceMax: 2600,
            stakeAmount: 0.025539 ether
        });
        
        // Bet 8: 1754851722, 0.24412 ETH, 2612-2752 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2612,
            priceMax: 2752,
            stakeAmount: 0.24412 ether
        });
        
        // Bet 9: 1754854602, 0.001718 ETH, 2662-2701 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 10: 1754870474, 0.010773 ETH, 2640-2691 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        console.log("=== Placing Batch 9 (10 Bets) ===");
        
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
