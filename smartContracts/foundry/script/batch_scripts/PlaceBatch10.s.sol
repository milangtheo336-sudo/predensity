// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch10Script is Script {
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
        
        // Define the 10 bets from mock data (bets 91-100)
        BetData[] memory bets = new BetData[](10);
        
        // Bet 1: 1754870534, 0.000731 ETH, 2679-2725 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2679,
            priceMax: 2725,
            stakeAmount: 0.000731 ether
        });
        
        // Bet 2: 1754871380, 0.030864 ETH, 2598-2772 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2598,
            priceMax: 2772,
            stakeAmount: 0.030864 ether
        });
        
        // Bet 3: 1754873180, 0.03342 ETH, 2711-2742 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2711,
            priceMax: 2742,
            stakeAmount: 0.03342 ether
        });
        
        // Bet 4: 1754885138, 0.001911 ETH, 2531-2721 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2531,
            priceMax: 2721,
            stakeAmount: 0.001911 ether
        });
        
        // Bet 5: 1754886698, 0.097596 ETH, 2650-2709 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 2650,
            priceMax: 2709,
            stakeAmount: 0.097596 ether
        });
        
        // Bet 6: 1754889480, 0.309358 ETH, 1742-2017 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 1742,
            priceMax: 2017,
            stakeAmount: 0.309358 ether
        });
        
        // Bet 7: 1754894847, 0.01026 ETH, 2616-2707 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2616,
            priceMax: 2707,
            stakeAmount: 0.01026 ether
        });
        
        // Bet 8: 1754908801, 0.083008 ETH, 2672-2854 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2672,
            priceMax: 2854,
            stakeAmount: 0.083008 ether
        });
        
        // Bet 9: 1754912101, 0.001912 ETH, 2634-2723 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2634,
            priceMax: 2723,
            stakeAmount: 0.001912 ether
        });
        
        // Bet 10: 1754939706, 0.032148 ETH, 2655-2723 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2655,
            priceMax: 2723,
            stakeAmount: 0.032148 ether
        });
        
        console.log("=== Placing Batch 10 (10 Bets) ===");
        
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
