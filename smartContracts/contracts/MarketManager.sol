// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MarketManager
 * @notice Manages multi-outcome prediction markets with native HTS outcome tokens.
 *         Supports 2-N outcomes per market (binary YES/NO or multi-outcome).
 *         Uses the operator model: all on-chain actions are performed by the operator
 *         on behalf of managed wallet users. Off-chain order book in Convex handles matching.
 *
 * Architecture:
 *   - Each market has N outcome token IDs (native HTS fungible tokens)
 *   - 1 USDC splits into 1 of each outcome token (complete set)
 *   - Resolution picks one winning outcome
 *   - Winning token holders redeem 1:1 for USDC
 *   - All token operations use HTS pre-compiles for native Hedera performance
 */

// Hedera HTS System Contract interface (pre-compile at 0x167)
interface IHederaTokenService {
    struct TokenKey {
        uint256 keyType;
        bytes keyValue;
    }

    struct HederaToken {
        string name;
        string symbol;
        address treasury;
        string memo;
        bool tokenSupplyType; // false = infinite, true = finite
        int64 maxSupply;
        bool freezeDefault;
        TokenKey[] tokenKeys;
        Expiry expiry;
    }

    struct Expiry {
        int64 second;
        address autoRenewAccount;
        int64 autoRenewPeriod;
    }

    function createFungibleToken(
        HederaToken memory token,
        int64 initialTotalSupply,
        int32 decimals
    ) external payable returns (int64 responseCode, address tokenAddress);

    function mintToken(
        address token,
        int64 amount,
        bytes[] memory metadata
    ) external returns (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers);

    function burnToken(
        address token,
        int64 amount,
        int64[] memory serialNumbers
    ) external returns (int64 responseCode, int64 newTotalSupply);

    function associateToken(
        address account,
        address token
    ) external returns (int64 responseCode);

    function transferToken(
        address token,
        address sender,
        address receiver,
        int64 amount
    ) external returns (int64 responseCode);
}

