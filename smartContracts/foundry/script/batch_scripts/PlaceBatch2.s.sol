// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch2Script is Script {
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
        
        // Define the 10 bets from mock data (bets 11-20)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1754597411, 0.002181 ETH, 2338-2464 BPS
        bets[0] = BetData({
            dayOffset: 1,
            priceMin: 2338,
            priceMax: 2464,
            stakeAmount: 0.002181 ether
        });
        
        // Bet 2: 1754600000, 0.56 ETH, 1744-1846 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 1744,
            priceMax: 1846,
            stakeAmount: 0.56 ether
        });
        
        // Bet 3: 1754600411, 0.068647 ETH, 2253-2436 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2253,
            priceMax: 2436,
            stakeAmount: 0.068647 ether
        });
        
        // Bet 4: 1754606331, 0.165248 ETH, 2384-2525 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2384,
            priceMax: 2525,
            stakeAmount: 0.165248 ether
        });
        
        // Bet 5: 1754600000, 0.03 ETH, 5000-7000 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 5000,
            priceMax: 7000,
            stakeAmount: 0.03 ether
        });
        
        // Bet 6: 1754606511, 0.002472 ETH, 2461-2503 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2461,
            priceMax: 2503,
            stakeAmount: 0.002472 ether
        });
        
        // Bet 7: 1754610360, 0.03672 ETH, 2322-2469 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2322,
            priceMax: 2469,
            stakeAmount: 0.03672 ether
        });
        
        // Bet 8: 1754610720, 0.04904 ETH, 2406-2504 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2406,
            priceMax: 2504,
            stakeAmount: 0.04904 ether
        });
        
        // Bet 9: 1754610000, 0.64 ETH, 3700-4000 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 3700,
            priceMax: 4000,
            stakeAmount: 0.64 ether
        });
        
        // Bet 10: 1754617184, 0.011186 ETH, 2440-2480 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2440,
            priceMax: 2480,
            stakeAmount: 0.011186 ether
        });
        
        console.log("=== Placing Batch 2 (10 Bets) ===");
        
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