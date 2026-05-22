// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract PlaceBetLongTermScript is Script {
    function run() external returns (uint256) {
        uint256 privateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address contractAddress = vm.envAddress("MAINNET_MARKET_ADDRESS");
        
        console.log("=== Placing Long-Term Bet on Mainnet ===");
        console.log("Contract address:", contractAddress);
        
        // Create contract instance
        PredensityPredictionMarket market = PredensityPredictionMarket(contractAddress);
        
        // Use a longer time horizon - 5 days from now
        uint256 targetTimestamp = block.timestamp + (5 * 24 * 60 * 60); // 5 days
        uint256 priceMin = 1500; // 15% in BPS
        uint256 priceMax = 2500; // 25% in BPS
        uint256 stakeAmount = 0.01 ether; // Minimum stake
        
        console.log("Target timestamp:", targetTimestamp);
        console.log("Price range:", priceMin, "-", priceMax);
        console.log("Stake amount:", stakeAmount);
        console.log("Days ahead:", (targetTimestamp - block.timestamp) / (24 * 60 * 60));
        
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