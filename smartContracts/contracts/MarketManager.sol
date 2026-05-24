// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./OutcomeToken.sol";

/**
 * @title MarketManager
 * @notice Manages multi-outcome prediction markets with ERC-20 outcome tokens.
 *         Supports 2-N outcomes per market (binary YES/NO or multi-outcome).
 *         Uses the operator model: all on-chain actions are performed by the operator
 *         on behalf of managed wallet users. Off-chain order book in Convex handles matching.
 *
 * Architecture:
 *   - Each market has N outcome tokens (standard ERC-20, mintable/burnable by this contract)
 *   - 1 USDC splits into 1 of each outcome token (complete set)
 *   - Resolution picks one winning outcome
 *   - Winning token holders redeem 1:1 for USDC
 */
contract MarketManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    uint256 public feeBps = 100;
    uint256 constant BPS_DENOM = 10000;

    uint256 public totalFees;

    struct Market {
        string question;
        string[] outcomeNames;
        address[] outcomeTokens;
        uint256 numOutcomes;
        uint256 totalCollateral;
        uint256 winningOutcome;
        bool resolved;
        bool active;
        uint256 createdAt;
        uint256 resolutionTimestamp;
    }

    uint256 public nextMarketId;
    mapping(uint256 => Market) public markets;

    event MarketCreated(uint256 indexed marketId, string question, uint256 numOutcomes, address[] outcomeTokens);
    event PositionSplit(uint256 indexed marketId, address indexed operator, uint256 usdcAmount, uint256 tokensPerOutcome);
    event PositionMerge(uint256 indexed marketId, address indexed operator, uint256 tokensPerOutcome, uint256 usdcReturned);
    event MarketResolved(uint256 indexed marketId, uint256 winningOutcome);
    event WinningsRedeemed(uint256 indexed marketId, address indexed operator, uint256 tokensBurned, uint256 usdcPaid);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(address _usdcToken) {
        usdcToken = IERC20(_usdcToken);
    }

    // =========================================================================
    // MARKET CREATION (Owner only)
    // =========================================================================

    function createMarket(
        string calldata question,
        string[] calldata outcomeNames,
        uint256 resolutionTimestamp
    ) external onlyOwner returns (uint256 marketId) {
        require(outcomeNames.length >= 2, "Need at least 2 outcomes");
        require(outcomeNames.length <= 20, "Max 20 outcomes");
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
            string memory tokenName = string(abi.encodePacked("Outcome-", outcomeNames[i]));
            string memory tokenSymbol = string(abi.encodePacked("OUT", _uint2str(marketId), "-", _uint2str(i)));
            OutcomeToken token = new OutcomeToken(tokenName, tokenSymbol);
            m.outcomeTokens.push(address(token));
        }

        emit MarketCreated(marketId, question, outcomeNames.length, m.outcomeTokens);
    }

    // =========================================================================
    // POSITION SPLITTING (Operator calls on behalf of users)
    // =========================================================================

    function splitPosition(uint256 marketId, uint256 usdcAmount) external nonReentrant whenNotPaused {
        Market storage m = markets[marketId];
        require(m.active, "Market not active");
        require(!m.resolved, "Market already resolved");
        require(usdcAmount > 0, "Amount must be > 0");

        uint256 fee = (usdcAmount * feeBps) / BPS_DENOM;
        uint256 netAmount = usdcAmount - fee;
        totalFees += fee;

        usdcToken.safeTransferFrom(msg.sender, address(this), usdcAmount);

        for (uint256 i = 0; i < m.numOutcomes; i++) {
            OutcomeToken(m.outcomeTokens[i]).mint(msg.sender, netAmount);
        }

        m.totalCollateral += netAmount;

        emit PositionSplit(marketId, msg.sender, usdcAmount, netAmount);
    }

    // =========================================================================
    // POSITION MERGING (Reverse of split -- return complete set for USDC)
    // =========================================================================

    function mergePosition(uint256 marketId, uint256 tokenAmount) external nonReentrant whenNotPaused {
        Market storage m = markets[marketId];
        require(m.active, "Market not active");
        require(!m.resolved, "Market already resolved");
        require(tokenAmount > 0, "Amount must be > 0");
        require(tokenAmount <= m.totalCollateral, "Exceeds collateral");

        for (uint256 i = 0; i < m.numOutcomes; i++) {
            OutcomeToken(m.outcomeTokens[i]).burnFrom(msg.sender, tokenAmount);
        }

        usdcToken.safeTransfer(msg.sender, tokenAmount);

        m.totalCollateral -= tokenAmount;

        emit PositionMerge(marketId, msg.sender, tokenAmount, tokenAmount);
    }

    // =========================================================================
    // RESOLUTION (Owner only)
    // =========================================================================

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

    function redeemWinnings(uint256 marketId, uint256 tokenAmount) external nonReentrant {
        Market storage m = markets[marketId];
        require(m.resolved, "Market not resolved");
        require(tokenAmount > 0, "Amount must be > 0");
        require(tokenAmount <= m.totalCollateral, "Exceeds collateral");

        address winningToken = m.outcomeTokens[m.winningOutcome];
        OutcomeToken(winningToken).burnFrom(msg.sender, tokenAmount);

        usdcToken.safeTransfer(msg.sender, tokenAmount);

        m.totalCollateral -= tokenAmount;

        emit WinningsRedeemed(marketId, msg.sender, tokenAmount, tokenAmount);
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high");
        feeBps = _feeBps;
    }

    function withdrawFees(address to) external onlyOwner {
        require(totalFees > 0, "No fees to withdraw");
        uint256 amount = totalFees;
        totalFees = 0;
        usdcToken.safeTransfer(to, amount);
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

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
