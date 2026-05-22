// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract MinimalBetScript is Script {
    function run() external {
        uint256 privateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address contractAddress = vm.envAddress("MAINNET_MARKET_ADDRESS");
        
        console.log("=== Minimal Bet Test ===");
        console.log("Contract address:", contractAddress);
        
        // Create contract instance
        PredensityPredictionMarket market = PredensityPredictionMarket(contractAddress);
        
        // Check current state before bet
        console.log("\n=== Before Bet ===");
        console.log("Next bet ID:", market.nextBetId());
        console.log("Contract balance:", address(market).balance);
        console.log("Total fees collected:", market.totalFeesCollected());
        
        // Use absolute minimum parameters
        uint256 targetTimestamp = block.timestamp + (1 * 24 * 60 * 60); // Exactly 1 day
        uint256 priceMin = 1000; // 10% in BPS
        uint256 priceMax = 2000; // 20% in BPS
        uint256 stakeAmount = 0.01 ether; // Minimum stake
        
        console.log("\n=== Bet Parameters ===");
        console.log("Target timestamp:", targetTimestamp);
        console.log("Price min:", priceMin);
        console.log("Price max:", priceMax);
        console.log("Stake amount:", stakeAmount);
        
        // Try to place bet
        console.log("\n=== Attempting Bet Placement ===");
        vm.startBroadcast(privateKey);
        
        try market.placeBet{value: stakeAmount}(
            targetTimestamp,
            priceMin,
            priceMax
        ) returns (uint256 betId) {
            console.log("Bet placed successfully! Bet ID:", betId);
        } catch Error(string memory reason) {
            console.log("Bet placement failed with reason:", reason);
        } catch {
            console.log("Bet placement failed with unknown error");
        }
        
        vm.stopBroadcast();
        
        // Check state after bet
        console.log("\n=== After Bet ===");
        console.log("Next bet ID:", market.nextBetId());
        console.log("Contract balance:", address(market).balance);
        console.log("Total fees collected:", market.totalFeesCollected());
    }
} 