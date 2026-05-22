// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract AnalyzeContractStateScript is Script {
    function run() external {
        address marketAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V2");
        console.log("Analyzing market at:", marketAddress);
        
        PredensityPredictionMarket market = PredensityPredictionMarket(marketAddress);
        
        // Get contract constants
        uint256 startTimestamp = market.startTimestamp();
        uint256 secondsPerDay = market.SECONDS_PER_DAY();
        uint256 minDaysAhead = market.MIN_DAYS_AHEAD();
        uint256 maxDaysAhead = market.MAX_DAYS_AHEAD();
        
        console.log("=== Contract Constants ===");
        console.log("Start timestamp:", startTimestamp);
        console.log("Seconds per day:", secondsPerDay);
        console.log("Min days ahead:", minDaysAhead);
        console.log("Max days ahead:", maxDaysAhead);
        
        // Get current block timestamp
        uint256 currentTimestamp = block.timestamp;
        console.log("Current timestamp:", currentTimestamp);
        
        // Calculate valid time ranges
        uint256 minValidTime = currentTimestamp + (minDaysAhead * secondsPerDay);
        uint256 maxValidTime = currentTimestamp + (maxDaysAhead * secondsPerDay);
        
        console.log("=== Valid Time Ranges ===");
        console.log("Min valid timestamp:", minValidTime);
        console.log("Max valid timestamp:", maxValidTime);
        console.log("Min valid time (days from now):", (minValidTime - currentTimestamp) / secondsPerDay);
        console.log("Max valid time (days from now):", (maxValidTime - currentTimestamp) / secondsPerDay);
        
        // Calculate bucket mappings for different days
        console.log("=== Bucket Analysis ===");
        for (uint256 dayOffset = 1; dayOffset <= 5; dayOffset++) {
            uint256 targetTimestamp = currentTimestamp + (dayOffset * secondsPerDay);
            uint256 bucket = market.bucketIndex(targetTimestamp);
            
            console.log("Day offset:", dayOffset);
            console.log("Target timestamp:", targetTimestamp);
            console.log("Bucket index:", bucket);
            console.log("Valid for betting:", targetTimestamp >= minValidTime && targetTimestamp <= maxValidTime);
            console.log("");
        }
        
        // Get current contract stats
        (uint256 totalBets, uint256 totalFees, uint256 contractBalance) = market.getStats();
        console.log("=== Current Contract Stats ===");
        console.log("Total bets:", totalBets);
        console.log("Total fees:", totalFees);
        console.log("Contract balance:", contractBalance);
        
        // Check existing bets to understand bucket distribution
        console.log("=== Existing Bets Analysis ===");
        for (uint256 i = 0; i < totalBets; i++) {
            PredensityPredictionMarket.Bet memory bet = market.getBet(i);
            uint256 bucket = market.bucketIndex(bet.targetTimestamp);
            
            console.log("Bet ID:", i);
            console.log("Target timestamp:", bet.targetTimestamp);
            console.log("Bucket:", bucket);
            console.log("Days from start:", (bet.targetTimestamp - startTimestamp) / secondsPerDay);
            console.log("");
        }
    }
} 