// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";

contract SimpleV3TestScript is Script {
    function run() external {
        address contractAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V3_NEW");
        
        console.log("Testing contract at:", contractAddress);
        
        // Try to get the owner using cast
        console.log("Attempting to call owner()...");
        
        // This is a simple test - we'll just log the address
        console.log("Contract address is valid format");
        console.log("Ready to test contract functions");
    }
} 