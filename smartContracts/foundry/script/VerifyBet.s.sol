// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract VerifyBetScript is Script {
    function run() external {
        address contractAddress = vm.envAddress("MAINNET_MARKET_ADDRESS");
        
        console.log("=== Verifying Bet on Mainnet ===");
        console.log("Contract address:", contractAddress);
        
        // Create contract instance
        PredensityPredictionMarket market = PredensityPredictionMarket(contractAddress);
        
        // Check contract state
        console.log("\n=== Contract State ===");
        console.log("Next bet ID:", market.nextBetId());
        console.log("Total fees collected:", market.totalFeesCollected());
        console.log("Contract balance:", address(market).balance);
        
        // Try to get bet 0
        try market.getBet(0) returns (PredensityPredictionMarket.Bet memory bet) {
            console.log("\n=== Bet 0 Details ===");
            console.log("Bettor:", bet.bettor);
            console.log("Target timestamp:", bet.targetTimestamp);
            console.log("Price min:", bet.priceMin);
            console.log("Price max:", bet.priceMax);
            console.log("Stake:", bet.stake);
            console.log("Quality BPS:", bet.qualityBps);
            console.log("Weight:", bet.weight);
            console.log("Finalized:", bet.finalized);
            console.log("Claimed:", bet.claimed);
            console.log("Actual price:", bet.actualPrice);
            console.log("Won:", bet.won);
        } catch {
            console.log("Bet 0 not found or error occurred");
        }
        
        // Check bucket 3 stats
        console.log("\n=== Bucket 3 Stats ===");
        (uint256 totalStaked, uint256 totalWeight, uint256 price) = market.getBucketStats(3);
        console.log("Total staked:", totalStaked);
        console.log("Total weight:", totalWeight);
        console.log("Price:", price);
        
        // Get bucket info
        (uint256 totalBets, uint256 totalWinningWeight, uint256 nextProcessIndex, bool aggregationComplete) = market.getBucketInfo(3);
        console.log("\n=== Bucket 3 Info ===");
        console.log("Total bets:", totalBets);
        console.log("Total winning weight:", totalWinningWeight);
        console.log("Next process index:", nextProcessIndex);
        console.log("Aggregation complete:", aggregationComplete);
    }
} 