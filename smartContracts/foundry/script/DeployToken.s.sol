// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";
import {HederaToken} from "../src/HederaToken.sol";

contract DeployTokenScript is Script {
    function run() external returns (address) {
        // Load the private key from the .env file
        uint256 deployerPrivateKey = vm.envUint("OPERATOR_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        
        console.log("Deploying HederaToken...");
        console.log("Deployer address:", deployerAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the contract
        HederaToken token = new HederaToken(deployerAddress);
        
        vm.stopBroadcast();
        
        console.log("HederaToken deployed to:", address(token));
        console.log("Initial balance:", token.balanceOf(deployerAddress));
        
        return address(token);
    }
} 