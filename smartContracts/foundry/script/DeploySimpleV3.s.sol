// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract DeploySimpleV3Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployerAddress);
        console.log("Deploying simple PredensityPredictionMarket V3...");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the contract
        PredensityPredictionMarket market = new PredensityPredictionMarket();
        
        vm.stopBroadcast();
        
        console.log("=== Simple Deployment Successful ===");
        console.log("Contract deployed at:", address(market));
        console.log("Owner:", market.owner());
        console.log("Start timestamp:", market.startTimestamp());
        
        // Test basic functions
        console.log("MIN_DAYS_AHEAD:", market.MIN_DAYS_AHEAD());
        console.log("MAX_DAYS_AHEAD:", market.MAX_DAYS_AHEAD());
        console.log("MIN_STAKE:", market.MIN_STAKE());
        console.log("MAX_STAKE:", market.MAX_STAKE());
        
        console.log("=== Contract is ready for use ===");
    }
} 