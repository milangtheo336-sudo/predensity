// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract VerifyBet1Script is Script {
    function run() external {
        address contractAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V2");
        
        console.log("=== Verifying Bet 1 (0.1 HBAR) ===");
        console.log("Contract address:", contractAddress);
        
        // Create contract instance
        PredensityPredictionMarket market = PredensityPredictionMarket(contractAddress);
        
        // Check contract state
        console.log("\n=== Contract State ===");
        console.log("Next bet ID:", market.nextBetId());
        console.log("Total fees collected:", market.totalFeesCollected());
        console.log("Contract balance:", address(market).balance);
        
        // Get bet 0 details
        try market.getBet(0) returns (PredensityPredictionMarket.Bet memory bet0) {
            console.log("\n=== Bet 0 Details ===");
            console.log("Bettor:", bet0.bettor);
            console.log("Target timestamp:", bet0.targetTimestamp);
            console.log("Price min:", bet0.priceMin);
            console.log("Price max:", bet0.priceMax);
            console.log("Stake:", bet0.stake);
            console.log("Quality BPS:", bet0.qualityBps);
            console.log("Weight:", bet0.weight);
        } catch {
            console.log("Bet 0 not found");
        }
        
        // Get bet 1 details
        try market.getBet(1) returns (PredensityPredictionMarket.Bet memory bet1) {
            console.log("\n=== Bet 1 Details ===");
            console.log("Bettor:", bet1.bettor);
            console.log("Target timestamp:", bet1.targetTimestamp);
            console.log("Price min:", bet1.priceMin);
            console.log("Price max:", bet1.priceMax);
            console.log("Stake:", bet1.stake);
            console.log("Quality BPS:", bet1.qualityBps);
            console.log("Weight:", bet1.weight);
            console.log("Finalized:", bet1.finalized);
            console.log("Claimed:", bet1.claimed);
        } catch {
            console.log("Bet 1 not found");
        }
        
        // Check bucket 1 stats (both bets should be in bucket 1)
        console.log("\n=== Bucket 1 Stats ===");
        (uint256 totalStaked, uint256 totalWeight, uint256 price) = market.getBucketStats(1);
        console.log("Total staked:", totalStaked);
        console.log("Total weight:", totalWeight);
        console.log("Price:", price);
        
        // Get bucket info
        (uint256 totalBets, uint256 totalWinningWeight, uint256 nextProcessIndex, bool aggregationComplete) = market.getBucketInfo(1);
        console.log("\n=== Bucket 1 Info ===");
        console.log("Total bets:", totalBets);
        console.log("Total winning weight:", totalWinningWeight);
        console.log("Next process index:", nextProcessIndex);
        console.log("Aggregation complete:", aggregationComplete);
    }
} 