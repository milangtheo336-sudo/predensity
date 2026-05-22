// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract TestTimeValidationScript is Script {
    function run() external {
        address contractAddress = vm.envAddress("MAINNET_MARKET_ADDRESS");
        
        console.log("=== Testing Time Validation ===");
        console.log("Contract address:", contractAddress);
        
        // Create contract instance
        PredensityPredictionMarket market = PredensityPredictionMarket(contractAddress);
        
        console.log("\n=== Current State ===");
        console.log("Current block timestamp:", block.timestamp);
        console.log("Contract start timestamp:", market.startTimestamp());
        console.log("SECONDS_PER_DAY:", market.SECONDS_PER_DAY());
        console.log("MIN_DAYS_AHEAD:", market.MIN_DAYS_AHEAD());
        console.log("MAX_DAYS_AHEAD:", market.MAX_DAYS_AHEAD());
        
        // Calculate valid time ranges
        uint256 minTime = block.timestamp + (market.MIN_DAYS_AHEAD() * market.SECONDS_PER_DAY());
        uint256 maxTime = block.timestamp + (market.MAX_DAYS_AHEAD() * market.SECONDS_PER_DAY());
        
        console.log("\n=== Valid Time Ranges ===");
        console.log("Minimum valid timestamp:", minTime);
        console.log("Maximum valid timestamp:", maxTime);
        console.log("Time until min valid:", minTime - block.timestamp);
        console.log("Time until max valid:", maxTime - block.timestamp);
        
        // Test bucket calculation
        console.log("\n=== Bucket Calculations ===");
        console.log("Bucket for min time:", market.bucketIndex(minTime));
        console.log("Bucket for max time:", market.bucketIndex(maxTime));
        
        // Test a valid timestamp
        uint256 validTimestamp = block.timestamp + (2 * 24 * 60 * 60); // 2 days
        console.log("\n=== Testing Valid Timestamp ===");
        console.log("Test timestamp:", validTimestamp);
        console.log("Is valid time range:", validTimestamp >= minTime && validTimestamp <= maxTime);
        console.log("Bucket for test timestamp:", market.bucketIndex(validTimestamp));
        
        // Test simulation with valid parameters
        console.log("\n=== Testing Simulation ===");
        PredensityPredictionMarket.BetSimulation memory simulation = market.simulatePlaceBet(
            validTimestamp,
            1000, // 10% in BPS
            3000, // 30% in BPS
            0.01 ether
        );
        
        if (simulation.isValid) {
            console.log("Simulation successful!");
            console.log("Fee:", simulation.fee);
            console.log("Net stake:", simulation.stakeNet);
            console.log("Weight:", simulation.weight);
            console.log("Bucket:", simulation.bucket);
        } else {
            console.log("Simulation failed:", simulation.errorMessage);
        }
    }
} 