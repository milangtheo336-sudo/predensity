// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch3Script is Script {
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
        
        // Define the 10 bets from mock data (bets 21-30)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1754610000, 0.04 ETH, 1500-2000 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 1500,
            priceMax: 2000,
            stakeAmount: 0.04 ether
        });
        
        // Bet 2: 1754617244, 0.009306 ETH, 2327-2422 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2327,
            priceMax: 2422,
            stakeAmount: 0.009306 ether
        });
        
        // Bet 3: 1754617292, 0.072504 ETH, 2411-2478 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2411,
            priceMax: 2478,
            stakeAmount: 0.072504 ether
        });
        
        // Bet 4: 1754620000, 0.6 ETH, 5700-6300 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 5700,
            priceMax: 6300,
            stakeAmount: 0.6 ether
        });
        
        // Bet 5: 1754620412, 0.00664 ETH, 2468-2615 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2468,
            priceMax: 2615,
            stakeAmount: 0.00664 ether
        });
        
        // Bet 6: 1754628780, 0.43083 ETH, 1933-2090 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 1933,
            priceMax: 2090,
            stakeAmount: 0.43083 ether
        });
        
        // Bet 7: 1754629449, 0.021831 ETH, 2456-2529 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2456,
            priceMax: 2529,
            stakeAmount: 0.021831 ether
        });
        
        // Bet 8: 1754620000, 0.02 ETH, 900-1300 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 900,
            priceMax: 1300,
            stakeAmount: 0.02 ether
        });
        
        // Bet 9: 1754629689, 0.0063 ETH, 2495-2597 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2495,
            priceMax: 2597,
            stakeAmount: 0.0063 ether
        });
        
        // Bet 10: 1754629844, 0.08262 ETH, 2432-2458 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2432,
            priceMax: 2458,
            stakeAmount: 0.08262 ether
        });
        
        console.log("=== Placing Batch 3 (10 Bets) ===");
        
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