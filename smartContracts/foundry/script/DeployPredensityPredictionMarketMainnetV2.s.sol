// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract DeployPredensityPredictionMarketMainnetV2Script is Script {
    function run() external returns (address) {
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        
        console.log("Deploying PredensityPredictionMarket V2 to MAINNET...");
        console.log("Deployer address:", deployerAddress);
        console.log("Current timestamp:", block.timestamp);
        console.log("Note: This version has removed bet amount validation for Hedera compatibility");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the updated contract
        PredensityPredictionMarket predictionMarket = new PredensityPredictionMarket();
        
        vm.stopBroadcast();
        
        console.log("PredensityPredictionMarket V2 deployed to:", address(predictionMarket));
        console.log("Contract owner:", predictionMarket.owner());
        console.log("Start timestamp:", predictionMarket.startTimestamp());
        console.log("Contract balance:", address(predictionMarket).balance);
        
        // Log some contract constants for reference
        console.log("=== Contract Constants ===");
        console.log("SECONDS_PER_DAY:", predictionMarket.SECONDS_PER_DAY());
        console.log("FEE_BPS:", predictionMarket.FEE_BPS());
        console.log("BPS_DENOM:", predictionMarket.BPS_DENOM());
        console.log("MIN_STAKE:", predictionMarket.MIN_STAKE());
        console.log("MAX_STAKE:", predictionMarket.MAX_STAKE());
        console.log("MAX_DAYS_AHEAD:", predictionMarket.MAX_DAYS_AHEAD());
        console.log("MIN_DAYS_AHEAD:", predictionMarket.MIN_DAYS_AHEAD());
        console.log("BATCH_SIZE:", predictionMarket.BATCH_SIZE());
        
        return address(predictionMarket);
    }
} 