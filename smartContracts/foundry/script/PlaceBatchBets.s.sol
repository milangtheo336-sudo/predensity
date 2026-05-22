// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract PlaceBatchBetsScript is Script {
    function run(uint256[] memory targetTimestamps, uint256[] memory priceMins, uint256[] memory priceMaxs) external payable {
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        address marketAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V2");
        
        console.log("Deployer address:", deployerAddress);
        console.log("Using market at:", marketAddress);
        
        PredensityPredictionMarket market = PredensityPredictionMarket(marketAddress);
        uint256 currentTimestamp = block.timestamp;
        console.log("Current timestamp:", currentTimestamp);
        
        console.log("=== Placing Batch Bets ===");
        console.log("Number of bets:", targetTimestamps.length);
        console.log("Total value sent:", msg.value, "wei");
        
        // Validate arrays have same length
        require(
            targetTimestamps.length == priceMins.length && 
            priceMins.length == priceMaxs.length,
            "Array lengths must match"
        );
        
        // Validate batch size limit
        require(targetTimestamps.length <= 10, "Maximum 10 bets per batch");
        
        // Log bet details
        for (uint i = 0; i < targetTimestamps.length; i++) {
            console.log("Bet", i + 1, ":");
            console.log("  Target timestamp:", targetTimestamps[i]);
            console.log("  Price range:");
            console.log(priceMins[i]);
            console.log("-");
            console.log(priceMaxs[i]);
            console.log("BPS");
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Place the batch bet
        uint256[] memory betIds = market.placeBatchBets{value: msg.value}(
            targetTimestamps,
            priceMins,
            priceMaxs,
            new uint256[](0) // Empty stake amounts array - this script is outdated
        );
        
        vm.stopBroadcast();
        
        console.log("Batch bet placed successfully!");
        console.log("Bet IDs:");
        for (uint i = 0; i < betIds.length; i++) {
            console.log(betIds[i]);
        }
        
        // Get updated stats
        (uint256 totalBets, uint256 totalFees, uint256 contractBalance) = market.getStats();
        console.log("Total bets in contract:", totalBets);
        console.log("Total fees collected:", totalFees);
        console.log("Contract balance:", contractBalance);
    }
} 