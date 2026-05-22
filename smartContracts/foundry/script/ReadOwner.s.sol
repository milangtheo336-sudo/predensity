// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

contract ReadOwnerScript is Script {
    function run() external {
        // The contract address to check
        address contractAddress = 0xb1be22eAD5086cb8409Bb81d0f63aaE36a977798;
        
        console.log("=== Reading Contract Owner ===");
        console.log("Contract address:", contractAddress);
        
        // Create contract instance
        PredensityPredictionMarket market = PredensityPredictionMarket(contractAddress);
        
        // Read the owner
        try market.owner() returns (address owner) {
            console.log("Owner:", owner);
        } catch Error(string memory reason) {
            console.log("Error reading owner:", reason);
        } catch (bytes memory) {
            console.log("Error reading owner: Unknown error");
        }
        
        // Also try to read other basic contract state
        console.log("\n=== Contract State ===");
        try market.startTimestamp() returns (uint256 timestamp) {
            console.log("Start timestamp:", timestamp);
        } catch {
            console.log("Could not read start timestamp");
        }
        
        try market.totalFeesCollected() returns (uint256 fees) {
            console.log("Total fees collected:", fees);
        } catch {
            console.log("Could not read total fees");
        }
        
        try market.nextBetId() returns (uint256 nextId) {
            console.log("Next bet ID:", nextId);
        } catch {
            console.log("Could not read next bet ID");
        }
        
        console.log("Contract balance:", address(market).balance);
    }
} 