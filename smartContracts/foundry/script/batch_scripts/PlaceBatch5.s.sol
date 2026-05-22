// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch5Script is Script {
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
        
        // Define the 10 bets from mock data (bets 41-50)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1754653257, 0.18388 ETH, 2486-2558 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2486,
            priceMax: 2558,
            stakeAmount: 0.18388 ether
        });
        
        // Bet 2: 1754650000, 0.48 ETH, 2957-3049 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2957,
            priceMax: 3049,
            stakeAmount: 0.48 ether
        });
        
        // Bet 3: 1754653939, 0.003417 ETH, 2511-2613 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2511,
            priceMax: 2613,
            stakeAmount: 0.003417 ether
        });
        
        // Bet 4: 1754654457, 0.022066 ETH, 2401-2527 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2401,
            priceMax: 2527,
            stakeAmount: 0.022066 ether
        });
        
        // Bet 5: 1754650000, 0.4 ETH, 3025-3115 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 3025,
            priceMax: 3115,
            stakeAmount: 0.4 ether
        });
        
        // Bet 6: 1754658989, 0.010486 ETH, 2478-2529 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2478,
            priceMax: 2529,
            stakeAmount: 0.010486 ether
        });
        
        // Bet 7: 1754661329, 0.149188 ETH, 2574-2609 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2574,
            priceMax: 2609,
            stakeAmount: 0.149188 ether
        });
        
        // Bet 8: 1754660000, 0.24 ETH, 1200-1500 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 1200,
            priceMax: 1500,
            stakeAmount: 0.24 ether
        });
        
        // Bet 9: 1754661531, 0.004842 ETH, 2335-2555 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2335,
            priceMax: 2555,
            stakeAmount: 0.004842 ether
        });
        
        // Bet 10: 1754663691, 0.00472 ETH, 2321-2463 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2321,
            priceMax: 2463,
            stakeAmount: 0.00472 ether
        });
        
        console.log("=== Placing Batch 5 (10 Bets) ===");
        
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