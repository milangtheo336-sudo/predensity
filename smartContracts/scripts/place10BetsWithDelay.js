const { ethers, network } = require("hardhat");

// Bet data structure
const BetData = {
    dayOffset: 0,
    priceMin: 0,
    priceMax: 0,
    stakeAmount: ethers.utils.parseEther("0")
};

// Helper function to create bet data
function createBetData(dayOffset, priceMin, priceMax, stakeAmount) {
    return {
        dayOffset,
        priceMin,
        priceMax,
        stakeAmount: ethers.utils.parseEther(stakeAmount.toString())
    };
}

// Helper function to sleep/delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = async () => {
    const [deployer] = await ethers.getSigners();
    const deployerAddress = deployer.address;
    
    // Get the deployed contract address from environment or use a default
    const marketAddress = process.env.MAINNET_MARKET_ADDRESS_V2 || process.env.DEPLOYED_CONTRACT_ADDRESS;
    
    if (!marketAddress) {
        throw new Error("Market address not found in environment variables. Please set MAINNET_MARKET_ADDRESS_V2 or DEPLOYED_CONTRACT_ADDRESS");
    }
    
    console.log("Deployer address:", deployerAddress);
    console.log("Using market at:", marketAddress);
    
    // Get the contract instance
    const PredensityPredictionMarket = await ethers.getContractFactory("PredensityPredictionMarket");
    const market = PredensityPredictionMarket.attach(marketAddress);
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    console.log("Current timestamp:", currentTimestamp);
    
    // Define 10 bets with varying parameters (same as the Foundry script)
    const bets = [
        // Bet 1: Day 1, 2100-2550 BPS
        createBetData(1, 2100, 2550, 0.001),
        
        // Bet 2: Day 1, 2320-2820 BPS
        createBetData(1, 2320, 2820, 0.0015),
        
        // Bet 3: Day 1, 2000-2600 BPS
        createBetData(1, 2000, 2600, 0.002),
        
        // Bet 4: Day 2, 2650-3150 BPS
        createBetData(2, 2650, 3150, 0.0025),
        
        // Bet 5: Day 2, 2450-2930 BPS
        createBetData(2, 2450, 2930, 0.003),
        
        // Bet 6: Day 2, 2200-2650 BPS
        createBetData(2, 2200, 2650, 0.0012),
        
        // Bet 7: Day 3, 2050-2800 BPS
        createBetData(3, 2050, 2800, 0.0018),
        
        // Bet 8: Day 3, 2750-3450 BPS
        createBetData(3, 2750, 3450, 0.0022),
        
        // Bet 9: Day 3, 2900-3500 BPS
        createBetData(3, 2900, 3500, 0.0028),
        
        // Bet 10: Day 2, 2200-3200 BPS
        createBetData(2, 2200, 3200, 0.0017)
    ];
    
    console.log("=== Placing 10 Bets with Delays ===");
    
    // Get contract constants
    const MIN_DAYS_AHEAD = await market.MIN_DAYS_AHEAD();
    const SECONDS_PER_DAY = await market.SECONDS_PER_DAY();
    
    for (let i = 0; i < bets.length; i++) {
        const bet = bets[i];
        
        // Calculate target timestamp starting from current time
        // Add MIN_DAYS_AHEAD + dayOffset to ensure it's at least 1 day ahead
        const targetTimestamp = currentTimestamp + ((MIN_DAYS_AHEAD + bet.dayOffset) * SECONDS_PER_DAY);
        
        console.log(`--- Bet ${i + 1} ---`);
        console.log("Day offset:", bet.dayOffset);
        console.log("Target timestamp:", targetTimestamp);
        console.log("Price range:", bet.priceMin, "-", bet.priceMax, "BPS");
        console.log("Stake amount:", ethers.utils.formatEther(bet.stakeAmount), "ETH");
        
        try {
            // Place the bet
            const tx = await market.placeBet(
                targetTimestamp,
                bet.priceMin,
                bet.priceMax,
                { value: bet.stakeAmount }
            );
            
            console.log("Transaction hash:", tx.hash);
            console.log("Waiting for transaction confirmation...");
            
            // Wait for transaction to be mined
            const receipt = await tx.wait();
            console.log("Bet placed successfully! Gas used:", receipt.gasUsed.toString());
            console.log("");
            
            // Add delay between transactions (only if not the last bet)
            if (i < bets.length - 1) {
                console.log("Waiting 3 seconds before next bet...");
                await sleep(3000); // 3 second delay
            }
            
        } catch (error) {
            console.error(`Error placing bet ${i + 1}:`, error.message);
            throw error;
        }
    }
    
    // Get final stats
    const stats = await market.getStats();
    console.log("=== All 10 bets placed successfully! ===");
    console.log("Total bets in contract:", stats.totalBets.toString());
    console.log("Total fees collected:", ethers.utils.formatEther(stats.totalFees), "ETH");
    console.log("Contract balance:", ethers.utils.formatEther(stats.contractBalance), "ETH");
    
    return {
        totalBets: stats.totalBets.toString(),
        totalFees: ethers.utils.formatEther(stats.totalFees),
        contractBalance: ethers.utils.formatEther(stats.contractBalance)
    };
}; 