// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch16Script is Script {
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
        
        // Define the 10 bets from mock data (bets 151-160)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1755429138, 0.001248 ETH, 2715-2869 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2715,
            priceMax: 2869,
            stakeAmount: 0.001248 ether
        });
        
        // Bet 2: 1755458318, 0.046656 ETH, 2800-2924 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2800,
            priceMax: 2924,
            stakeAmount: 0.046656 ether
        });
        
        // Bet 3: 1755460478, 0.004644 ETH, 2858-2903 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2858,
            priceMax: 2903,
            stakeAmount: 0.004644 ether
        });
        
        // Bet 4: 1755484767, 0.003556 ETH, 2695-2856 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2695,
            priceMax: 2856,
            stakeAmount: 0.003556 ether
        });
        
        // Bet 5: 1755486567, 0.00255 ETH, 2588-2778 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2588,
            priceMax: 2778,
            stakeAmount: 0.00255 ether
        });
        
        // Bet 6: 1755502700, 0.15788 ETH, 2804-2927 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2804,
            priceMax: 2927,
            stakeAmount: 0.15788 ether
        });
        
        // Bet 7: 1755548468, 0.139118 ETH, 2814-2912 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2814,
            priceMax: 2912,
            stakeAmount: 0.139118 ether
        });
        
        // Bet 8: 1755549093, 0.006174 ETH, 2839-2902 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2839,
            priceMax: 2902,
            stakeAmount: 0.006174 ether
        });
        
        // Bet 9: 1755550533, 0.004267 ETH, 2840-2951 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2840,
            priceMax: 2951,
            stakeAmount: 0.004267 ether
        });
        
        // Bet 10: 1755551228, 0.006201 ETH, 2844-2957 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2844,
            priceMax: 2957,
            stakeAmount: 0.006201 ether
        });
        
        console.log("=== Placing Batch 16 (10 Bets) ===");
        
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