// ERC-20 interface for USDC interactions
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract MarketManager is Ownable, ReentrancyGuard, Pausable {
    // HTS pre-compile address on Hedera
    address constant HTS_PRECOMPILE = address(0x167);

    // USDC token address (EVM format)
    address public immutable usdcToken;

    // Fee in basis points (e.g., 100 = 1%)
    uint256 public feeBps = 100;
    uint256 constant BPS_DENOM = 10000;

    // Accumulated protocol fees
    uint256 public totalFees;

    // Market structure
    struct Market {
        string question;           // "Will Candidate A win?"
        string[] outcomeNames;     // ["Yes", "No"] or ["Spain", "England", "France", ...]
        address[] outcomeTokens;   // HTS token addresses for each outcome
        uint256 numOutcomes;
        uint256 totalCollateral;   // Total USDC locked as collateral
        uint256 winningOutcome;    // Index of winning outcome (set on resolution)
        bool resolved;
        bool active;
        uint256 createdAt;
        uint256 resolutionTimestamp; // When the market should resolve
    }

    // Market storage
    uint256 public nextMarketId;
    mapping(uint256 => Market) public markets;

    // Events
    event MarketCreated(uint256 indexed marketId, string question, uint256 numOutcomes, address[] outcomeTokens);
    event PositionSplit(uint256 indexed marketId, address indexed operator, uint256 usdcAmount, uint256 tokensPerOutcome);
    event PositionMerge(uint256 indexed marketId, address indexed operator, uint256 tokensPerOutcome, uint256 usdcReturned);
    event MarketResolved(uint256 indexed marketId, uint256 winningOutcome);
    event WinningsRedeemed(uint256 indexed marketId, address indexed operator, uint256 tokensBurned, uint256 usdcPaid);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(address _usdcToken) {
        usdcToken = _usdcToken;
    }

    // =========================================================================
    // MARKET CREATION (Owner only)
    // =========================================================================

    /**
     * @notice Create a new prediction market with N outcomes.
     * @param question The market question (e.g., "Who will win the 2026 World Cup?")
     * @param outcomeNames Array of outcome names (e.g., ["Spain", "England", "France"])
     * @param resolutionTimestamp Unix timestamp when the market should resolve
     * @param outcomeTokenAddresses Pre-created HTS token addresses for each outcome.
     *        Tokens must be created externally (via SDK) with this contract as supply key holder.
     *        This avoids the complexity of creating HTS tokens from within Solidity.
     */
    function createMarket(
        string calldata question,
        string[] calldata outcomeNames,
        uint256 resolutionTimestamp,
        address[] calldata outcomeTokenAddresses
    ) external onlyOwner returns (uint256 marketId) {
        require(outcomeNames.length >= 2, "Need at least 2 outcomes");
        require(outcomeNames.length <= 20, "Max 20 outcomes");
        require(outcomeNames.length == outcomeTokenAddresses.length, "Names and tokens length mismatch");
        require(resolutionTimestamp > block.timestamp, "Resolution must be in the future");

        marketId = nextMarketId++;

        Market storage m = markets[marketId];
        m.question = question;
        m.numOutcomes = outcomeNames.length;
        m.active = true;
        m.createdAt = block.timestamp;
        m.resolutionTimestamp = resolutionTimestamp;

        for (uint256 i = 0; i < outcomeNames.length; i++) {
            m.outcomeNames.push(outcomeNames[i]);
            m.outcomeTokens.push(outcomeTokenAddresses[i]);
        }

        emit MarketCreated(marketId, question, outcomeNames.length, outcomeTokenAddresses);
    }

    // =========================================================================
    // POSITION SPLITTING (Operator calls on behalf of users)
    // =========================================================================

    /**
     * @notice Split USDC into a complete set of outcome tokens.
     *         1 USDC = 1 of each outcome token (minus fee).
     *         Operator calls this when a user wants to enter the market.
     * @param marketId The market to split into
     * @param usdcAmount Amount of USDC to split (6 decimals)
     */
    function splitPosition(uint256 marketId, uint256 usdcAmount) external nonReentrant whenNotPaused {
        Market storage m = markets[marketId];
        require(m.active, "Market not active");
        require(!m.resolved, "Market already resolved");
        require(usdcAmount > 0, "Amount must be > 0");

        // Deduct fee
        uint256 fee = (usdcAmount * feeBps) / BPS_DENOM;
        uint256 netAmount = usdcAmount - fee;
        totalFees += fee;

        // Transfer USDC from operator to this contract using HTS
        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        int64 rc = hts.transferToken(
            usdcToken,
            msg.sender,
            address(this),
            int64(int256(usdcAmount))
        );
        require(rc == 22, "USDC transfer failed");

        // Mint equal amount of each outcome token to the operator
        bytes[] memory empty = new bytes[](0);

        for (uint256 i = 0; i < m.numOutcomes; i++) {
            (int64 responseCode,,) = hts.mintToken(
                m.outcomeTokens[i],
                int64(int256(netAmount)),
                empty
            );
            require(responseCode == 22, "Mint failed"); // 22 = SUCCESS

            // Transfer minted tokens to operator
            int64 rc = hts.transferToken(
                m.outcomeTokens[i],
                address(this),
                msg.sender,
                int64(int256(netAmount))
            );
            require(rc == 22, "Token transfer failed");
        }

        m.totalCollateral += netAmount;

        emit PositionSplit(marketId, msg.sender, usdcAmount, netAmount);
    }

    // =========================================================================
    // POSITION MERGING (Reverse of split -- return complete set for USDC)
    // =========================================================================

    /**
     * @notice Merge a complete set of outcome tokens back into USDC.
     *         Operator returns 1 of each outcome token and gets USDC back.
     *         Useful for market makers or when a user wants to fully exit.
     * @param marketId The market to merge from
     * @param tokenAmount Amount of each outcome token to merge
     */
    function mergePosition(uint256 marketId, uint256 tokenAmount) external nonReentrant whenNotPaused {
        Market storage m = markets[marketId];
        require(m.active, "Market not active");
        require(!m.resolved, "Market already resolved");
        require(tokenAmount > 0, "Amount must be > 0");
        require(tokenAmount <= m.totalCollateral, "Exceeds collateral");

        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        int64[] memory empty = new int64[](0);

        // Transfer and burn each outcome token from operator
        for (uint256 i = 0; i < m.numOutcomes; i++) {
            // Transfer tokens from operator to this contract
            int64 rc = hts.transferToken(
                m.outcomeTokens[i],
                msg.sender,
                address(this),
                int64(int256(tokenAmount))
            );
            require(rc == 22, "Token transfer failed");

            // Burn the tokens
            (int64 responseCode,) = hts.burnToken(
                m.outcomeTokens[i],
                int64(int256(tokenAmount)),
                empty
            );
            require(responseCode == 22, "Burn failed");
        }

        // Return USDC to operator using HTS
        int64 rc2 = hts.transferToken(
            usdcToken,
            address(this),
            msg.sender,
            int64(int256(tokenAmount))
        );
        require(rc2 == 22, "USDC transfer failed");

        m.totalCollateral -= tokenAmount;

        emit PositionMerge(marketId, msg.sender, tokenAmount, tokenAmount);
    }

    // =========================================================================
    // RESOLUTION (Owner only)
    // =========================================================================

    /**
     * @notice Resolve a market by declaring the winning outcome.
     * @param marketId The market to resolve
     * @param winningOutcomeIndex Index of the winning outcome (0-based)
     */
    function resolveMarket(uint256 marketId, uint256 winningOutcomeIndex) external onlyOwner {
        Market storage m = markets[marketId];
        require(m.active, "Market not active");
        require(!m.resolved, "Already resolved");
        require(winningOutcomeIndex < m.numOutcomes, "Invalid outcome index");

        m.resolved = true;
        m.winningOutcome = winningOutcomeIndex;

        emit MarketResolved(marketId, winningOutcomeIndex);
    }

    // =========================================================================
    // REDEMPTION (Operator calls on behalf of winning users)
    // =========================================================================

    /**
     * @notice Redeem winning outcome tokens for USDC (1:1).
     *         Operator calls this after resolution to pay out winners.
     * @param marketId The resolved market
     * @param tokenAmount Amount of winning tokens to redeem
     */
    function redeemWinnings(uint256 marketId, uint256 tokenAmount) external nonReentrant {
        Market storage m = markets[marketId];
        require(m.resolved, "Market not resolved");
        require(tokenAmount > 0, "Amount must be > 0");
        require(tokenAmount <= m.totalCollateral, "Exceeds collateral");

        address winningToken = m.outcomeTokens[m.winningOutcome];

        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        int64[] memory empty = new int64[](0);

        // Transfer winning tokens from operator to this contract
        int64 rc = hts.transferToken(
            winningToken,
            msg.sender,
            address(this),
            int64(int256(tokenAmount))
        );
        require(rc == 22, "Token transfer failed");

        // Burn the winning tokens
        (int64 responseCode,) = hts.burnToken(
            winningToken,
            int64(int256(tokenAmount)),
            empty
        );
        require(responseCode == 22, "Burn failed");

        // Pay out USDC 1:1 using HTS
        int64 rc2 = hts.transferToken(
            usdcToken,
            address(this),
            msg.sender,
            int64(int256(tokenAmount))
        );
        require(rc2 == 22, "USDC transfer failed");

        m.totalCollateral -= tokenAmount;

        emit WinningsRedeemed(marketId, msg.sender, tokenAmount, tokenAmount);
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high"); // Max 5%
        feeBps = _feeBps;
    }

    function withdrawFees(address to) external onlyOwner {
        require(totalFees > 0, "No fees to withdraw");
        uint256 amount = totalFees;
        totalFees = 0;
        
        // Transfer fees using HTS
        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        int64 rc = hts.transferToken(
            usdcToken,
            address(this),
            to,
            int64(int256(amount))
        );
        require(rc == 22, "Fee withdrawal failed");
        
        emit FeesWithdrawn(to, amount);
    }

    function deactivateMarket(uint256 marketId) external onlyOwner {
        markets[marketId].active = false;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    function getMarket(uint256 marketId) external view returns (
        string memory question,
        uint256 numOutcomes,
        address[] memory outcomeTokens,
        uint256 totalCollateral,
        bool resolved,
        uint256 winningOutcome,
        bool active,
        uint256 resolutionTimestamp
    ) {
        Market storage m = markets[marketId];
        return (
            m.question,
            m.numOutcomes,
            m.outcomeTokens,
            m.totalCollateral,
            m.resolved,
            m.winningOutcome,
            m.active,
            m.resolutionTimestamp
        );
    }

    function getOutcomeNames(uint256 marketId) external view returns (string[] memory) {
        return markets[marketId].outcomeNames;
    }

    function getOutcomeTokens(uint256 marketId) external view returns (address[] memory) {
        return markets[marketId].outcomeTokens;
    }

    function getMarketCount() external view returns (uint256) {
        return nextMarketId;
    }
}
