// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {PredensityPredictionMarket} from "../../src/PredensityPredictionMarket.sol";

contract PlaceBatch9to13Script is Script {
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
        
        // Define the 50 bets from mock data (bets 81-130)
        BetData[] memory bets = new BetData[](50);
        
        // Bet 1: 1754829199, 0.0033 ETH, 2600-2693 BPS
        bets[0] = BetData({
            dayOffset: 2,
            priceMin: 2600,
            priceMax: 2693,
            stakeAmount: 0.0033 ether
        });
        
        // Bet 2: 1754830107, 0.004122 ETH, 2549-2731 BPS
        bets[1] = BetData({
            dayOffset: 2,
            priceMin: 2549,
            priceMax: 2731,
            stakeAmount: 0.004122 ether
        });
        
        // Bet 3: 1754831787, 0.2607 ETH, 2620-2811 BPS
        bets[2] = BetData({
            dayOffset: 2,
            priceMin: 2620,
            priceMax: 2811,
            stakeAmount: 0.2607 ether
        });
        
        // Bet 4: 1754830000, 0.28 ETH, 2889-3054 BPS
        bets[3] = BetData({
            dayOffset: 2,
            priceMin: 2889,
            priceMax: 3054,
            stakeAmount: 0.28 ether
        });
        
        // Bet 5: 1754833380, 0.10574 ETH, 1636-1868 BPS
        bets[4] = BetData({
            dayOffset: 2,
            priceMin: 1636,
            priceMax: 1868,
            stakeAmount: 0.10574 ether
        });
        
        // Bet 6: 1754835153, 0.20524 ETH, 2547-2602 BPS
        bets[5] = BetData({
            dayOffset: 2,
            priceMin: 2547,
            priceMax: 2602,
            stakeAmount: 0.20524 ether
        });
        
        // Bet 7: 1754835993, 0.025539 ETH, 2564-2600 BPS
        bets[6] = BetData({
            dayOffset: 2,
            priceMin: 2564,
            priceMax: 2600,
            stakeAmount: 0.025539 ether
        });
        
        // Bet 8: 1754851722, 0.24412 ETH, 2612-2752 BPS
        bets[7] = BetData({
            dayOffset: 2,
            priceMin: 2612,
            priceMax: 2752,
            stakeAmount: 0.24412 ether
        });
        
        // Bet 9: 1754854602, 0.001718 ETH, 2662-2701 BPS
        bets[8] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 10: 1754870474, 0.010773 ETH, 2640-2691 BPS
        bets[9] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 11: 1754870874, 0.001718 ETH, 2662-2701 BPS
        bets[10] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 12: 1754871474, 0.010773 ETH, 2640-2691 BPS
        bets[11] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 13: 1754872074, 0.001718 ETH, 2662-2701 BPS
        bets[12] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 14: 1754872674, 0.010773 ETH, 2640-2691 BPS
        bets[13] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 15: 1754873274, 0.001718 ETH, 2662-2701 BPS
        bets[14] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 16: 1754873874, 0.010773 ETH, 2640-2691 BPS
        bets[15] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 17: 1754874474, 0.001718 ETH, 2662-2701 BPS
        bets[16] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 18: 1754875074, 0.010773 ETH, 2640-2691 BPS
        bets[17] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 19: 1754875674, 0.001718 ETH, 2662-2701 BPS
        bets[18] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 20: 1754876274, 0.010773 ETH, 2640-2691 BPS
        bets[19] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 21: 1754876874, 0.001718 ETH, 2662-2701 BPS
        bets[20] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 22: 1754877474, 0.010773 ETH, 2640-2691 BPS
        bets[21] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 23: 1754878074, 0.001718 ETH, 2662-2701 BPS
        bets[22] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 24: 1754878674, 0.010773 ETH, 2640-2691 BPS
        bets[23] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 25: 1754879274, 0.001718 ETH, 2662-2701 BPS
        bets[24] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 26: 1754879874, 0.010773 ETH, 2640-2691 BPS
        bets[25] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 27: 1754880474, 0.001718 ETH, 2662-2701 BPS
        bets[26] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 28: 1754881074, 0.010773 ETH, 2640-2691 BPS
        bets[27] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 29: 1754881674, 0.001718 ETH, 2662-2701 BPS
        bets[28] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 30: 1754882274, 0.010773 ETH, 2640-2691 BPS
        bets[29] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 31: 1754882874, 0.001718 ETH, 2662-2701 BPS
        bets[30] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 32: 1754883474, 0.010773 ETH, 2640-2691 BPS
        bets[31] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 33: 1754884074, 0.001718 ETH, 2662-2701 BPS
        bets[32] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 34: 1754884674, 0.010773 ETH, 2640-2691 BPS
        bets[33] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 35: 1754885274, 0.001718 ETH, 2662-2701 BPS
        bets[34] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 36: 1754885874, 0.010773 ETH, 2640-2691 BPS
        bets[35] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 37: 1754886474, 0.001718 ETH, 2662-2701 BPS
        bets[36] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 38: 1754887074, 0.010773 ETH, 2640-2691 BPS
        bets[37] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 39: 1754887674, 0.001718 ETH, 2662-2701 BPS
        bets[38] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 40: 1754888274, 0.010773 ETH, 2640-2691 BPS
        bets[39] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 41: 1754888874, 0.001718 ETH, 2662-2701 BPS
        bets[40] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 42: 1754889474, 0.010773 ETH, 2640-2691 BPS
        bets[41] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 43: 1754890074, 0.001718 ETH, 2662-2701 BPS
        bets[42] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 44: 1754890674, 0.010773 ETH, 2640-2691 BPS
        bets[43] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 45: 1754891274, 0.001718 ETH, 2662-2701 BPS
        bets[44] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 46: 1754891874, 0.010773 ETH, 2640-2691 BPS
        bets[45] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 47: 1754892474, 0.001718 ETH, 2662-2701 BPS
        bets[46] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 48: 1754893074, 0.010773 ETH, 2640-2691 BPS
        bets[47] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        // Bet 49: 1754893674, 0.001718 ETH, 2662-2701 BPS
        bets[48] = BetData({
            dayOffset: 2,
            priceMin: 2662,
            priceMax: 2701,
            stakeAmount: 0.001718 ether
        });
        
        // Bet 50: 1754894274, 0.010773 ETH, 2640-2691 BPS
        bets[49] = BetData({
            dayOffset: 2,
            priceMin: 2640,
            priceMax: 2691,
            stakeAmount: 0.010773 ether
        });
        
        console.log("=== Placing Batch 9-13 (50 Bets) ===");
        
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
        
        console.log("=== All 50 bets placed successfully! ===");
        
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