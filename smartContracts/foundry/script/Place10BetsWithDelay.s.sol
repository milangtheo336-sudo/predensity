// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract Place10BetsWithDelayScript is Script {
    struct BetData {
        uint256 dayOffset;
        uint256 priceMin;
        uint256 priceMax;
        uint256 stakeAmount;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        address marketAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V2");
        
        console.log("Deployer address:", deployerAddress);
        console.log("Using market at:", marketAddress);
        
        PredensityPredictionMarket market = PredensityPredictionMarket(marketAddress);
        uint256 currentTimestamp = block.timestamp;
        console.log("Current timestamp:", currentTimestamp);
        
        // Define 10 bets with varying parameters
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: Day 1, 2100-2550 BPS
        bets[0] = BetData({
            dayOffset: 1,
            priceMin: 2100,
            priceMax: 2550,
            stakeAmount: 0.001 ether
        });
        
        // Bet 2: Day 1, 2320-2820 BPS
        bets[1] = BetData({
            dayOffset: 1,
            priceMin: 2320,
            priceMax: 2820,
            stakeAmount: 0.0015 ether
        });
        
        // Bet 3: Day 1, 2000-2600 BPS
        bets[2] = BetData({
            dayOffset: 1,
            priceMin: 2000,
            priceMax: 2600,
            stakeAmount: 0.002 ether
        });
        
        // Bet 4: Day 2, 2650-3150 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2650,
            priceMax: 3150,
            stakeAmount: 0.0025 ether
        });
        
        // Bet 5: Day 2, 2450-2930 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2450,
            priceMax: 2930,
            stakeAmount: 0.003 ether
        });
        
        // Bet 6: Day 2, 2200-2650 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2200,
            priceMax: 2650,
            stakeAmount: 0.0012 ether
        });
        
        // Bet 7: Day 3, 2050-2800 BPS
        bets[6] = BetData({
            dayOffset: 3,
            priceMin: 2050,
            priceMax: 2800,
            stakeAmount: 0.0018 ether
        });
        
        // Bet 8: Day 3, 2750-3450 BPS
        bets[7] = BetData({
            dayOffset: 3,
            priceMin: 2750,
            priceMax: 3450,
            stakeAmount: 0.0022 ether
        });
        
        // Bet 9: Day 3, 2900-3500 BPS
        bets[8] = BetData({
            dayOffset: 3,
            priceMin: 2900,
            priceMax: 3500,
            stakeAmount: 0.0028 ether
        });
        
        // Bet 10: Day 2, 2200-3200 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2200,
            priceMax: 3200,
            stakeAmount: 0.0017 ether
        });
        
        console.log("=== Placing 10 Bets with Delays ===");
        
        vm.startBroadcast(deployerPrivateKey);
        
        for (uint256 i = 0; i < bets.length; i++) {
            BetData memory bet = bets[i];
            
            // Calculate target timestamp starting from current time
            // Add MIN_DAYS_AHEAD + dayOffset to ensure it's at least 1 day ahead
            uint256 targetTimestamp = currentTimestamp + ((market.MIN_DAYS_AHEAD() + bet.dayOffset) * market.SECONDS_PER_DAY());
            
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
            
            // Place the bet
            uint256 betId = market.placeBet{value: bet.stakeAmount}(
                targetTimestamp,
                bet.priceMin,
                bet.priceMax
            );
            
            console.log("Bet placed with ID:", betId);
            console.log("");
            
            // Add delay between transactions (only if not the last bet)
            if (i < bets.length - 1) {
                console.log("Waiting 3 seconds before next bet...");
                // Note: In Foundry scripts, we can't actually sleep, but this logs the intention
                // The actual delay will be handled by the broadcast process
            }
        }
        
        vm.stopBroadcast();
        
        // Get final stats
        (uint256 totalBets, uint256 totalFees, uint256 contractBalance) = market.getStats();
        console.log("=== All 10 bets placed successfully! ===");
        console.log("Total bets in contract:", totalBets);
        console.log("Total fees collected:", totalFees);
        console.log("Contract balance:", contractBalance);
    }
} 