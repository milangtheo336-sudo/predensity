// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch8Script is Script {
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
        
        // Define the 10 bets from mock data (bets 71-80)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1754760038, 0.113778 ETH, 2561-2612 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2561,
            priceMax: 2612,
            stakeAmount: 0.113778 ether
        });
        
        // Bet 2: 1754760278, 0.009646 ETH, 2602-2641 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2602,
            priceMax: 2641,
            stakeAmount: 0.009646 ether
        });
        
        // Bet 3: 1754760000, 0.05 ETH, 4300-6500 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 4300,
            priceMax: 6500,
            stakeAmount: 0.05 ether
        });
        
        // Bet 4: 1754761734, 0.128506 ETH, 2598-2669 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2598,
            priceMax: 2669,
            stakeAmount: 0.128506 ether
        });
        
        // Bet 5: 1754763774, 0.06416 ETH, 2611-2643 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2611,
            priceMax: 2643,
            stakeAmount: 0.06416 ether
        });
        
        // Bet 6: 1754790749, 0.001385 ETH, 2569-2654 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2569,
            priceMax: 2654,
            stakeAmount: 0.001385 ether
        });
        
        // Bet 7: 1754791469, 0.004249 ETH, 2591-2747 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2591,
            priceMax: 2747,
            stakeAmount: 0.004249 ether
        });
        
        // Bet 8: 1754821566, 0.00996 ETH, 2645-2808 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2645,
            priceMax: 2808,
            stakeAmount: 0.00996 ether
        });
        
        // Bet 9: 1754821626, 0.011853 ETH, 2624-2683 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2624,
            priceMax: 2683,
            stakeAmount: 0.011853 ether
        });
        
        // Bet 10: 1754828779, 0.272678 ETH, 2554-2628 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2554,
            priceMax: 2628,
            stakeAmount: 0.272678 ether
        });
        
        console.log("=== Placing Batch 8 (10 Bets) ===");
        
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
