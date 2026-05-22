// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TestPredensityPredictionMarket {
    uint256 public immutable startTimestamp;
    uint256 public constant SECONDS_PER_DAY = 24 * 60 * 60;
    uint256 public constant FEE_BPS = 50;        // 0.5% fee in basis points
    uint256 public constant BPS_DENOM = 10000;   // denominator for basis points (100% = 10000)
    uint256 public constant FIXED_PRICE = 3000;  // Fixed current price = $0.30 → 3000 BPS

    struct Bet {
        address bettor;
        uint256 targetTimestamp;
        uint256 priceMin;
        uint256 priceMax;
        uint256 stake;
        uint256 qualityBps;
        uint256 weight;
        bool finalized;
        bool claimed;
    }

    mapping(uint256 => Bet) public bets;
    uint256 public nextBetId;

    // Per‑day bucket aggregates
    mapping(uint256 => uint256) public totalStakedInBucket;
    mapping(uint256 => uint256) public totalWeightInBucket;

    /// @notice Struct to hold detailed bet simulation results
    struct BetSimulation {
        // Raw values (in wei/BPS)
        uint256 fee;
        uint256 stakeNet;
        uint256 sharpnessBps;
        uint256 timeBps;
        uint256 qualityBps;
        uint256 weight;
        uint256 bucket;
        bool isValid;
        string errorMessage;
        
        // Human-readable values (in microdollars for prices, micro-multipliers for multipliers)
        uint256 priceMinDollars;      // $0.2500 = 250000
        uint256 priceMaxDollars;      // $0.3500 = 350000
        uint256 rangeDollars;         // $0.1000 = 100000
        uint256 widthPercentage;      // 3333 = 33.33%
        uint256 sharpnessMultiplier;  // 300000 = 0.3000×
        uint256 timeMultiplier;       // 1000000 = 1.0000×
        uint256 qualityMultiplier;    // 300000 = 0.3000×
        uint256 feePercentage;        // 50 = 0.50%
        uint256 daysFromNow;          // 1 = 1 day
    }

    event BetPlaced(
        uint256 indexed betId,
        address indexed bettor,
        uint256 bucket,
        uint256 stake,
        uint256 priceMin,
        uint256 priceMax,
        uint256 targetTimestamp
    );
    event FeeCollected(uint256 amount);

    constructor() {
        // Record contract deployment as the start of Day 0
        startTimestamp = block.timestamp;
    }

    /// @notice Helper function to create a bet and emit event to reduce stack usage
    function _createBet(
        address bettor,
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeNet,
        uint256 qualityBps,
        uint256 weight
    ) private returns (uint256) {
        uint256 betId = nextBetId++;
        uint256 bucket = bucketIndex(targetTimestamp);
        
        bets[betId] = Bet({
            bettor: bettor,
            targetTimestamp: targetTimestamp,
            priceMin: priceMin,
            priceMax: priceMax,
            stake: stakeNet,
            qualityBps: qualityBps,
            weight: weight,
            finalized: false,
            claimed: false
        });

        totalStakedInBucket[bucket] += stakeNet;
        totalWeightInBucket[bucket] += weight;

        emit BetPlaced(betId, bettor, bucket, stakeNet, priceMin, priceMax, targetTimestamp);
        return betId;
    }

    /// @notice Map a future timestamp to a 24 h bucket since startTimestamp
    function bucketIndex(uint256 targetTs) public view returns (uint256) {
        require(targetTs >= startTimestamp, "must be >= start");
        return (targetTs - startTimestamp) / SECONDS_PER_DAY;
    }

    /// @notice Place a bet into the pool corresponding to your chosen day
    function placeBet(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax
    ) external payable returns (uint256) {
        require(targetTimestamp > block.timestamp, "must be future timestamp");
        require(priceMin < priceMax, "invalid price range");
        require(msg.value > 0, "stake must be > 0");

        // Calculate fee and net stake
        uint256 stakeNet = msg.value - ((msg.value * FEE_BPS) / BPS_DENOM);
        emit FeeCollected((msg.value * FEE_BPS) / BPS_DENOM);

        // Compute bet quality and weight in one step
        uint256 qualityBps = (getSharpnessMultiplier(priceMin, priceMax) * getTimeMultiplier(targetTimestamp)) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        // Create bet using helper function
        return _createBet(msg.sender, targetTimestamp, priceMin, priceMax, stakeNet, qualityBps, weight);
    }

    /// @notice Compute the sharpness multiplier (in BPS) based on the price range width,
    /// using a fixed current price of $0.30
    function getSharpnessMultiplier(
        uint256 priceMin,
        uint256 priceMax
    ) public pure returns (uint256) {
        uint256 range = priceMax - priceMin;
        // width in basis points of FIXED_PRICE: (range / FIXED_PRICE) * 10000
        uint256 widthBps = (range * BPS_DENOM) / FIXED_PRICE;

        if (widthBps > 4000) {
            return 1000;  // 0.1×
        } else if (widthBps >= 2000) {
            return 3000;  // 0.3×
        } else if (widthBps >= 1000) {
            return 5000;  // 0.5×
        } else if (widthBps >= 500) {
            return 10000; // 1×
        } else if (widthBps >= 200) {
            return 15000; // 1.5×
        } else {
            return 20000; // 2× for very sharp (<2%)
        }
    }

    /// @notice Compute the lead‑time multiplier (in BPS) based on how far ahead the target is
    function getTimeMultiplier(
        uint256 targetTimestamp
    ) public view returns (uint256) {
        uint256 delta = targetTimestamp - block.timestamp;

        if (delta >= 4 * SECONDS_PER_DAY) {
            return 20000; // >4 days → 2×
        } else if (delta >= 2 * SECONDS_PER_DAY) {
            return 15000; // 2–4 days → 1.5×
        } else if (delta >= 1 * SECONDS_PER_DAY) {
            return 10000; // 1–2 days → 1×
        } else if (delta >= 8 * 60 * 60) {
            return 5000;  // 8–24 h → 0.5×
        } else if (delta >= 2 * 60 * 60) {
            return 3000;  // 2–4 h → 0.3×
        } else if (delta >= 1 * 60 * 60) {
            return 1000;  // 1–2 h → 0.1×
        } else {
            return 1000;  // < 1 h → 0.1×
        }
    }

    /// @notice View function to calculate quality for testing outside of placeBet
    function getQuality(
        uint256 priceMin,
        uint256 priceMax,
        uint256 targetTimestamp
    ) external view returns (uint256) {
        uint256 sharpBps = getSharpnessMultiplier(priceMin, priceMax);
        uint256 timeBps  = getTimeMultiplier(targetTimestamp);
        return (sharpBps * timeBps) / BPS_DENOM;
    }

    /// @notice View function to calculate weight for testing outside of placeBet
    function getWeight(
        uint256 stake,
        uint256 qualityBps
    ) external pure returns (uint256) {
        return (stake * qualityBps) / BPS_DENOM;
    }

    /// @notice Simulate placeBet and return all details for frontend validation
    /// @param targetTimestamp The target timestamp for the prediction
    /// @param priceMin Minimum price in BPS
    /// @param priceMax Maximum price in BPS  
    /// @param stakeAmount The amount to stake (replaces payable)
    /// @return fee The protocol fee that will be deducted
    /// @return stakeNet The net stake after fee deduction
    /// @return sharpnessBps The sharpness multiplier in BPS
    /// @return timeBps The time multiplier in BPS
    /// @return qualityBps The combined quality multiplier in BPS
    /// @return weight The calculated weight for this bet
    /// @return bucket The bucket index this bet will be placed in
    /// @return isValid Whether this bet would be valid (future timestamp, valid range, positive stake)
    /// @return errorMessage Error message if bet is invalid
    function simulatePlaceBet(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeAmount
    ) external view returns (
        uint256 fee,
        uint256 stakeNet,
        uint256 sharpnessBps,
        uint256 timeBps,
        uint256 qualityBps,
        uint256 weight,
        uint256 bucket,
        bool isValid,
        string memory errorMessage
    ) {
        // Validate inputs
        if (targetTimestamp <= block.timestamp) {
            return (0, 0, 0, 0, 0, 0, 0, false, "must be future timestamp");
        }
        
        if (priceMin >= priceMax) {
            return (0, 0, 0, 0, 0, 0, 0, false, "invalid price range");
        }
        
        if (stakeAmount == 0) {
            return (0, 0, 0, 0, 0, 0, 0, false, "stake must be > 0");
        }

        // Calculate fee and net stake
        fee = (stakeAmount * FEE_BPS) / BPS_DENOM;
        stakeNet = stakeAmount - fee;

        // Calculate multipliers
        sharpnessBps = getSharpnessMultiplier(priceMin, priceMax);
        timeBps = getTimeMultiplier(targetTimestamp);
        qualityBps = (sharpnessBps * timeBps) / BPS_DENOM;

        // Calculate weight
        weight = (stakeNet * qualityBps) / BPS_DENOM;

        // Calculate bucket
        bucket = bucketIndex(targetTimestamp);
        

        return (fee, stakeNet, sharpnessBps, timeBps, qualityBps, weight, bucket, true, "");
    }

    /// @notice Place a bet without requiring ETH - for Graph indexing and testing
    /// @param targetTimestamp The target timestamp for the prediction
    /// @param priceMin Minimum price in BPS
    /// @param priceMax Maximum price in BPS
    /// @param stakeAmount The amount to stake (in wei)
    /// @return betId The ID of the placed bet
    function placeBetWithoutValue(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeAmount
    ) external returns (uint256) {
        require(targetTimestamp > block.timestamp, "must be future timestamp");
        require(priceMin < priceMax, "invalid price range");
        require(stakeAmount > 0, "stake must be > 0");

        // Calculate fee and net stake
        uint256 stakeNet = stakeAmount - ((stakeAmount * FEE_BPS) / BPS_DENOM);

        // Compute bet quality and weight in one step
        uint256 qualityBps = (getSharpnessMultiplier(priceMin, priceMax) * getTimeMultiplier(targetTimestamp)) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        // Create bet using helper function
        return _createBet(msg.sender, targetTimestamp, priceMin, priceMax, stakeNet, qualityBps, weight);
    }

    /// @notice Get detailed breakdown of a bet simulation with human-readable values
    /// @param targetTimestamp The target timestamp for the prediction
    /// @param priceMin Minimum price in BPS
    /// @param priceMax Maximum price in BPS  
    /// @param stakeAmount The amount to stake
    /// @return simulation A struct containing all simulation details
    function getBetSimulation(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeAmount
    ) external view returns (BetSimulation memory simulation) {
        // Validate inputs
        if (targetTimestamp <= block.timestamp) {
            simulation = BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "must be future timestamp",
                priceMinDollars: 0, priceMaxDollars: 0, rangeDollars: 0, widthPercentage: 0,
                sharpnessMultiplier: 0, timeMultiplier: 0, qualityMultiplier: 0, feePercentage: 0, daysFromNow: 0
            });
            return simulation;
        }
        
        if (priceMin >= priceMax) {
            simulation = BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "invalid price range",
                priceMinDollars: 0, priceMaxDollars: 0, rangeDollars: 0, widthPercentage: 0,
                sharpnessMultiplier: 0, timeMultiplier: 0, qualityMultiplier: 0, feePercentage: 0, daysFromNow: 0
            });
            return simulation;
        }
        
        if (stakeAmount == 0) {
            simulation = BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "stake must be > 0",
                priceMinDollars: 0, priceMaxDollars: 0, rangeDollars: 0, widthPercentage: 0,
                sharpnessMultiplier: 0, timeMultiplier: 0, qualityMultiplier: 0, feePercentage: 0, daysFromNow: 0
            });
            return simulation;
        }

        // Calculate fee and net stake
        uint256 fee = (stakeAmount * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = stakeAmount - fee;

        // Calculate multipliers
        uint256 sharpnessBps = getSharpnessMultiplier(priceMin, priceMax);
        uint256 timeBps = getTimeMultiplier(targetTimestamp);
        uint256 qualityBps = (sharpnessBps * timeBps) / BPS_DENOM;

        // Calculate weight
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        // Calculate bucket
        uint256 bucket = bucketIndex(targetTimestamp);

        simulation = BetSimulation({
            // Raw values
            fee: fee,
            stakeNet: stakeNet,
            sharpnessBps: sharpnessBps,
            timeBps: timeBps,
            qualityBps: qualityBps,
            weight: weight,
            bucket: bucket,
            isValid: true,
            errorMessage: "",
            
            // Human-readable values
            priceMinDollars: priceMin, // Raw BPS value
            priceMaxDollars: priceMax, // Raw BPS value  
            rangeDollars: priceMax - priceMin, // Raw BPS range
            widthPercentage: ((priceMax - priceMin) * 10000) / FIXED_PRICE,
            sharpnessMultiplier: sharpnessBps, // Raw BPS value
            timeMultiplier: timeBps, // Raw BPS value
            qualityMultiplier: qualityBps, // Raw BPS value
            feePercentage: (fee * 10000) / stakeAmount,
            daysFromNow: (targetTimestamp - block.timestamp) / SECONDS_PER_DAY
        });
    }
}


