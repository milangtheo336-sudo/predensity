const { ethers, network } = require("hardhat");

module.exports = async () => {
    console.log("=== DEBUGGING SCRIPT START ===");
    console.log("Network:", network.name);
    
    try {
        // Check environment variables
        const marketAddress = process.env.MAINNET_MARKET_ADDRESS_V2 || process.env.DEPLOYED_CONTRACT_ADDRESS;
        console.log("Market address from env:", marketAddress);
        
        if (!marketAddress) {
            throw new Error("Market address not found in environment variables");
        }
        
        // Get signers
        const [deployer] = await ethers.getSigners();
        console.log("Deployer address:", deployer.address);
        console.log("Deployer balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
        
        // Check if we can connect to the contract
        console.log("Attempting to connect to contract...");
        const PredensityPredictionMarket = await ethers.getContractFactory("PredensityPredictionMarket");
        const market = PredensityPredictionMarket.attach(marketAddress);
        
        // Test basic contract calls
        console.log("Testing contract connection...");
        const totalBets = await market.getStats();
        console.log("Contract stats:", totalBets);
        
        // Get contract constants
        console.log("Getting contract constants...");
        const MIN_DAYS_AHEAD = await market.MIN_DAYS_AHEAD();
        const SECONDS_PER_DAY = await market.SECONDS_PER_DAY();
        console.log("MIN_DAYS_AHEAD:", MIN_DAYS_AHEAD.toString());
        console.log("SECONDS_PER_DAY:", SECONDS_PER_DAY.toString());
        
        // Test a simple bet simulation
        console.log("Testing bet simulation...");
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const targetTimestamp = currentTimestamp + ((MIN_DAYS_AHEAD + 1) * SECONDS_PER_DAY);
        
        console.log("Current timestamp:", currentTimestamp);
        console.log("Target timestamp:", targetTimestamp);
        
        const simulation = await market.simulatePlaceBet(
            targetTimestamp,
            2100, // priceMin
            2550, // priceMax
            ethers.utils.parseEther("0.001") // stakeAmount
        );
        
        console.log("Bet simulation result:", simulation);
        
        console.log("=== DEBUGGING COMPLETE ===");
        
    } catch (error) {
        console.error("ERROR:", error.message);
        console.error("Full error:", error);
        throw error;
    }
}; 