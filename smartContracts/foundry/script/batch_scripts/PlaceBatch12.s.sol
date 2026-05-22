// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch12Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        
        address marketAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V4");
        console.log("Using market at:", marketAddress);
        
        PredensityPredictionMarket market = PredensityPredictionMarket(marketAddress);
        
        // Get current timestamp
        uint256 currentTimestamp = block.timestamp;
        console.log("Current timestamp:", currentTimestamp);
        
        // Define the 10 bets from mock data (bets 111-120)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1755062913, 0.087792 ETH, 2725-2765 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2725,
            priceMax: 2765,
            stakeAmount: 0.087792 ether
        });
        
        // Bet 2: 1755064233, 0.093522 ETH, 2763-2883 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2763,
            priceMax: 2883,
            stakeAmount: 0.093522 ether
        });
        
        // Bet 3: 1755066729, 0.050127 ETH, 2725-2859 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2725,
            priceMax: 2859,
            stakeAmount: 0.050127 ether
        });
        
        // Bet 4: 1755068049, 0.005816 ETH, 2702-2802 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2702,
            priceMax: 2802,
            stakeAmount: 0.005816 ether
        });
        
        // Bet 5: 1755080612, 0.018326 ETH, 2637-2698 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2637,
            priceMax: 2698,
            stakeAmount: 0.018326 ether
        });
        
        // Bet 6: 1755081512, 0.007572 ETH, 2642-2806 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2642,
            priceMax: 2806,
            stakeAmount: 0.007572 ether
        });
        
        // Bet 7: 1755106161, 0.068224 ETH, 2854-2914 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2854,
            priceMax: 2914,
            stakeAmount: 0.068224 ether
        });
        
        // Bet 8: 1755114164, 0.00594 ETH, 2718-2866 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2718,
            priceMax: 2866,
            stakeAmount: 0.00594 ether
        });
        
        // Bet 9: 1755116444, 0.307632 ETH, 2774-2844 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2774,
            priceMax: 2844,
            stakeAmount: 0.307632 ether
        });
        
        // Bet 10: 1755120109, 0.07379 ETH, 2751-2780 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2751,
            priceMax: 2780,
            stakeAmount: 0.07379 ether
        });
        
        console.log("=== Placing Batch 12 (10 Bets) ===");
        
        // Prepare arrays for batch placement
        uint256[] memory targetTimestamps = new uint256[](bets.length);
        uint256[] memory priceMins = new uint256[](bets.length);
        uint256[] memory priceMaxs = new uint256[](bets.length);
        uint256[] memory stakeAmounts = new uint256[](bets.length);
        uint256 totalValue = 0;
        
        // Calculate total value and prepare arrays
        for (uint256 i = 0; i < bets.length; i++) {
            BetData memory bet = bets[i];
            
            // Calculate target timestamp starting from current time
            // Add MIN_DAYS_AHEAD + dayOffset to ensure it's at least 1 day ahead
            uint256 targetTimestamp = currentTimestamp + ((market.MIN_DAYS_AHEAD() + bet.dayOffset) * market.SECONDS_PER_DAY());
            
            targetTimestamps[i] = targetTimestamp;
            priceMins[i] = bet.priceMin;
            priceMaxs[i] = bet.priceMax;
            stakeAmounts[i] = bet.stakeAmount;
            totalValue += bet.stakeAmount;
            
            console.log("--- Bet");
            console.log(i + 1);
            console.log("---");
            console.log("Day offset:", bet.dayOffset);
            console.log("Target timestamp:", targetTimestamp);
            console.log("Price range:");
            console.log(bet.priceMin);
            console.log("-");
            console.log(bet.priceMax);
            console.log("BPS");
            console.log("Stake amount:", bet.stakeAmount);
        }
        
        console.log("Total value to send:", totalValue);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Place all bets in a single batch transaction
        uint256[] memory betIds = market.placeBatchBets{value: totalValue}(
            targetTimestamps,
            priceMins,
            priceMaxs,
            stakeAmounts
        );
        
        console.log("All bets placed with IDs:");
        for (uint256 i = 0; i < betIds.length; i++) {
            console.log("Bet", i + 1, "ID:", betIds[i]);
        }
        
        vm.stopBroadcast();
        
        console.log("=== All 10 bets placed successfully! ===");
        
        // Get final stats
        (uint256 totalBets, uint256 totalFees, uint256 contractBalance) = market.getStats();
        console.log("Total bets in contract:", totalBets);
        console.log("Total fees collected:", totalFees);
        console.log("Contract balance:", contractBalance);
    }
    
    struct BetData {
        uint256 dayOffset;
        uint256 priceMin;
        uint256 priceMax;
        uint256 stakeAmount;
    }
}
