// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch20Script is Script {
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
        
        // Define the 10 bets from mock data (bets 191-200)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1756026203, 0.011972 ETH, 2909-2990 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2909,
            priceMax: 2990,
            stakeAmount: 0.011972 ether
        });
        
        // Bet 2: 1756052670, 0.034434 ETH, 2940-3046 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2940,
            priceMax: 3046,
            stakeAmount: 0.034434 ether
        });
        
        // Bet 3: 1756053450, 0.002244 ETH, 2917-3072 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2917,
            priceMax: 3072,
            stakeAmount: 0.002244 ether
        });
        
        // Bet 4: 1756083057, 0.218365 ETH, 3027-3097 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 3027,
            priceMax: 3097,
            stakeAmount: 0.218365 ether
        });
        
        // Bet 5: 1756110272, 0.008476 ETH, 2880-3058 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2880,
            priceMax: 3058,
            stakeAmount: 0.008476 ether
        });
        
        // Bet 6: 1756113692, 0.064936 ETH, 2985-3085 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2985,
            priceMax: 3085,
            stakeAmount: 0.064936 ether
        });
        
        // Bet 7: 1756155688, 0.000725 ETH, 2992-3044 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2992,
            priceMax: 3044,
            stakeAmount: 0.000725 ether
        });
        
        // Bet 8: 1756158928, 0.02321 ETH, 2884-3055 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2884,
            priceMax: 3055,
            stakeAmount: 0.02321 ether
        });
        
        // Bet 9: 1756211733, 0.024992 ETH, 3009-3148 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 3009,
            priceMax: 3148,
            stakeAmount: 0.024992 ether
        });
        
        // Bet 10: 1756212595, 0.00942 ETH, 2987-3130 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2987,
            priceMax: 3130,
            stakeAmount: 0.00942 ether
        });
        
        console.log("=== Placing Batch 20 (10 Bets) ===");
        
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
