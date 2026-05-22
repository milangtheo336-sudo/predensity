// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch22Script is Script {
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
        
        // Define the 10 bets from mock data (bets 211-220)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1756369894, 0.070434 ETH, 3137-3278 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 3137,
            priceMax: 3278,
            stakeAmount: 0.070434 ether
        });
        
        // Bet 2: 1756372474, 0.028764 ETH, 3096-3231 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 3096,
            priceMax: 3231,
            stakeAmount: 0.028764 ether
        });
        
        // Bet 3: 1756448759, 0.15587 ETH, 3096-3224 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 3096,
            priceMax: 3224,
            stakeAmount: 0.15587 ether
        });
        
        // Bet 4: 1756467273, 0.00035 ETH, 2985-3179 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2985,
            priceMax: 3179,
            stakeAmount: 0.00035 ether
        });
        
        // Bet 5: 1756470180, 0.639165 ETH, 3053-3208 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 3053,
            priceMax: 3208,
            stakeAmount: 0.639165 ether
        });
        
        // Bet 6: 1756473060, 0.055575 ETH, 3058-3227 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 3058,
            priceMax: 3227,
            stakeAmount: 0.055575 ether
        });
        
        // Bet 7: 1756479780, 0.062814 ETH, 3404-3529 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 3404,
            priceMax: 3529,
            stakeAmount: 0.062814 ether
        });
        
        // Bet 8: 1756514266, 0.16416 ETH, 3113-3159 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 3113,
            priceMax: 3159,
            stakeAmount: 0.16416 ether
        });
        
        // Bet 9: 1756514647, 0.015883 ETH, 3086-3185 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 3086,
            priceMax: 3185,
            stakeAmount: 0.015883 ether
        });
        
        // Bet 10: 1756515106, 0.094905 ETH, 3007-3183 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 3007,
            priceMax: 3183,
            stakeAmount: 0.094905 ether
        });
        
        console.log("=== Placing Batch 22 (10 Bets) ===");
        
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
