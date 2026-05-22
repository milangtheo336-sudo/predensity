// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch14Script is Script {
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
        
        // Define the 10 bets from mock data (bets 131-140)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1755206623, 0.049588 ETH, 2762-2885 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2762,
            priceMax: 2885,
            stakeAmount: 0.049588 ether
        });
        
        // Bet 2: 1755211617, 0.003572 ETH, 2764-2951 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2764,
            priceMax: 2951,
            stakeAmount: 0.003572 ether
        });
        
        // Bet 3: 1755214137, 0.012512 ETH, 2771-2910 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2771,
            priceMax: 2910,
            stakeAmount: 0.012512 ether
        });
        
        // Bet 4: 1755219533, 0.006358 ETH, 2689-2854 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2689,
            priceMax: 2854,
            stakeAmount: 0.006358 ether
        });
        
        // Bet 5: 1755221993, 0.327156 ETH, 2741-2854 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2741,
            priceMax: 2854,
            stakeAmount: 0.327156 ether
        });
        
        // Bet 6: 1755239914, 0.034342 ETH, 2713-2764 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2713,
            priceMax: 2764,
            stakeAmount: 0.034342 ether
        });
        
        // Bet 7: 1755242595, 0.00168 ETH, 2764-2795 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2764,
            priceMax: 2795,
            stakeAmount: 0.00168 ether
        });
        
        // Bet 8: 1755245678, 0.005028 ETH, 2743-2911 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2743,
            priceMax: 2911,
            stakeAmount: 0.005028 ether
        });
        
        // Bet 9: 1755246195, 0.75096 ETH, 2742-2872 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2742,
            priceMax: 2872,
            stakeAmount: 0.75096 ether
        });
        
        // Bet 10: 1755247598, 0.000504 ETH, 2776-2811 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2776,
            priceMax: 2811,
            stakeAmount: 0.000504 ether
        });
        
        console.log("=== Placing Batch 14 (10 Bets) ===");
        
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
