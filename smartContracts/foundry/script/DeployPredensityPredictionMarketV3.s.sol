// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract DeployPredensityPredictionMarketV3Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployerAddress);
        console.log("Deploying PredensityPredictionMarket V3 with batch functionality...");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the updated contract
        PredensityPredictionMarket market = new PredensityPredictionMarket();
        
        vm.stopBroadcast();
        
        console.log("=== Deployment Successful ===");
        console.log("Contract deployed at:", address(market));
        console.log("Owner:", market.owner());
        console.log("Start timestamp:", market.startTimestamp());
        console.log("MIN_DAYS_AHEAD:", market.MIN_DAYS_AHEAD());
        console.log("MAX_DAYS_AHEAD:", market.MAX_DAYS_AHEAD());
        console.log("MIN_STAKE:", market.MIN_STAKE());
        console.log("MAX_STAKE:", market.MAX_STAKE());
        
        // Save the contract address to a file for easy access
        string memory deploymentInfo = string.concat(
            "PredensityPredictionMarket V3 deployed at: ",
            vm.toString(address(market)),
            "\nDeployer: ",
            vm.toString(deployerAddress),
            "\nTimestamp: ",
            vm.toString(block.timestamp)
        );
        
        vm.writeFile("deployment_v3.txt", deploymentInfo);
        console.log("Deployment info saved to deployment_v3.txt");
    }
} 