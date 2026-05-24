// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BasePredictionMarket
 * @dev Abstract base contract for all prediction market categories
 * @notice Implements core quality-based weighting system with continuous range predictions
 * 
 * Core Features:
 * - Continuous range predictions (not binary)
 * - Quality scoring: sharpness × lead time
 * - Bucket-based bet aggregation
 * - Batch processing for gas optimization
 * - Trusted admin multisig oracle (Phase 1)
 */
abstract contract BasePredictionMarket is Ownable {
    using SafeERC20 for IERC20;
    // ==============================================================
    // |                    Constants                               |
    // ==============================================================
    uint256 public immutable startTimestamp;
    uint256 public constant SECONDS_PER_DAY = 24 * 60 * 60;
    uint256 public constant FEE_BPS = 50;        // 0.5% entry fee in basis points
    uint256 public constant EXIT_FEE_BPS = 80;   // 0.8% exit fee in basis points
    uint256 public constant BPS_DENOM = 10000;   // denominator for basis points (100% = 10000)
    uint256 public constant MIN_STAKE = 0.01 ether;
    uint256 public constant MAX_STAKE = 100 ether;
    uint256 public constant MAX_DAYS_AHEAD = 30;
    uint256 public constant MIN_DAYS_AHEAD = 1;
    uint256 public constant BATCH_SIZE = 50;
    uint256 public constant REQUIRED_CONFIRMATIONS = 3; // Multisig requirement
    uint256 public constant MAX_EXIT_RATIO_BPS = 3000;  // max 30% of bucket pool can exit early
    uint256 public constant MIN_K = 10 ether;           // minimum liquidity parameter (10 HBAR)
    
    // Public getter for required confirmations
    uint256 public requiredConfirmations = REQUIRED_CONFIRMATIONS;

    // ==============================================================
    // |                    State Variables                         |
    // ==============================================================
    uint256 public totalFeesCollected;
    uint256 public totalObligations;  // HBAR reserved for unclaimed winning payouts
    uint256 public nextBetId;
    uint256 public knownTokenBalance;  // Track actual token balance to prevent fake deposits

    // Staking token: address(0) = native HBAR mode, otherwise ERC-20 (e.g., USDC)
    IERC20 public stakingToken;

    // Trusted oracle addresses (Phase 1: Multisig)
    mapping(address => bool) public trustedOracles;
    uint256 public oracleCount;

    // ==============================================================
    // |                    Structs                                 |
    // ==============================================================
    struct Bet {
        address bettor;
        uint256 targetTimestamp;
        uint256 rangeMin;  // Generic: price, percentage, score, valuation, etc.
        uint256 rangeMax;
        uint256 stake;
        uint256 qualityBps;
        uint256 weight;
        bool finalized;
        bool claimed;
        uint256 actualValue;  // Resolved value at target timestamp
        bool won;
        // DPM fields
        uint256 entryBandWeight;  // total weight in this bet's band when they entered
        bool exited;              // whether the bettor sold shares early
    }

    struct BetSimulation {
        uint256 fee;
        uint256 stakeNet;
        uint256 sharpnessBps;
        uint256 timeBps;
        uint256 qualityBps;
        uint256 weight;
        uint256 bucket;
        bool isValid;
        string errorMessage;
    }

    struct BucketInfo {
        uint256[] betIds;
        uint256 totalStaked;
        uint256 totalWeight;
        uint256 totalWinningWeight;
        uint256 nextProcessIndex;
        bool aggregationComplete;
        // DPM fields
        uint256 totalExited;  // total HBAR paid out via early exits
    }

    struct ValueSubmission {
        address oracle;
        uint256 value;
        uint256 timestamp;
    }

    // ==============================================================
    // |                    Mappings                               |
    // ==============================================================
    mapping(uint256 => Bet) public bets;
    mapping(uint256 => BucketInfo) public buckets;
    mapping(uint256 => uint256) public resolvedValues; // targetTimestamp => resolved value
    
    // DPM band cost tracking: bucket => bandIndex => total weight in that band
    mapping(uint256 => mapping(uint256 => uint256)) public bandWeights;
    
    // Oracle submissions: marketTimestamp => oracle => value
    mapping(uint256 => mapping(address => uint256)) public oracleSubmissions;
    mapping(uint256 => uint256) public submissionCount;
    mapping(uint256 => bool) public isResolved;

    // ==============================================================
    // |                    Events                                  |
    // ==============================================================
    event BetPlaced(
        uint256 indexed betId,
        address indexed bettor,
        uint256 bucket,
        uint256 stake,
        uint256 rangeMin,
        uint256 rangeMax,
        uint256 targetTimestamp
    );
    
    event BetFinalized(
        uint256 indexed betId,
        uint256 actualValue,
        bool won,
        uint256 payout
    );
    
    event BetClaimed(
        uint256 indexed betId,
        address indexed bettor,
        uint256 payout
    );
    
    event FeeCollected(uint256 amount);
    event BucketValueSet(uint256 indexed bucket, uint256 value);
    event BatchProcessed(uint256 indexed bucket, uint256 processedCount, uint256 winningWeight);
    event AggregationCompleted(uint256 indexed bucket, uint256 totalWinningWeight);
    
    // Oracle events
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event ValueSubmitted(uint256 indexed timestamp, address indexed oracle, uint256 value);
    event ValueResolved(uint256 indexed timestamp, uint256 value, uint256 confirmations);

    event SharesSold(
        uint256 indexed betId,
        address indexed bettor,
        uint256 exitPayout,
        uint256 exitFee
    );

    // ==============================================================
    // |                    Modifiers                               |
    // ==============================================================
    modifier validBetAmount(uint256 amount) {
        require(amount >= MIN_STAKE, "Bet too small");
        require(amount <= MAX_STAKE, "Bet too large");
        _;
    }

    modifier validTimeRange(uint256 targetTimestamp) {
        uint256 minTime = block.timestamp + (MIN_DAYS_AHEAD * SECONDS_PER_DAY);
        uint256 maxTime = block.timestamp + (MAX_DAYS_AHEAD * SECONDS_PER_DAY);
        require(targetTimestamp >= minTime, "Target too soon");
        require(targetTimestamp <= maxTime, "Target too far");
        _;
    }

    modifier onlyTrustedOracle() {
        require(trustedOracles[msg.sender], "Not a trusted oracle");
        _;
    }

    // ==============================================================
    // |                    Constructor                             |
    // ==============================================================
    constructor(address _stakingToken) {
        stakingToken = IERC20(_stakingToken);
        startTimestamp = block.timestamp;
        transferOwnership(msg.sender);
    }

    /**
     * @notice Returns true if the contract uses an ERC-20 token for stakes
     */
    function isTokenMode() public view returns (bool) {
        return address(stakingToken) != address(0);
    }

    // ==============================================================
    // |                    Core Functions                          |
    // ==============================================================

    /**
     * @notice Place a bet with continuous range prediction
     * @param targetTimestamp The target timestamp for the prediction
     * @param rangeMin Minimum value in the prediction range
     * @param rangeMax Maximum value in the prediction range
     * @return betId The ID of the placed bet
     */
    function placeBet(
        uint256 targetTimestamp,
        uint256 rangeMin,
        uint256 rangeMax
    ) public payable validTimeRange(targetTimestamp) returns (uint256) {
        require(rangeMin < rangeMax, "Invalid range");
        require(rangeMin > 0 && rangeMax > 0, "Values must be positive");
        require(targetTimestamp > block.timestamp, "Cannot bet on past");

        // Calculate fee and net stake
        uint256 fee = (msg.value * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = msg.value - fee;
        
        totalFeesCollected += fee;
        emit FeeCollected(fee);

        // Compute quality and weight
        uint256 qualityBps = (getSharpnessMultiplier(rangeMin, rangeMax) * getTimeMultiplier(targetTimestamp)) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        return _createBet(msg.sender, targetTimestamp, rangeMin, rangeMax, stakeNet, qualityBps, weight);
    }

    /**
     * @notice Process next batch of bets for a bucket
     * @param bucket The bucket index to process
     */
    function processBatch(uint256 bucket) external returns (uint256 processedCount, uint256 winningWeight) {
        BucketInfo storage bucketInfo = buckets[bucket];
        require(!bucketInfo.aggregationComplete, "Aggregation complete");
        
        uint256 startIndex = bucketInfo.nextProcessIndex;
        uint256 endIndex = startIndex + BATCH_SIZE;
        
        if (endIndex > bucketInfo.betIds.length) {
            endIndex = bucketInfo.betIds.length;
        }
        
        if (startIndex >= bucketInfo.betIds.length) {
            bucketInfo.aggregationComplete = true;
            totalObligations += bucketInfo.totalStaked - bucketInfo.totalExited;
            emit AggregationCompleted(bucket, bucketInfo.totalWinningWeight);
            return (0, 0);
        }
        
        uint256 batchWinningWeight = 0;
        uint256 processed = 0;
        
        for (uint256 i = startIndex; i < endIndex; i++) {
            uint256 betId = bucketInfo.betIds[i];
            Bet storage bet = bets[betId];
            
            if (!bet.finalized && !bet.exited) {
                uint256 value = resolvedValues[bet.targetTimestamp];
                require(value > 0, "Value not resolved");
                
                bet.finalized = true;
                bet.actualValue = value;
                bet.won = (value >= bet.rangeMin && value <= bet.rangeMax);
                
                if (bet.won) {
                    batchWinningWeight += bet.weight;
                }
                
                processed++;
            }
        }
        
        bucketInfo.totalWinningWeight += batchWinningWeight;
        bucketInfo.nextProcessIndex = endIndex;
        
        if (endIndex >= bucketInfo.betIds.length) {
            bucketInfo.aggregationComplete = true;
            totalObligations += bucketInfo.totalStaked - bucketInfo.totalExited;
            emit AggregationCompleted(bucket, bucketInfo.totalWinningWeight);
        }
        
        emit BatchProcessed(bucket, processed, batchWinningWeight);
        return (processed, batchWinningWeight);
    }

    /**
     * @notice Claim winnings for a finalized bet
     * @param betId The ID of the bet to claim
     */
    function claimBet(uint256 betId) external {
        Bet storage bet = bets[betId];
        require(bet.bettor == msg.sender, "Not bet owner");
        require(bet.finalized, "Bet not finalized");
        require(!bet.claimed, "Already claimed");
        require(!bet.exited, "Already exited via DPM");

        uint256 bucket = bucketIndex(bet.targetTimestamp);
        BucketInfo storage bucketInfo = buckets[bucket];
        require(bucketInfo.aggregationComplete, "Aggregation not complete");

        bet.claimed = true;

        if (bet.won) {
            // DPM-adjusted payout: use remaining pool after early exits
            uint256 remainingPool = bucketInfo.totalStaked - bucketInfo.totalExited;
            uint256 payout = bucketInfo.totalWinningWeight > 0 ? 
                (bet.weight * remainingPool) / bucketInfo.totalWinningWeight : 0;
            
            if (payout <= totalObligations) {
                totalObligations -= payout;
            } else {
                totalObligations = 0;
            }

            _transferOut(msg.sender, payout);
            
            emit BetClaimed(betId, msg.sender, payout);
        } else {
            emit BetClaimed(betId, msg.sender, 0);
        }
    }

    // ==============================================================
    // |                    Oracle Functions (Phase 1: Multisig)    |
    // ==============================================================

    /**
     * @notice Submit a value for resolution (trusted oracles only)
     * @param timestamp The target timestamp to resolve
     * @param value The resolved value
     */
    function submitValue(uint256 timestamp, uint256 value) public onlyTrustedOracle {
        require(!isResolved[timestamp], "Already resolved");
        require(value > 0, "Value must be positive");
        require(timestamp <= block.timestamp, "Cannot resolve future");
        require(oracleSubmissions[timestamp][msg.sender] == 0, "Already submitted");

        oracleSubmissions[timestamp][msg.sender] = value;
        submissionCount[timestamp]++;
        
        emit ValueSubmitted(timestamp, msg.sender, value);

        // Check if we have enough confirmations
        if (submissionCount[timestamp] >= REQUIRED_CONFIRMATIONS) {
            _tryResolveValue(timestamp);
        }
    }

    /**
     * @notice Internal function to resolve value if consensus reached
     */
    function _tryResolveValue(uint256 timestamp) internal {
        if (isResolved[timestamp]) return;

        // Collect all submissions
        uint256[] memory values = new uint256[](oracleCount);
        uint256 count = 0;

        // Get all oracle addresses and their submissions
        address[] memory oracleAddresses = _getTrustedOracleAddresses();
        for (uint256 i = 0; i < oracleAddresses.length; i++) {
            uint256 submission = oracleSubmissions[timestamp][oracleAddresses[i]];
            if (submission > 0) {
                values[count] = submission;
                count++;
            }
        }

        if (count < REQUIRED_CONFIRMATIONS) return;

        // Find consensus (majority value)
        uint256 consensusValue = _findConsensus(values, count);
        
        if (consensusValue > 0) {
            resolvedValues[timestamp] = consensusValue;
            isResolved[timestamp] = true;
            emit ValueResolved(timestamp, consensusValue, count);
            emit BucketValueSet(timestamp, consensusValue);
        }
    }

    /**
     * @notice Find consensus value from submissions
     */
    function _findConsensus(uint256[] memory values, uint256 count) internal pure returns (uint256) {
        if (count == 0) return 0;

        // Simple majority: find most common value
        for (uint256 i = 0; i < count; i++) {
            uint256 matchCount = 0;
            for (uint256 j = 0; j < count; j++) {
                if (values[i] == values[j]) {
                    matchCount++;
                }
            }
            if (matchCount >= REQUIRED_CONFIRMATIONS) {
                return values[i];
            }
        }

        return 0; // No consensus
    }

    /**
     * @notice Get array of trusted oracle addresses
     */
    function _getTrustedOracleAddresses() internal view returns (address[] memory) {
        // This is a simplified version - in production, maintain an array
        address[] memory oracles = new address[](oracleCount);
        // Implementation would iterate through all addresses
        // For now, this is a placeholder
        return oracles;
    }

    // ==============================================================
    // |                    Admin Functions                          |
    // ==============================================================

    /**
     * @notice Add a trusted oracle address
     */
    function addTrustedOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "Invalid address");
        require(!trustedOracles[oracle], "Already trusted");
        
        trustedOracles[oracle] = true;
        oracleCount++;
        
        emit OracleAdded(oracle);
    }

    /**
     * @notice Remove a trusted oracle address
     */
    function removeTrustedOracle(address oracle) external onlyOwner {
        require(trustedOracles[oracle], "Not a trusted oracle");
        
        trustedOracles[oracle] = false;
        oracleCount--;
        
        emit OracleRemoved(oracle);
    }

    /**
     * @notice Withdraw collected fees -- solvency-guarded
     */
    function withdrawFees() external onlyOwner {
        uint256 bal = _contractBalance();
        uint256 available = bal > totalObligations ? bal - totalObligations : 0;
        uint256 amount = totalFeesCollected < available ? totalFeesCollected : available;
        require(amount > 0, "No withdrawable fees");
        totalFeesCollected -= amount;
        _transferOut(owner(), amount);
    }

    /**
     * @notice Emergency withdraw surplus only -- cannot touch funds owed to winners
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 bal = _contractBalance();
        uint256 surplus = bal > totalObligations ? bal - totalObligations : 0;
        require(surplus > 0, "No surplus to withdraw");
        totalFeesCollected = 0;
        _transferOut(owner(), surplus);
    }

    /**
     * @notice Associate with a Hedera token (required before receiving HTS tokens like USDC).
     * On Hedera, contracts must explicitly associate with tokens.
     * 
     * Hedera Token Service (HTS) system contract: 0x0000000000000000000000000000000000000167
     */
    function associateToken(address token) external onlyOwner {
        // Call HTS associateToken function
        // Function selector: 0x49146bde (associateToken(address,address))
        (bool success, ) = address(0x0000000000000000000000000000000000000167).call(
            abi.encodeWithSelector(0x49146bde, address(this), token)
        );
        require(success, "Token association failed");
    }

    // ==============================================================
    // |                    Token Mode Functions                     |
    // ==============================================================

    /**
     * @notice Place a bet using ERC-20 token (USDC mode). Caller must approve() first.
     * @param targetTimestamp The target timestamp for the prediction
     * @param rangeMin Minimum value in the prediction range
     * @param rangeMax Maximum value in the prediction range
     * @param amount Token amount to stake
     * @return betId The ID of the placed bet
     */
    function placeBetWithToken(
        uint256 targetTimestamp,
        uint256 rangeMin,
        uint256 rangeMax,
        uint256 amount
    ) external validTimeRange(targetTimestamp) returns (uint256) {
        require(address(stakingToken) != address(0), "Token mode not enabled");
        require(amount > 0, "Amount must be > 0");
        require(rangeMin < rangeMax, "Invalid range");
        require(rangeMin > 0 && rangeMax > 0, "Values must be positive");
        require(targetTimestamp > block.timestamp, "Cannot bet on past");

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate fee and net stake
        uint256 fee = (amount * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = amount - fee;

        totalFeesCollected += fee;
        emit FeeCollected(fee);

        // Compute quality and weight
        uint256 qualityBps = (getSharpnessMultiplier(rangeMin, rangeMax) * getTimeMultiplier(targetTimestamp)) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        return _createBet(msg.sender, targetTimestamp, rangeMin, rangeMax, stakeNet, qualityBps, weight);
    }

    /**
     * @notice Place a bet with tokens that have already been transferred to this contract.
     * Used by proxy wallets that transfer tokens via HTS before calling this function.
     * 
     * @param bettor The address to credit the bet to (usually the proxy wallet)
     * @param targetTimestamp The target timestamp for the prediction
     * @param rangeMin The minimum value in the range
     * @param rangeMax The maximum value in the range
     * @param amount The amount of tokens (already transferred)
     * @return betId The ID of the placed bet
     */
    function placeBetWithPreTransferredToken(
        address bettor,
        uint256 targetTimestamp,
        uint256 rangeMin,
        uint256 rangeMax,
        uint256 amount
    ) external validTimeRange(targetTimestamp) returns (uint256) {
        require(address(stakingToken) != address(0), "Token mode not enabled");
        require(amount > 0, "Amount must be > 0");
        require(rangeMin < rangeMax, "Invalid range");
        require(rangeMin > 0 && rangeMax > 0, "Values must be positive");
        require(targetTimestamp > block.timestamp, "Cannot bet on past");
        require(bettor != address(0), "Invalid bettor address");

        // SECURITY FIX: Verify that tokens were actually transferred into this contract!
        uint256 currentBalance = stakingToken.balanceOf(address(this));
        uint256 newlyReceived = currentBalance - knownTokenBalance;
        require(newlyReceived >= amount, "Tokens were not transferred");
        
        // Update the known balance for the next transaction
        knownTokenBalance = currentBalance;

        // Calculate fee and net stake
        uint256 fee = (amount * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = amount - fee;

        totalFeesCollected += fee;
        emit FeeCollected(fee);

        // Compute quality and weight
        uint256 qualityBps = (getSharpnessMultiplier(rangeMin, rangeMax) * getTimeMultiplier(targetTimestamp)) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        return _createBet(bettor, targetTimestamp, rangeMin, rangeMax, stakeNet, qualityBps, weight);
    }

    // ==============================================================
    // |                    Helper Functions                          |
    // ==============================================================

    /**
     * @notice Transfer funds out -- native HBAR or ERC-20 depending on mode
     */
    function _transferOut(address to, uint256 amount) internal {
        if (amount == 0) return;
        if (address(stakingToken) != address(0)) {
            stakingToken.safeTransfer(to, amount);
            // Keep knownTokenBalance in sync
            knownTokenBalance = stakingToken.balanceOf(address(this));
        } else {
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "Transfer failed");
        }
    }

    /**
     * @notice Get contract balance -- native HBAR or ERC-20 depending on mode
     */
    function _contractBalance() internal view returns (uint256) {
        if (address(stakingToken) != address(0)) {
            return stakingToken.balanceOf(address(this));
        }
        return address(this).balance;
    }

    function _createBet(
        address bettor,
        uint256 targetTimestamp,
        uint256 rangeMin,
        uint256 rangeMax,
        uint256 stakeNet,
        uint256 qualityBps,
        uint256 weight
    ) internal returns (uint256) {
        uint256 betId = nextBetId++;
        uint256 bucket = bucketIndex(targetTimestamp);

        // Record entry band weight BEFORE adding this bet's weight
        {
            uint256 band = bandIndex(rangeMin, rangeMax);
            bets[betId].entryBandWeight = bandWeights[bucket][band];
            bandWeights[bucket][band] += weight;
        }

        bets[betId].bettor = bettor;
        bets[betId].targetTimestamp = targetTimestamp;
        bets[betId].rangeMin = rangeMin;
        bets[betId].rangeMax = rangeMax;
        bets[betId].stake = stakeNet;
        bets[betId].qualityBps = qualityBps;
        bets[betId].weight = weight;

        // Update bucket tracking
        buckets[bucket].betIds.push(betId);
        buckets[bucket].totalStaked += stakeNet;
        buckets[bucket].totalWeight += weight;

        emit BetPlaced(betId, bettor, bucket, stakeNet, rangeMin, rangeMax, targetTimestamp);
        return betId;
    }

    function bucketIndex(uint256 targetTs) public view returns (uint256) {
        require(targetTs >= startTimestamp, "Must be >= start");
        return (targetTs - startTimestamp) / SECONDS_PER_DAY;
    }

    // ==============================================================
    // |                    DPM Functions                           |
    // ==============================================================

    /**
     * @notice Quantize a prediction range into a band index for DPM tracking.
     *         Uses the midpoint of [rangeMin, rangeMax] divided into 2% bands.
     * @param rangeMin Lower bound of the prediction range
     * @param rangeMax Upper bound of the prediction range
     * @return The band index
     */
    function bandIndex(uint256 rangeMin, uint256 rangeMax) public pure returns (uint256) {
        uint256 midpoint = (rangeMin + rangeMax) / 2;
        uint256 bandWidth = (midpoint * 200) / BPS_DENOM;
        if (bandWidth == 0) bandWidth = 1;
        return midpoint / bandWidth;
    }

    /**
     * @notice Adaptive liquidity parameter for the DPM cost function.
     *         k = 20% of bucket pool size, floored at MIN_K.
     * @param bucket The bucket index
     * @return k The liquidity parameter in tinybars
     */
    function getK(uint256 bucket) public view returns (uint256) {
        uint256 poolSize = buckets[bucket].totalStaked;
        uint256 k = (poolSize * 2000) / BPS_DENOM;
        return k > MIN_K ? k : MIN_K;
    }

    /**
     * @notice Compute the exit value for a bet using the linear surplus approximation.
     *         Always underpays vs the true log cost function, keeping the pool safe.
     *         Capped at the bet's original stake.
     * @param betId The bet to compute exit value for
     * @return rawExit The exit value before fees (0 if no surplus)
     */
    function getExitValue(uint256 betId) public view returns (uint256 rawExit) {
        Bet storage bet = bets[betId];
        if (bet.finalized || bet.exited || bet.entryBandWeight == 0) return 0;

        uint256 bucket = bucketIndex(bet.targetTimestamp);
        uint256 band = bandIndex(bet.rangeMin, bet.rangeMax);
        uint256 currentBandWeight = bandWeights[bucket][band];

        if (currentBandWeight <= bet.entryBandWeight) return 0;
        uint256 surplus = currentBandWeight - bet.entryBandWeight;

        uint256 yourShare = (bet.weight * BPS_DENOM) / bet.entryBandWeight;
        rawExit = (surplus * yourShare) / BPS_DENOM;

        if (rawExit > bet.stake) rawExit = bet.stake;
    }

    /**
     * @notice Sell shares back to the pool before market resolution (DPM early exit).
     *         Bettor receives exit value minus 0.8% exit fee.
     *         Subject to 30% pool cap for solvency.
     * @param betId The ID of the bet to exit
     */
    function sellShares(uint256 betId) external {
        Bet storage bet = bets[betId];
        require(bet.bettor == msg.sender, "Not bet owner");
        require(!bet.finalized, "Already resolved");
        require(!bet.exited, "Already exited");

        uint256 rawExit = getExitValue(betId);
        require(rawExit > 0, "No exit value available");

        uint256 exitFee = (rawExit * EXIT_FEE_BPS) / BPS_DENOM;
        uint256 netExit = rawExit - exitFee;

        uint256 bucket = bucketIndex(bet.targetTimestamp);
        BucketInfo storage bucketInfo = buckets[bucket];

        require(
            bucketInfo.totalExited + netExit <= (bucketInfo.totalStaked * MAX_EXIT_RATIO_BPS) / BPS_DENOM,
            "Exit pool exhausted"
        );

        bet.exited = true;

        bucketInfo.totalExited += netExit;
        bucketInfo.totalWeight -= bet.weight;

        uint256 band = bandIndex(bet.rangeMin, bet.rangeMax);
        bandWeights[bucket][band] -= bet.weight;

        totalFeesCollected += exitFee;

        _transferOut(msg.sender, netExit);

        emit SharesSold(betId, msg.sender, netExit, exitFee);
    }

    /**
     * @notice Compute sharpness multiplier based on range width
     * @dev Narrower ranges get higher multipliers (more precise = more reward)
     */
    function getSharpnessMultiplier(
        uint256 rangeMin,
        uint256 rangeMax
    ) public pure returns (uint256) {
        uint256 range = rangeMax - rangeMin;
        uint256 averageValue = (rangeMin + rangeMax) / 2;
        uint256 widthBps = averageValue > 0 ? (range * BPS_DENOM) / averageValue : 0;

        if (widthBps > 4000) {
            return 1000;  // 0.1x - very wide range (>40%)
        } else if (widthBps >= 2000) {
            return 3000;  // 0.3x - wide range (20-40%)
        } else if (widthBps >= 1000) {
            return 5000;  // 0.5x - moderate range (10-20%)
        } else if (widthBps >= 500) {
            return 10000; // 1x - narrow range (5-10%)
        } else if (widthBps >= 200) {
            return 15000; // 1.5x - tight range (2-5%)
        } else {
            return 20000; // 2x - very sharp (<2%)
        }
    }

    /**
     * @notice Compute time multiplier based on lead time
     * @dev Earlier predictions get higher multipliers
     */
    function getTimeMultiplier(
        uint256 targetTimestamp
    ) public view returns (uint256) {
        uint256 delta = targetTimestamp - block.timestamp;

        if (delta >= 4 * SECONDS_PER_DAY) {
            return 20000; // >4 days = 2x
        } else if (delta >= 2 * SECONDS_PER_DAY) {
            return 15000; // 2-4 days = 1.5x
        } else if (delta >= 1 * SECONDS_PER_DAY) {
            return 10000; // 1-2 days = 1x
        } else if (delta >= 8 * 60 * 60) {
            return 5000;  // 8-24 h = 0.5x
        } else if (delta >= 2 * 60 * 60) {
            return 3000;  // 2-8 h = 0.3x
        } else {
            return 1000;  // < 2 h = 0.1x
        }
    }

    // ==============================================================
    // |                    View Functions                            |
    // ==============================================================

    function getBet(uint256 betId) external view returns (Bet memory) {
        return bets[betId];
    }

    function simulatePlaceBet(
        uint256 targetTimestamp,
        uint256 rangeMin,
        uint256 rangeMax,
        uint256 stakeAmount
    ) external view returns (BetSimulation memory) {
        if (targetTimestamp <= block.timestamp) {
            return BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "Must be future timestamp"
            });
        }
        
        if (rangeMin >= rangeMax) {
            return BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "Invalid range"
            });
        }
        
        if (stakeAmount < MIN_STAKE || stakeAmount > MAX_STAKE) {
            return BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "Invalid stake amount"
            });
        }

        uint256 fee = (stakeAmount * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = stakeAmount - fee;
        uint256 sharpnessBps = getSharpnessMultiplier(rangeMin, rangeMax);
        uint256 timeBps = getTimeMultiplier(targetTimestamp);
        uint256 qualityBps = (sharpnessBps * timeBps) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;
        uint256 bucket = bucketIndex(targetTimestamp);

        return BetSimulation({
            fee: fee,
            stakeNet: stakeNet,
            sharpnessBps: sharpnessBps,
            timeBps: timeBps,
            qualityBps: qualityBps,
            weight: weight,
            bucket: bucket,
            isValid: true,
            errorMessage: ""
        });
    }

    function getBucketInfo(uint256 bucket) external view returns (
        uint256 totalBets,
        uint256 totalWinningWeight,
        uint256 nextProcessIndex,
        bool aggregationComplete
    ) {
        BucketInfo storage bucketInfo = buckets[bucket];
        return (
            bucketInfo.betIds.length,
            bucketInfo.totalWinningWeight,
            bucketInfo.nextProcessIndex,
            bucketInfo.aggregationComplete
        );
    }

    /**
     * @notice Get DPM exit info for a specific bet.
     * @param betId The bet to query
     * @return rawExitValue Exit value before fee
     * @return exitFee The 0.8% fee that would be deducted
     * @return netExitPayout What the bettor would actually receive
     * @return canExit Whether the bet is eligible for early exit
     * @return exitPoolRemaining How much of the 30% exit cap is still available
     */
    function getDPMInfo(uint256 betId) external view returns (
        uint256 rawExitValue,
        uint256 exitFee,
        uint256 netExitPayout,
        bool canExit,
        uint256 exitPoolRemaining
    ) {
        Bet storage bet = bets[betId];
        uint256 bucket = bucketIndex(bet.targetTimestamp);
        BucketInfo storage bucketInfo = buckets[bucket];

        rawExitValue = getExitValue(betId);
        exitFee = (rawExitValue * EXIT_FEE_BPS) / BPS_DENOM;
        netExitPayout = rawExitValue - exitFee;

        uint256 exitCap = (bucketInfo.totalStaked * MAX_EXIT_RATIO_BPS) / BPS_DENOM;
        uint256 alreadyExited = bucketInfo.totalExited;
        exitPoolRemaining = exitCap > alreadyExited ? exitCap - alreadyExited : 0;

        canExit = !bet.finalized
            && !bet.exited
            && rawExitValue > 0
            && netExitPayout <= exitPoolRemaining;
    }

    function getResolvedValue(uint256 timestamp) external view returns (uint256) {
        return resolvedValues[timestamp];
    }

    function getStats() external view returns (
        uint256 totalBets,
        uint256 totalFees,
        uint256 contractBalance
    ) {
        return (nextBetId, totalFeesCollected, _contractBalance());
    }
}
