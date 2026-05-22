// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract CorrectBetScript is Script {
    function run() external returns (uint256) {
        uint256 privateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address contractAddress = vm.envAddress("MAINNET_MARKET_ADDRESS");
        
        console.log("=== Correct Bet Placement ===");
        console.log("Contract address:", contractAddress);
        
        // Create contract instance
        PredensityPredictionMarket market = PredensityPredictionMarket(contractAddress);
        
        // Calculate the exact minimum time required
        uint256 minDaysAhead = market.MIN_DAYS_AHEAD();
        uint256 secondsPerDay = market.SECONDS_PER_DAY();
        uint256 minTimeRequired = block.timestamp + (minDaysAhead * secondsPerDay);
        
        console.log("\n=== Time Calculations ===");
        console.log("Current timestamp:", block.timestamp);
        console.log("MIN_DAYS_AHEAD:", minDaysAhead);
        console.log("SECONDS_PER_DAY:", secondsPerDay);
        console.log("Minimum time required:", minTimeRequired);
        console.log("Time difference:", minTimeRequired - block.timestamp);
        
        // Use exactly the minimum time required + a small buffer
        uint256 targetTimestamp = minTimeRequired + 60; // Add 1 minute buffer
        uint256 priceMin = 1500; // 15% in BPS
        uint256 priceMax = 2500; // 25% in BPS
        uint256 stakeAmount = 0.01 ether; // Minimum stake
        
        console.log("\n=== Bet Parameters ===");
        console.log("Target timestamp:", targetTimestamp);
        console.log("Price min:", priceMin);
        console.log("Price max:", priceMax);
        console.log("Stake amount:", stakeAmount);
        console.log("Days ahead:", (targetTimestamp - block.timestamp) / secondsPerDay);
        
        // Simulate first
        console.log("\n=== Simulating Bet ===");
        PredensityPredictionMarket.BetSimulation memory simulation = market.simulatePlaceBet(
            targetTimestamp,
            priceMin,
            priceMax,
            stakeAmount
        );
        
        if (simulation.isValid) {
            console.log("Simulation successful!");
            console.log("Fee:", simulation.fee);
            console.log("Net stake:", simulation.stakeNet);
            console.log("Weight:", simulation.weight);
            console.log("Bucket:", simulation.bucket);
        } else {
            console.log("Simulation failed:", simulation.errorMessage);
            revert("Simulation failed");
        }
        
        // Place the bet
        console.log("\n=== Placing Bet ===");
        vm.startBroadcast(privateKey);
        
        uint256 betId = market.placeBet{value: stakeAmount}(
            targetTimestamp,
            priceMin,
            priceMax
        );
        
        vm.stopBroadcast();
        
        console.log("Bet placed successfully!");
        console.log("Bet ID:", betId);
        
        return betId;
    }
} 