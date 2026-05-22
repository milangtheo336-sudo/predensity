// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract PlaceBetMainnetScript is Script {
    function run() external returns (uint256) {
        uint256 privateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address contractAddress = vm.envAddress("MAINNET_MARKET_ADDRESS");
        address bettorAddress = vm.addr(privateKey);
        
        console.log("=== Placing Bet on Mainnet ===");
        console.log("Contract address:", contractAddress);
        console.log("Bettor address:", bettorAddress);
        
        // Create contract instance
        PredensityPredictionMarket market = PredensityPredictionMarket(contractAddress);
        
        // Bet parameters
        uint256 targetTimestamp = block.timestamp + (3 * 24 * 60 * 60); // 3 days from now
        uint256 priceMin = 1500; // 15% in BPS
        uint256 priceMax = 2500; // 25% in BPS
        uint256 stakeAmount = 0.05 ether; // 0.05 ETH
        
        console.log("\n=== Bet Parameters ===");
        console.log("Target timestamp:", targetTimestamp);
        console.log("Price min (BPS):", priceMin);
        console.log("Price max (BPS):", priceMax);
        console.log("Stake amount:", stakeAmount);
        
        // Simulate the bet first
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
            console.log("Sharpness BPS:", simulation.sharpnessBps);
            console.log("Time BPS:", simulation.timeBps);
            console.log("Quality BPS:", simulation.qualityBps);
            console.log("Weight:", simulation.weight);
            console.log("Bucket:", simulation.bucket);
        } else {
            console.log("Simulation failed:", simulation.errorMessage);
            revert("Bet simulation failed");
        }
        
        // Place the actual bet
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
        
        // Get bet details
        PredensityPredictionMarket.Bet memory bet = market.getBet(betId);
        console.log("\n=== Bet Details ===");
        console.log("Bettor:", bet.bettor);
        console.log("Target timestamp:", bet.targetTimestamp);
        console.log("Price min:", bet.priceMin);
        console.log("Price max:", bet.priceMax);
        console.log("Stake:", bet.stake);
        console.log("Quality BPS:", bet.qualityBps);
        console.log("Weight:", bet.weight);
        console.log("Finalized:", bet.finalized);
        console.log("Claimed:", bet.claimed);
        
        // Get bucket info
        uint256 bucket = market.bucketIndex(targetTimestamp);
        (uint256 totalStaked, uint256 totalWeight, uint256 price) = market.getBucketStats(bucket);
        console.log("\n=== Bucket Stats ===");
        console.log("Bucket:", bucket);
        console.log("Total staked:", totalStaked);
        console.log("Total weight:", totalWeight);
        console.log("Price:", price);
        
        return betId;
    }
} 