// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch11Script is Script {
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
        
        // Define the 10 bets from mock data (bets 101-110)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1754940906, 0.00558 ETH, 2754-2800 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2754,
            priceMax: 2800,
            stakeAmount: 0.00558 ether
        });
        
        // Bet 2: 1754943219, 0.012456 ETH, 2579-2678 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2579,
            priceMax: 2678,
            stakeAmount: 0.012456 ether
        });
        
        // Bet 3: 1754945499, 0.00528 ETH, 2673-2772 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2673,
            priceMax: 2772,
            stakeAmount: 0.00528 ether
        });
        
        // Bet 4: 1754970149, 0.038233 ETH, 2619-2770 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2619,
            priceMax: 2770,
            stakeAmount: 0.038233 ether
        });
        
        // Bet 5: 1754971289, 0.012688 ETH, 2684-2844 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2684,
            priceMax: 2844,
            stakeAmount: 0.012688 ether
        });
        
        // Bet 6: 1754990923, 0.001263 ETH, 2702-2826 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2702,
            priceMax: 2826,
            stakeAmount: 0.001263 ether
        });
        
        // Bet 7: 1754994350, 0.060732 ETH, 2568-2695 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2568,
            priceMax: 2695,
            stakeAmount: 0.060732 ether
        });
        
        // Bet 8: 1754997590, 0.000225 ETH, 2681-2715 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2681,
            priceMax: 2715,
            stakeAmount: 0.000225 ether
        });
        
        // Bet 9: 1755008474, 0.025098 ETH, 2680-2720 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2680,
            priceMax: 2720,
            stakeAmount: 0.025098 ether
        });
        
        // Bet 10: 1755010934, 0.060742 ETH, 2612-2643 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2612,
            priceMax: 2643,
            stakeAmount: 0.060742 ether
        });
        
        console.log("=== Placing Batch 11 (10 Bets) ===");
        
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
