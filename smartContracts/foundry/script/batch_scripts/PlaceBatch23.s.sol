// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch23Script is Script {
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
        
        // Define the 10 bets from mock data (bets 221-230)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1756515925, 0.001458 ETH, 3134-3169 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 3134,
            priceMax: 3169,
            stakeAmount: 0.001458 ether
        });
        
        // Bet 2: 1756517827, 0.001284 ETH, 3050-3100 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 3050,
            priceMax: 3100,
            stakeAmount: 0.001284 ether
        });
        
        // Bet 3: 1756613375, 0.10008 ETH, 3066-3264 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 3066,
            priceMax: 3264,
            stakeAmount: 0.10008 ether
        });
        
        // Bet 4: 1756615425, 0.037646 ETH, 3116-3253 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 3116,
            priceMax: 3253,
            stakeAmount: 0.037646 ether
        });
        
        // Bet 5: 1756616863, 0.00156 ETH, 3106-3178 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 3106,
            priceMax: 3178,
            stakeAmount: 0.00156 ether
        });
        
        // Bet 6: 1756618425, 0.054315 ETH, 3116-3258 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 3116,
            priceMax: 3258,
            stakeAmount: 0.054315 ether
        });
        
        // Bet 7: 1756619203, 0.063208 ETH, 2996-3157 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2996,
            priceMax: 3157,
            stakeAmount: 0.063208 ether
        });
        
        // Bet 8: 1756695444, 0.009339 ETH, 3113-3192 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 3113,
            priceMax: 3192,
            stakeAmount: 0.009339 ether
        });
        
        // Bet 9: 1756698564, 0.004697 ETH, 3095-3147 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 3095,
            priceMax: 3147,
            stakeAmount: 0.004697 ether
        });
        
        // Bet 10: 1756713839, 0.00643 ETH, 3141-3266 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 3141,
            priceMax: 3266,
            stakeAmount: 0.00643 ether
        });
        
        console.log("=== Placing Batch 23 (10 Bets) ===");
        
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
