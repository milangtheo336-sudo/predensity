// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract DeployPredensityPredictionMarketV4Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployerAddress);
        console.log("Deploying PredensityPredictionMarket V4 with improved batch functionality...");
        console.log("Changes:");
        console.log("- Removed 10 bet limit from placeBatchBets");
        console.log("- Added stakeAmounts array parameter");
        console.log("- Individual stake amounts per bet instead of equal splitting");
        
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
            "PredensityPredictionMarket V4 deployed at: ",
            vm.toString(address(market)),
            "\nDeployer: ",
            vm.toString(deployerAddress),
            "\nTimestamp: ",
            vm.toString(block.timestamp),
            "\nChanges:",
            "\n- Removed 10 bet limit from placeBatchBets",
            "\n- Added stakeAmounts array parameter", 
            "\n- Individual stake amounts per bet"
        );
        
    }
} 