// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract PlaceSingleBetScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        address marketAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V2");
        
        console.log("Deployer address:", deployerAddress);
        console.log("Using market at:", marketAddress);
        
        PredensityPredictionMarket market = PredensityPredictionMarket(marketAddress);
        uint256 currentTimestamp = block.timestamp;
        console.log("Current timestamp:", currentTimestamp);
        
        // Configurable bet parameters - modify these as needed
        uint256 dayOffset = vm.envUint("DAY_OFFSET"); // 1, 2, or 3
        uint256 priceMin = vm.envUint("PRICE_MIN");   // e.g., 2100
        uint256 priceMax = vm.envUint("PRICE_MAX");   // e.g., 2550
        uint256 stakeAmount = vm.envUint("STAKE_AMOUNT"); // in wei, e.g., 1000000000000000 for 0.001 ETH
        
        console.log("=== Placing Single Bet ===");
        console.log("Day offset:", dayOffset);
        console.log("Price range:");
        console.log(priceMin);
        console.log("-");
        console.log(priceMax);
        console.log("BPS");
        console.log("Stake amount:", stakeAmount, "wei");
        
        // Calculate target timestamp
        uint256 targetTimestamp = currentTimestamp + ((market.MIN_DAYS_AHEAD() + dayOffset) * market.SECONDS_PER_DAY());
        console.log("Target timestamp:", targetTimestamp);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Place the bet
        uint256 betId = market.placeBet{value: stakeAmount}(
            targetTimestamp,
            priceMin,
            priceMax
        );
        
        vm.stopBroadcast();
        
        console.log("Bet placed with ID:", betId);
        
        // Get updated stats
        (uint256 totalBets, uint256 totalFees, uint256 contractBalance) = market.getStats();
        console.log("Total bets in contract:", totalBets);
        console.log("Total fees collected:", totalFees);
        console.log("Contract balance:", contractBalance);
    }
} 