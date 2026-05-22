// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract MainnetOperationsScript is Script {
    function run() external {
        uint256 privateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address contractAddress = vm.envAddress("MAINNET_MARKET_ADDRESS");
        address deployerAddress = vm.addr(privateKey);
        
        console.log("=== Mainnet Contract Operations ===");
        console.log("Contract address:", contractAddress);
        console.log("Deployer address:", deployerAddress);
        
        // Create contract instance
        PredensityPredictionMarket market = PredensityPredictionMarket(contractAddress);
        
        // Read contract state
        console.log("\n=== Contract State ===");
        console.log("Owner:", market.owner());
        console.log("Start timestamp:", market.startTimestamp());
        console.log("Total fees collected:", market.totalFeesCollected());
        console.log("Next bet ID:", market.nextBetId());
        console.log("Contract balance:", address(market).balance);
        
        // Read constants
        console.log("\n=== Contract Constants ===");
        console.log("SECONDS_PER_DAY:", market.SECONDS_PER_DAY());
        console.log("FEE_BPS:", market.FEE_BPS());
        console.log("MIN_STAKE:", market.MIN_STAKE());
        console.log("MAX_STAKE:", market.MAX_STAKE());
        console.log("MAX_DAYS_AHEAD:", market.MAX_DAYS_AHEAD());
        console.log("MIN_DAYS_AHEAD:", market.MIN_DAYS_AHEAD());
        
        // Test simulation
        console.log("\n=== Testing Bet Simulation ===");
        uint256 futureTimestamp = block.timestamp + (2 * 24 * 60 * 60); // 2 days from now
        uint256 priceMin = 1000; // 10% in BPS
        uint256 priceMax = 2000; // 20% in BPS
        uint256 stakeAmount = 0.1 ether;
        
        console.log("Simulating bet with:");
        console.log("Target timestamp:", futureTimestamp);
        console.log("Price min:", priceMin);
        console.log("Price max:", priceMax);
        console.log("Stake amount:", stakeAmount);
        
        PredensityPredictionMarket.BetSimulation memory simulation = market.simulatePlaceBet(
            futureTimestamp,
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
        }
        
        // Test bucket calculation
        uint256 bucket = market.bucketIndex(futureTimestamp);
        console.log("\nBucket index for timestamp:", bucket);
        
        // Get bucket stats
        (uint256 totalStaked, uint256 totalWeight, uint256 price) = market.getBucketStats(bucket);
        console.log("Bucket stats - Total staked:", totalStaked);
        console.log("Bucket stats - Total weight:", totalWeight);
        console.log("Bucket stats - Price:", price);
    }
} 