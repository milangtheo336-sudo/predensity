// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract BetWith01HBARScript is Script {
    function run() external returns (uint256) {
        uint256 privateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address contractAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V2");
        
        console.log("=== Bet with 0.1 HBAR ===");
        console.log("Contract address:", contractAddress);
        
        // Create contract instance
        PredensityPredictionMarket market = PredensityPredictionMarket(contractAddress);
        
        // Use 0.1 HBAR as stake
        uint256 stakeAmount = 0.1 ether; // 0.1 HBAR
        
        console.log("\n=== Stake Test ===");
        console.log("MIN_STAKE:", market.MIN_STAKE());
        console.log("MAX_STAKE:", market.MAX_STAKE());
        console.log("Our stake amount:", stakeAmount);
        console.log("Is above min:", stakeAmount >= market.MIN_STAKE());
        console.log("Is below max:", stakeAmount <= market.MAX_STAKE());
        
        // Calculate the exact minimum time required
        uint256 minDaysAhead = market.MIN_DAYS_AHEAD();
        uint256 secondsPerDay = market.SECONDS_PER_DAY();
        uint256 minTimeRequired = block.timestamp + (minDaysAhead * secondsPerDay);
        uint256 targetTimestamp = minTimeRequired + 60; // Add 1 minute buffer
        
        uint256 priceMin = 1200; // 12% in BPS
        uint256 priceMax = 2800; // 28% in BPS
        
        console.log("\n=== Bet Parameters ===");
        console.log("Target timestamp:", targetTimestamp);
        console.log("Price min:", priceMin);
        console.log("Price max:", priceMax);
        console.log("Stake amount:", stakeAmount);
        console.log("Days ahead:", (targetTimestamp - block.timestamp) / secondsPerDay);
        
        // Place the bet directly without simulation (since simulatePlaceBet still has validation)
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