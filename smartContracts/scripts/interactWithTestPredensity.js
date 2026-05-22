/*-
 *
 * Hedera Hardhat Example Project
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const { ethers } = require("hardhat");

module.exports = async (contractAddress) => {
  // Assign the first signer
  let wallet = (await ethers.getSigners())[0];

  console.log("🔗 Connecting to TestPredensityPredictionMarket contract...");
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`👤 User Address: ${wallet.address}`);

  // Get contract instance
  const TestPredensityPredictionMarket = await ethers.getContractFactory(
    "TestPredensityPredictionMarket",
  );
  const contract = TestPredensityPredictionMarket.attach(contractAddress);

  // Get current contract state
  const startTimestamp = await contract.startTimestamp();
  const nextBetId = await contract.nextBetId();
  const currentTime = Math.floor(Date.now() / 1000);

  console.log("\n📊 Contract State:");
  console.log(`📅 Start Timestamp: ${startTimestamp}`);
  console.log(`🆔 Next Bet ID: ${nextBetId}`);
  console.log(`⏰ Current Time: ${currentTime}`);

  // Calculate future timestamp for betting (1 day from now)
  const futureTimestamp = currentTime + 86400; // 24 hours
  const bucket = await contract.bucketIndex(futureTimestamp);

  console.log(`🎯 Target Timestamp: ${futureTimestamp}`);
  console.log(`🪣 Bucket Index: ${bucket}`);

  // Place a test bet
  const betAmount = ethers.utils.parseEther("0.1"); // 0.1 ETH
  const priceMin = 100;
  const priceMax = 200;

  console.log("\n🎲 Placing test bet...");
  console.log(`💰 Bet Amount: ${ethers.utils.formatEther(betAmount)} ETH`);
  console.log(`📈 Price Range: ${priceMin} - ${priceMax}`);

  try {
    const tx = await contract
      .connect(wallet)
      .placeBet(futureTimestamp, priceMin, priceMax, { value: betAmount });

    const receipt = await tx.wait();
    console.log("✅ Bet placed successfully!");
    console.log(`🔗 Transaction Hash: ${tx.hash}`);

    // Get bet details
    const bet = await contract.bets(0);
    console.log("\n📋 Bet Details:");
    console.log(`👤 Bettor: ${bet.bettor}`);
    console.log(`📅 Target Timestamp: ${bet.targetTimestamp}`);
    console.log(`📈 Price Range: ${bet.priceMin} - ${bet.priceMax}`);
    console.log(`💰 Stake: ${ethers.utils.formatEther(bet.stake)} ETH`);
    console.log(`⭐ Quality BPS: ${bet.qualityBps}`);
    console.log(`⚖️ Weight: ${bet.weight}`);
    console.log(`✅ Finalized: ${bet.finalized}`);
    console.log(`💸 Claimed: ${bet.claimed}`);

    // Get bucket totals
    const totalStaked = await contract.totalStakedInBucket(bucket);
    const totalWeight = await contract.totalWeightInBucket(bucket);

    console.log("\n🪣 Bucket Totals:");
    console.log(
      `💰 Total Staked: ${ethers.utils.formatEther(totalStaked)} ETH`,
    );
    console.log(`⚖️ Total Weight: ${totalWeight}`);

    // Simulate another bet
    console.log("\n🎲 Placing second bet...");
    const betAmount2 = ethers.utils.parseEther("0.05"); // 0.05 ETH
    const priceMin2 = 150;
    const priceMax2 = 250;

    const tx2 = await contract.connect(wallet).placeBet(
      futureTimestamp + 3600, // 1 hour later
      priceMin2,
      priceMax2,
      { value: betAmount2 },
    );

    await tx2.wait();
    console.log("✅ Second bet placed successfully!");

    // Updated bucket totals
    const totalStaked2 = await contract.totalStakedInBucket(bucket);
    const totalWeight2 = await contract.totalWeightInBucket(bucket);
    const nextBetId2 = await contract.nextBetId();

    console.log("\n🪣 Updated Bucket Totals:");
    console.log(
      `💰 Total Staked: ${ethers.utils.formatEther(totalStaked2)} ETH`,
    );
    console.log(`⚖️ Total Weight: ${totalWeight2}`);
    console.log(`🆔 Next Bet ID: ${nextBetId2}`);
  } catch (error) {
    console.error("❌ Error placing bet:", error.message);
  }

  return contractAddress;
};
