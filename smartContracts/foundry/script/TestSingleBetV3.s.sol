// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract TestSingleBetV3Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        address marketAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V3");
        
        console.log("Deployer address:", deployerAddress);
        console.log("Testing V3 contract at:", marketAddress);
        
        PredensityPredictionMarket market = PredensityPredictionMarket(marketAddress);
        uint256 currentTimestamp = block.timestamp;
        console.log("Current timestamp:", currentTimestamp);
        
        // Calculate target timestamp (2 days from now)
        uint256 targetTimestamp = currentTimestamp + ((market.MIN_DAYS_AHEAD() + 1) * market.SECONDS_PER_DAY());
        console.log("Target timestamp:", targetTimestamp);
        
        console.log("=== Placing Single Bet on V3 ===");
        console.log("Price range: 2100 - 2550 BPS");
        console.log("Stake amount: 0.001 ETH");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Place a single bet
        uint256 betId = market.placeBet{value: 0.001 ether}(
            targetTimestamp,
            2100,
            2550
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