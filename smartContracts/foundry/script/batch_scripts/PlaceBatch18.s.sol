// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch18Script is Script {
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
        
        // Define the 10 bets from mock data (bets 171-180)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1755760939, 0.018936 ETH, 2882-3047 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2882,
            priceMax: 3047,
            stakeAmount: 0.018936 ether
        });
        
        // Bet 2: 1755761888, 0.005979 ETH, 2975-3142 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2975,
            priceMax: 3142,
            stakeAmount: 0.005979 ether
        });
        
        // Bet 3: 1755764228, 0.11949 ETH, 2921-3006 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2921,
            priceMax: 3006,
            stakeAmount: 0.11949 ether
        });
        
        // Bet 4: 1755764468, 0.119782 ETH, 2844-3024 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2844,
            priceMax: 3024,
            stakeAmount: 0.119782 ether
        });
        
        // Bet 5: 1755806423, 0.082464 ETH, 2924-3087 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2924,
            priceMax: 3087,
            stakeAmount: 0.082464 ether
        });
        
        // Bet 6: 1755830339, 0.002282 ETH, 2896-3068 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2896,
            priceMax: 3068,
            stakeAmount: 0.002282 ether
        });
        
        // Bet 7: 1755859201, 0.00828 ETH, 2913-3046 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2913,
            priceMax: 3046,
            stakeAmount: 0.00828 ether
        });
        
        // Bet 8: 1755859861, 0.15115 ETH, 2915-3000 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2915,
            priceMax: 3000,
            stakeAmount: 0.15115 ether
        });
        
        // Bet 9: 1755867790, 0.018785 ETH, 2919-2997 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2919,
            priceMax: 2997,
            stakeAmount: 0.018785 ether
        });
        
        // Bet 10: 1755868150, 0.000548 ETH, 2990-3038 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2990,
            priceMax: 3038,
            stakeAmount: 0.000548 ether
        });
        
        console.log("=== Placing Batch 18 (10 Bets) ===");
        
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
