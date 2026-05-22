// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract TestV3ContractScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        address marketAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V3");
        
        console.log("Deployer address:", deployerAddress);
        console.log("Testing V3 contract at:", marketAddress);
        
        PredensityPredictionMarket market = PredensityPredictionMarket(marketAddress);
        
        // Test basic contract functions
        console.log("Owner:", market.owner());
        console.log("Start timestamp:", market.startTimestamp());
        console.log("MIN_DAYS_AHEAD:", market.MIN_DAYS_AHEAD());
        console.log("MAX_DAYS_AHEAD:", market.MAX_DAYS_AHEAD());
        console.log("MIN_STAKE:", market.MIN_STAKE());
        console.log("MAX_STAKE:", market.MAX_STAKE());
        
        // Test current stats
        (uint256 totalBets, uint256 totalFees, uint256 contractBalance) = market.getStats();
        console.log("Total bets:", totalBets);
        console.log("Total fees:", totalFees);
        console.log("Contract balance:", contractBalance);
        
        console.log("=== V3 Contract Test Successful ===");
    }
} 