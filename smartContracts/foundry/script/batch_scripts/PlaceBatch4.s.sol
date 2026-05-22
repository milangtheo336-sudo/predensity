// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch4Script is Script {
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
        
        // Define the 10 bets from mock data (bets 31-40)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1754630000, 0.04 ETH, 3099-3250 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 3099,
            priceMax: 3250,
            stakeAmount: 0.04 ether
        });
        
        // Bet 2: 1754631224, 0.068048 ETH, 2355-2445 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2355,
            priceMax: 2445,
            stakeAmount: 0.068048 ether
        });
        
        // Bet 3: 1754640159, 0.002429 ETH, 2329-2526 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2329,
            priceMax: 2526,
            stakeAmount: 0.002429 ether
        });
        
        // Bet 4: 1754640000, 0.15 ETH, 2200-2500 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2200,
            priceMax: 2500,
            stakeAmount: 0.15 ether
        });
        
        // Bet 5: 1754640629, 0.034738 ETH, 2368-2461 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2368,
            priceMax: 2461,
            stakeAmount: 0.034738 ether
        });
        
        // Bet 6: 1754641469, 0.001852 ETH, 2379-2550 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2379,
            priceMax: 2550,
            stakeAmount: 0.001852 ether
        });
        
        // Bet 7: 1754640000, 0.24 ETH, 3099-3295 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 3099,
            priceMax: 3295,
            stakeAmount: 0.24 ether
        });
        
        // Bet 8: 1754642499, 0.025064 ETH, 2401-2580 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2401,
            priceMax: 2580,
            stakeAmount: 0.025064 ether
        });
        
        // Bet 9: 1754650000, 0.14 ETH, 1700-2200 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 1700,
            priceMax: 2200,
            stakeAmount: 0.14 ether
        });
        
        // Bet 10: 1754650939, 0.098985 ETH, 2480-2508 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2480,
            priceMax: 2508,
            stakeAmount: 0.098985 ether
        });
        
        console.log("=== Placing Batch 4 (10 Bets) ===");
        
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