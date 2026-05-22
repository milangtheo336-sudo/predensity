// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch19Script is Script {
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
        
        // Define the 10 bets from mock data (bets 181-190)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1755899340, 0.024086 ETH, 1519-1691 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 1519,
            priceMax: 1691,
            stakeAmount: 0.024086 ether
        });
        
        // Bet 2: 1755922555, 0.005502 ETH, 2895-3106 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2895,
            priceMax: 3106,
            stakeAmount: 0.005502 ether
        });
        
        // Bet 3: 1755922675, 0.208968 ETH, 2949-3058 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2949,
            priceMax: 3058,
            stakeAmount: 0.208968 ether
        });
        
        // Bet 4: 1755925505, 0.010868 ETH, 2878-3057 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2878,
            priceMax: 3057,
            stakeAmount: 0.010868 ether
        });
        
        // Bet 5: 1755952218, 0.07703 ETH, 2915-3092 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2915,
            priceMax: 3092,
            stakeAmount: 0.07703 ether
        });
        
        // Bet 6: 1756000290, 0.02036 ETH, 2961-3011 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2961,
            priceMax: 3011,
            stakeAmount: 0.02036 ether
        });
        
        // Bet 7: 1756002990, 0.320372 ETH, 2839-3004 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2839,
            priceMax: 3004,
            stakeAmount: 0.320372 ether
        });
        
        // Bet 8: 1756005830, 0.037258 ETH, 3004-3066 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 3004,
            priceMax: 3066,
            stakeAmount: 0.037258 ether
        });
        
        // Bet 9: 1756007150, 0.2711 ETH, 2911-3016 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2911,
            priceMax: 3016,
            stakeAmount: 0.2711 ether
        });
        
        // Bet 10: 1756023143, 0.002184 ETH, 2981-3026 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2981,
            priceMax: 3026,
            stakeAmount: 0.002184 ether
        });
        
        console.log("=== Placing Batch 19 (10 Bets) ===");
        
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
