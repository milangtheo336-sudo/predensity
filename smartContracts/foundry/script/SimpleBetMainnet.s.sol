// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract SimpleBetMainnetScript is Script {
    function run() external returns (uint256) {
        uint256 privateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address contractAddress = vm.envAddress("MAINNET_MARKET_ADDRESS");
        
        console.log("=== Simple Bet on Mainnet ===");
        console.log("Contract address:", contractAddress);
        
        // Create contract instance
        PredensityPredictionMarket market = PredensityPredictionMarket(contractAddress);
        
        // Simple bet parameters - 2 days from now, wide range, small stake
        uint256 targetTimestamp = block.timestamp + (2 * 24 * 60 * 60); // 2 days
        uint256 priceMin = 1000; // 10% in BPS
        uint256 priceMax = 3000; // 30% in BPS
        uint256 stakeAmount = 0.01 ether; // Minimum stake
        
        console.log("Target timestamp:", targetTimestamp);
        console.log("Price range:", priceMin, "-", priceMax);
        console.log("Stake amount:", stakeAmount);
        
        vm.startBroadcast(privateKey);
        
        uint256 betId = market.placeBet{value: stakeAmount}(
            targetTimestamp,
            priceMin,
            priceMax
        );
        
        vm.stopBroadcast();
        
        console.log("Bet ID:", betId);
        return betId;
    }
} 