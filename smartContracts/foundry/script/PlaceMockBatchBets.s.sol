// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.0;

// import {Script} from "forge-std/Script.sol";
// import {PredensityPredictionMarket} from "../src/PredensityPredictionMarket.sol";

// contract PlaceMockBatchBetsScript is Script {
//     function run() external {
//         uint256 deployerPrivateKey = vm.envUint("MAINNET_PRIVATE_KEY");
//         address deployer = vm.addr(deployerPrivateKey);
//         address marketAddress = vm.envAddress("MAINNET_MARKET_ADDRESS_V3_FIXED");
        
//         PredensityPredictionMarket market = PredensityPredictionMarket(marketAddress);
        
//         // Valid bets from the JSON (filtered for future timestamps)
//         uint256[] memory targetTimestamps = new uint256[](10);
//         uint256[] memory priceMins = new uint256[](10);
//         uint256[] memory priceMaxs = new uint256[](10);
        
//         // Batch 1: 10 bets with future timestamps
//         // Bet 1: 1754892147 (valid future timestamp)
//         targetTimestamps[0] = 1754892147;
//         priceMins[0] = 2000; // 0.2 * 10000
//         priceMaxs[0] = 2500; // 0.25 * 10000
        
//         // Bet 2: 1754821566
//         targetTimestamps[1] = 1754821566;
//         priceMins[1] = 2646; // 0.2646 * 10000
//         priceMaxs[1] = 2808; // 0.2808 * 10000
        
//         // Bet 3: 1754821626
//         targetTimestamps[2] = 1754821626;
//         priceMins[2] = 2625; // 0.2625 * 10000
//         priceMaxs[2] = 2683; // 0.2683 * 10000
        
//         // Bet 4: 1754828779
//         targetTimestamps[3] = 1754828779;
//         priceMins[3] = 2555; // 0.2555 * 10000
//         priceMaxs[3] = 2628; // 0.2628 * 10000
        
//         // Bet 5: 1754829199
//         targetTimestamps[4] = 1754829199;
//         priceMins[4] = 2600; // 0.26 * 10000
//         priceMaxs[4] = 2693; // 0.2693 * 10000
        
//         // Bet 6: 1754830107
//         targetTimestamps[5] = 1754830107;
//         priceMins[5] = 2549; // 0.2549 * 10000
//         priceMaxs[5] = 2731; // 0.2731 * 10000
        
//         // Bet 7: 1754831787
//         targetTimestamps[6] = 1754831787;
//         priceMins[6] = 2620; // 0.262 * 10000
//         priceMaxs[6] = 2811; // 0.2811 * 10000
        
//         // Bet 8: 1754830000
//         targetTimestamps[7] = 1754830000;
//         priceMins[7] = 2889; // 0.2889 * 10000
//         priceMaxs[7] = 3054; // 0.3054 * 10000
        
//         // Bet 9: 1754833380
//         targetTimestamps[8] = 1754833380;
//         priceMins[8] = 1636; // 0.1636 * 10000
//         priceMaxs[8] = 1868; // 0.1868 * 10000
        
//         // Bet 10: 1754835153
//         targetTimestamps[9] = 1754835153;
//         priceMins[9] = 2547; // 0.2547 * 10000
//         priceMaxs[9] = 2603; // 0.2603 * 10000
        
//         // Calculate total stake (0.001 ETH per bet)
//         uint256 stakePerBet = 0.001 ether;
//         uint256 totalStake = stakePerBet * 10;
        
//         vm.startBroadcast(deployerPrivateKey);
        
//         // Place the batch bet
//         uint256[] memory betIds = market.placeBatchBets{value: totalStake}(
//             targetTimestamps,
//             priceMins,
//             priceMaxs
//         );
        
//         vm.stopBroadcast();
//     }
// } 