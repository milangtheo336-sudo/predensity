// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch6Script is Script {
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
        
        // Define the 10 bets from mock data (bets 51-60)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1754667596, 0.006042 ETH, 2547-2633 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2547,
            priceMax: 2633,
            stakeAmount: 0.006042 ether
        });
        
        // Bet 2: 1754670356, 0.001304 ETH, 2550-2690 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2550,
            priceMax: 2690,
            stakeAmount: 0.001304 ether
        });
        
        // Bet 3: 1754676782, 0.318263 ETH, 2591-2640 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2591,
            priceMax: 2640,
            stakeAmount: 0.318263 ether
        });
        
        // Bet 4: 1754670000, 0.24 ETH, 7000-9000 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 7000,
            priceMax: 9000,
            stakeAmount: 0.24 ether
        });
        
        // Bet 5: 1754679722, 0.03432 ETH, 2508-2601 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2508,
            priceMax: 2601,
            stakeAmount: 0.03432 ether
        });
        
        // Bet 6: 1754688913, 0.00991 ETH, 2559-2598 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2559,
            priceMax: 2598,
            stakeAmount: 0.00991 ether
        });
        
        // Bet 7: 1754689033, 0.170478 ETH, 2535-2618 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2535,
            priceMax: 2618,
            stakeAmount: 0.170478 ether
        });
        
        // Bet 8: 1754690000, 0.8 ETH, 5600-6300 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 5600,
            priceMax: 6300,
            stakeAmount: 0.8 ether
        });
        
        // Bet 9: 1754697071, 0.002425 ETH, 2479-2559 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2479,
            priceMax: 2559,
            stakeAmount: 0.002425 ether
        });
        
        // Bet 10: 1754698631, 0.001115 ETH, 2529-2598 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2529,
            priceMax: 2598,
            stakeAmount: 0.001115 ether
        });
        
        console.log("=== Placing Batch 6 (10 Bets) ===");
        
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