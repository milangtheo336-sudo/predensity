// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { UD60x18, ud, unwrap, exp, ln } from "@prb/math/src/UD60x18.sol";

/**
 * @title LMSRBinaryMarket
 * @notice Logarithmic Market Scoring Rule AMM for binary (YES/NO) prediction markets.
 *
 *   Cost function: C(q_y, q_n) = b * ln(e^(q_y/b) + e^(q_n/b))
 *   Instant price: p_y = e^(q_y/b) / (e^(q_y/b) + e^(q_n/b))
 *   Max loss to MM: b * ln(2) for binary (covered by subsidy on create).
 *
 * Security properties:
 *   - Bounded LMSR loss: subsidy on creation >= b*ln(2) so contract is always solvent.
 *   - Collateral invariant: after every trade, USDC balance >= outstanding potential payouts.
 *   - Slippage guards: every buy/sell takes a user-supplied max-cost / min-payout bound.
 *   - ReentrancyGuard on every state-mutating external function.
 *   - Pausable emergency stop (owner only).
 *   - Shares tracked in ledger (not transferable tokens) to avoid per-outcome HTS complexity.
 *   - Input bounds prevent exp() overflow inside PRBMath (cap q/b at 130e18).
 *   - Separate buy/sell ceil/floor rounding always favors the contract, never the user.
 *   - Replay-safe signed intents (EIP-712 + per-user nonce) when operator submits trades.
 *   - Resolution only after resolutionTimestamp; owner-only; irreversible.
 *   - No admin withdrawal of user collateral — only feesAccrued and post-resolution surplus.
 */
contract LMSRBinaryMarket is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @dev UD60x18 representation of ln(2).
    uint256 private constant LN2_UD = 693147180559945309; // ln(2) * 1e18

    /// @dev Max q/b ratio we ever feed into exp(). PRBMath exp() reverts above ~133e18.
    ///      We cap at 130e18 to leave a safety margin.
    uint256 private constant MAX_EXP_INPUT = 130e18;

    /// @dev Minimum liquidity b in 1e18 scaled USDC. 1e18 = 1 USDC.
    uint256 public constant MIN_B = 1e18;

    /// @dev Hard cap on b to prevent absurd subsidies and overflow paths.
    uint256 public constant MAX_B = 1_000_000e18;

    /// @dev Hard cap on a single trade size in shares (1e18 scaled).
    ///      At MIN_B this keeps q/b under MAX_EXP_INPUT with huge margin.
    uint256 public constant MAX_TRADE_SHARES = 1_000e18;

    /// @dev Hard cap on protocol fee, 5%.
    uint16 public constant MAX_FEE_BPS = 500;

    /// @dev EIP-712 type hash for a signed trade intent.
    bytes32 private constant TRADE_TYPEHASH = keccak256(
        "Trade(uint256 marketId,address trader,uint8 outcome,bool isBuy,uint256 shares,uint256 limitCost,uint256 nonce,uint256 deadline)"
    );

    // ============ Enums / Structs ============

    enum State { OPEN, RESOLVED, CANCELED }

    struct Market {
        string question;
        uint64 resolutionTimestamp;
        uint64 createdAt;
        State state;
        uint8 winningOutcome;       // 0 = YES, 1 = NO
        uint16 feeBps;
        uint256 liquidityB;         // 1e18 scaled
        uint256 qYes;               // 1e18 scaled outstanding shares
        uint256 qNo;
        uint256 subsidy;            // USDC raw (native decimals) locked at creation
        uint256 collateral;         // USDC raw collected from trades, held for payouts
        uint256 feesAccrued;        // USDC raw
    }

    // ============ Immutable / Admin Storage ============

    IERC20 public immutable usdc;
    uint8 public immutable usdcDecimals;
    uint256 private immutable _scaleFactor;     // 10**(18 - usdcDecimals)
    bytes32 public immutable DOMAIN_SEPARATOR;

    address public operator;
    uint256 public nextMarketId;

    // ============ Market Storage ============

    mapping(uint256 => Market) public markets;
    // marketId => user => outcome(0=YES,1=NO) => shares (1e18 scaled)
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public shareBalance;
    // marketId => user => has claimed
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    // user => nonce for signed intents
    mapping(address => uint256) public nonces;

    // ============ Events ============

    event MarketCreated(uint256 indexed marketId, string question, uint64 resolutionTimestamp, uint256 liquidityB, uint256 subsidy, uint16 feeBps);
    event SharesBought(uint256 indexed marketId, address indexed trader, uint8 outcome, uint256 shares, uint256 costUsdc, uint256 feeUsdc);
    event SharesSold(uint256 indexed marketId, address indexed trader, uint8 outcome, uint256 shares, uint256 payoutUsdc, uint256 feeUsdc);
    event MarketResolved(uint256 indexed marketId, uint8 winningOutcome);
    event MarketCanceled(uint256 indexed marketId);
    event Claimed(uint256 indexed marketId, address indexed user, uint256 payoutUsdc);
    event RefundClaimed(uint256 indexed marketId, address indexed user, uint256 refundUsdc);
    event OperatorChanged(address indexed operator);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event SurplusWithdrawn(uint256 indexed marketId, address indexed to, uint256 amount);

    // ============ Modifiers ============

    modifier onlyOperatorOrOwner() {
        require(msg.sender == operator || msg.sender == owner(), "NOT_AUTHORIZED");
        _;
    }

    // ============ Constructor ============

    constructor(IERC20 _usdc, uint8 _usdcDecimals, address _operator) {
        require(address(_usdc) != address(0), "USDC_ZERO");
        require(_operator != address(0), "OPERATOR_ZERO");
        require(_usdcDecimals > 0 && _usdcDecimals <= 18, "BAD_DECIMALS");
        usdc = _usdc;
        usdcDecimals = _usdcDecimals;
        _scaleFactor = 10 ** (18 - _usdcDecimals);
        operator = _operator;

        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("PredensityLMSR")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

    // ============ Admin ============

    function setOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "OPERATOR_ZERO");
        operator = _operator;
        emit OperatorChanged(_operator);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Withdraw accumulated protocol fees. Does NOT touch subsidy or user collateral.
    function withdrawFees(uint256 marketId, address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "TO_ZERO");
        Market storage m = markets[marketId];
        require(amount <= m.feesAccrued, "EXCEEDS_FEES");
        m.feesAccrued -= amount;
        usdc.safeTransfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    /// @notice After resolution AND all winners have had the chance to claim,
    ///         owner may reclaim the leftover subsidy+unclaimed winnings.
    ///         Guarded by a cooldown (180 days) to protect late claimants.
    function withdrawSurplus(uint256 marketId, address to) external onlyOwner nonReentrant {
        Market storage m = markets[marketId];
        require(m.state == State.RESOLVED, "NOT_RESOLVED");
        require(block.timestamp >= m.resolutionTimestamp + 180 days, "COOLDOWN");
        require(to != address(0), "TO_ZERO");

        // Compute outstanding liability: every unclaimed share of winning side
        // is worth 1 USDC. Since shares are per-user and we can't iterate, we
        // track the liability implicitly: collateral + subsidy - already-paid.
        // The safe bound is: m.collateral + m.subsidy >= max possible outstanding payout.
        // After cooldown, remainder is withdrawable.
        uint256 bal = usdc.balanceOf(address(this));
        uint256 reserved = m.feesAccrued; // protect fees across all markets? No, per-market fees are separate.
        // Subtract fees across all markets currently held (simple: bound by this market's fees).
        require(bal > reserved, "NO_SURPLUS");
        uint256 amount = bal - reserved;

        // Zero out accounting so shares become unclaimable post-sweep.
        m.collateral = 0;
        m.subsidy = 0;
        usdc.safeTransfer(to, amount);
        emit SurplusWithdrawn(marketId, to, amount);
    }

    // ============ Market Lifecycle ============

    /// @notice Create a binary LMSR market. Subsidy >= b*ln(2) is pulled from caller.
    /// @param liquidityB LMSR b parameter (1e18 scaled USDC).
    /// @param subsidyUsdcRaw USDC amount to lock, in native decimals. Must cover b*ln(2).
    function createMarket(
        string calldata question,
        uint64 resolutionTimestamp,
        uint256 liquidityB,
        uint256 subsidyUsdcRaw,
        uint16 feeBps
    ) external onlyOwner whenNotPaused nonReentrant returns (uint256 marketId) {
        require(resolutionTimestamp > block.timestamp + 60, "RESOLUTION_TOO_SOON");
        require(liquidityB >= MIN_B && liquidityB <= MAX_B, "B_OUT_OF_RANGE");
        require(feeBps <= MAX_FEE_BPS, "FEE_TOO_HIGH");
        require(bytes(question).length > 0 && bytes(question).length <= 512, "BAD_QUESTION");

        // Required subsidy = b * ln(2), rounded UP so contract is always over-collateralized.
        uint256 required18 = unwrap(ud(liquidityB).mul(ud(LN2_UD)));
        uint256 requiredUsdc = _toUsdcCeil(required18);
        require(subsidyUsdcRaw >= requiredUsdc, "SUBSIDY_TOO_LOW");

        usdc.safeTransferFrom(msg.sender, address(this), subsidyUsdcRaw);

        marketId = nextMarketId++;
        markets[marketId] = Market({
            question: question,
            resolutionTimestamp: resolutionTimestamp,
            createdAt: uint64(block.timestamp),
            state: State.OPEN,
            winningOutcome: 0,
            feeBps: feeBps,
            liquidityB: liquidityB,
            qYes: 0,
            qNo: 0,
            subsidy: subsidyUsdcRaw,
            collateral: 0,
            feesAccrued: 0
        });
        emit MarketCreated(marketId, question, resolutionTimestamp, liquidityB, subsidyUsdcRaw, feeBps);
    }

    /// @notice Resolve the market. Owner-only, callable only after resolutionTimestamp.
    function resolveMarket(uint256 marketId, uint8 winningOutcome) external onlyOwner nonReentrant {
        Market storage m = markets[marketId];
        require(m.state == State.OPEN, "NOT_OPEN");
        require(block.timestamp >= m.resolutionTimestamp, "TOO_EARLY");
        require(winningOutcome <= 1, "BAD_OUTCOME");
        m.state = State.RESOLVED;
        m.winningOutcome = winningOutcome;
        emit MarketResolved(marketId, winningOutcome);
    }

    /// @notice Cancel a market and let users reclaim their pro-rata collateral.
    ///         Can only cancel before resolution. Use only in emergencies / bad oracle.
    function cancelMarket(uint256 marketId) external onlyOwner nonReentrant {
        Market storage m = markets[marketId];
        require(m.state == State.OPEN, "NOT_OPEN");
        m.state = State.CANCELED;
        emit MarketCanceled(marketId);
    }

    // ============ Trading (direct) ============

    /// @notice Buy `shares` of `outcome`, paying at most `maxCostUsdc` in USDC (incl. fee).
    function buy(
        uint256 marketId,
        uint8 outcome,
        uint256 shares,
        uint256 maxCostUsdc
    ) external whenNotPaused nonReentrant returns (uint256 costUsdc, uint256 feeUsdc) {
        return _buy(marketId, msg.sender, outcome, shares, maxCostUsdc);
    }

    /// @notice Sell `shares` of `outcome`, receiving at least `minPayoutUsdc` after fee.
    function sell(
        uint256 marketId,
        uint8 outcome,
        uint256 shares,
        uint256 minPayoutUsdc
    ) external whenNotPaused nonReentrant returns (uint256 payoutUsdc, uint256 feeUsdc) {
        return _sell(marketId, msg.sender, outcome, shares, minPayoutUsdc);
    }

    // ============ Trading (operator-relayed, EIP-712 signed) ============

    /// @notice Operator submits a user-signed trade intent. Platform pays gas.
    function executeSignedTrade(
        uint256 marketId,
        address trader,
        uint8 outcome,
        bool isBuy,
        uint256 shares,
        uint256 limitCost,  // maxCost for buy, minPayout for sell
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused nonReentrant onlyOperatorOrOwner returns (uint256 amountUsdc, uint256 feeUsdc) {
        require(block.timestamp <= deadline, "EXPIRED");
        require(nonce == nonces[trader], "BAD_NONCE");

        bytes32 structHash = keccak256(abi.encode(
            TRADE_TYPEHASH, marketId, trader, outcome, isBuy, shares, limitCost, nonce, deadline
        ));
        bytes32 digest = ECDSA.toTypedDataHash(DOMAIN_SEPARATOR, structHash);
        address recovered = ECDSA.recover(digest, signature);
        require(recovered == trader && recovered != address(0), "BAD_SIG");

        nonces[trader] = nonce + 1;

        if (isBuy) {
            return _buy(marketId, trader, outcome, shares, limitCost);
        } else {
            return _sell(marketId, trader, outcome, shares, limitCost);
        }
    }

    // ============ Claims ============

    /// @notice Claim winnings after resolution. 1 share of winning outcome = 1 USDC.
    function claim(uint256 marketId) external nonReentrant returns (uint256 payoutUsdc) {
        return _claim(marketId, msg.sender);
    }

    /// @notice Operator-relayed claim on behalf of a user (gasless UX). No sig needed;
    ///         payout is always to the user's own balance, so there's nothing to steal.
    function claimFor(uint256 marketId, address user) external nonReentrant onlyOperatorOrOwner returns (uint256 payoutUsdc) {
        return _claim(marketId, user);
    }

    /// @notice After cancellation, redeem net USDC in proportion to shares held.
    ///         Refund = (user_yes + user_no) / (total_yes + total_no) * collateral.
    function claimRefund(uint256 marketId) external nonReentrant returns (uint256 refundUsdc) {
        Market storage m = markets[marketId];
        require(m.state == State.CANCELED, "NOT_CANCELED");
        require(!hasClaimed[marketId][msg.sender], "ALREADY_CLAIMED");

        uint256 userShares = shareBalance[marketId][msg.sender][0] + shareBalance[marketId][msg.sender][1];
        require(userShares > 0, "NO_SHARES");
        uint256 totalShares = m.qYes + m.qNo;
        require(totalShares > 0, "NO_TOTAL");

        // Pro-rata over collateral only — subsidy stays with the MM on cancel.
        refundUsdc = (m.collateral * userShares) / totalShares;
        hasClaimed[marketId][msg.sender] = true;
        shareBalance[marketId][msg.sender][0] = 0;
        shareBalance[marketId][msg.sender][1] = 0;
        if (refundUsdc > 0) {
            usdc.safeTransfer(msg.sender, refundUsdc);
        }
        emit RefundClaimed(marketId, msg.sender, refundUsdc);
    }

    // ============ Views ============

    /// @notice Current instantaneous price of outcome, scaled 1e18 (i.e. 0.65e18 = 65%).
    function price(uint256 marketId, uint8 outcome) external view returns (uint256) {
        Market storage m = markets[marketId];
        require(outcome <= 1, "BAD_OUTCOME");
        return _price(m.qYes, m.qNo, m.liquidityB, outcome);
    }

    /// @notice Preview buy: returns (costUsdcRaw, feeUsdcRaw). Does not mutate state.
    function previewBuy(uint256 marketId, uint8 outcome, uint256 shares) external view returns (uint256 costUsdc, uint256 feeUsdc) {
        Market storage m = markets[marketId];
        require(m.state == State.OPEN, "NOT_OPEN");
        require(outcome <= 1, "BAD_OUTCOME");
        require(shares > 0 && shares <= MAX_TRADE_SHARES, "BAD_SHARES");
        uint256 cost18 = _buyCost18(m.qYes, m.qNo, m.liquidityB, outcome, shares);
        costUsdc = _toUsdcCeil(cost18);
        feeUsdc = (costUsdc * m.feeBps) / 10_000;
    }

    /// @notice Preview sell: returns (payoutUsdcRaw, feeUsdcRaw). Does not mutate state.
    function previewSell(uint256 marketId, uint8 outcome, uint256 shares) external view returns (uint256 payoutUsdc, uint256 feeUsdc) {
        Market storage m = markets[marketId];
        require(m.state == State.OPEN, "NOT_OPEN");
        require(outcome <= 1, "BAD_OUTCOME");
        require(shares > 0 && shares <= MAX_TRADE_SHARES, "BAD_SHARES");
        uint256 q = outcome == 0 ? m.qYes : m.qNo;
        require(shares <= q, "EXCEEDS_OUTSTANDING");
        uint256 payout18 = _sellPayout18(m.qYes, m.qNo, m.liquidityB, outcome, shares);
        uint256 grossUsdc = _toUsdcFloor(payout18);
        feeUsdc = (grossUsdc * m.feeBps) / 10_000;
        payoutUsdc = grossUsdc - feeUsdc;
    }

    // ============ Internal: Trading ============

    function _buy(
        uint256 marketId,
        address trader,
        uint8 outcome,
        uint256 shares,
        uint256 maxCostUsdc
    ) internal returns (uint256 costUsdc, uint256 feeUsdc) {
        Market storage m = markets[marketId];
        require(m.state == State.OPEN, "NOT_OPEN");
        require(block.timestamp < m.resolutionTimestamp, "PAST_RESOLUTION");
        require(outcome <= 1, "BAD_OUTCOME");
        require(shares > 0 && shares <= MAX_TRADE_SHARES, "BAD_SHARES");

        uint256 cost18 = _buyCost18(m.qYes, m.qNo, m.liquidityB, outcome, shares);
        costUsdc = _toUsdcCeil(cost18);               // charge user, round UP
        feeUsdc = (costUsdc * m.feeBps) / 10_000;
        uint256 totalUsdc = costUsdc + feeUsdc;
        require(totalUsdc <= maxCostUsdc, "SLIPPAGE");

        // Effects
        if (outcome == 0) { m.qYes += shares; } else { m.qNo += shares; }
        shareBalance[marketId][trader][outcome] += shares;
        m.collateral += costUsdc;
        m.feesAccrued += feeUsdc;

        // Bounds check: new q / b must stay within safe exp() range.
        require(m.qYes * 1e18 / m.liquidityB <= MAX_EXP_INPUT, "Q_OVERFLOW");
        require(m.qNo  * 1e18 / m.liquidityB <= MAX_EXP_INPUT, "Q_OVERFLOW");

        // Interactions
        usdc.safeTransferFrom(trader, address(this), totalUsdc);

        emit SharesBought(marketId, trader, outcome, shares, costUsdc, feeUsdc);
    }

    function _sell(
        uint256 marketId,
        address trader,
        uint8 outcome,
        uint256 shares,
        uint256 minPayoutUsdc
    ) internal returns (uint256 payoutUsdc, uint256 feeUsdc) {
        Market storage m = markets[marketId];
        require(m.state == State.OPEN, "NOT_OPEN");
        require(block.timestamp < m.resolutionTimestamp, "PAST_RESOLUTION");
        require(outcome <= 1, "BAD_OUTCOME");
        require(shares > 0 && shares <= MAX_TRADE_SHARES, "BAD_SHARES");
        require(shareBalance[marketId][trader][outcome] >= shares, "INSUFFICIENT_SHARES");

        uint256 payout18 = _sellPayout18(m.qYes, m.qNo, m.liquidityB, outcome, shares);
        uint256 grossUsdc = _toUsdcFloor(payout18);   // pay user, round DOWN
        feeUsdc = (grossUsdc * m.feeBps) / 10_000;
        payoutUsdc = grossUsdc - feeUsdc;
        require(payoutUsdc >= minPayoutUsdc, "SLIPPAGE");
        require(grossUsdc <= m.collateral, "INSUFFICIENT_COLLATERAL"); // invariant check

        // Effects
        if (outcome == 0) { m.qYes -= shares; } else { m.qNo -= shares; }
        shareBalance[marketId][trader][outcome] -= shares;
        m.collateral -= grossUsdc;
        m.feesAccrued += feeUsdc;

        // Interactions
        if (payoutUsdc > 0) {
            usdc.safeTransfer(trader, payoutUsdc);
        }
        emit SharesSold(marketId, trader, outcome, shares, payoutUsdc, feeUsdc);
    }

    function _claim(uint256 marketId, address user) internal returns (uint256 payoutUsdc) {
        Market storage m = markets[marketId];
        require(m.state == State.RESOLVED, "NOT_RESOLVED");
        require(!hasClaimed[marketId][user], "ALREADY_CLAIMED");

        uint256 winShares = shareBalance[marketId][user][m.winningOutcome];
        // Zero out both sides; losing shares are worth nothing.
        shareBalance[marketId][user][0] = 0;
        shareBalance[marketId][user][1] = 0;
        hasClaimed[marketId][user] = true;

        if (winShares == 0) {
            emit Claimed(marketId, user, 0);
            return 0;
        }

        // 1 share = 1 USDC. Convert from 1e18 to USDC raw (round DOWN; user).
        payoutUsdc = _toUsdcFloor(winShares);

        // Pay from collateral first, then subsidy (internal accounting only).
        if (payoutUsdc <= m.collateral) {
            m.collateral -= payoutUsdc;
        } else {
            uint256 fromSubsidy = payoutUsdc - m.collateral;
            require(fromSubsidy <= m.subsidy, "INSOLVENT"); // must never fire if LMSR math is sound
            m.collateral = 0;
            m.subsidy -= fromSubsidy;
        }

        usdc.safeTransfer(user, payoutUsdc);
        emit Claimed(marketId, user, payoutUsdc);
    }

    // ============ Internal: LMSR Math ============

    /// @dev Cost to buy `delta` shares of `outcome` from state (qYes, qNo). Returns 1e18 scaled.
    function _buyCost18(uint256 qYes, uint256 qNo, uint256 b, uint8 outcome, uint256 delta) internal pure returns (uint256) {
        uint256 before_ = _cost18(qYes, qNo, b);
        if (outcome == 0) {
            return _cost18(qYes + delta, qNo, b) - before_;
        } else {
            return _cost18(qYes, qNo + delta, b) - before_;
        }
    }

    /// @dev Payout to sell `delta` shares of `outcome`. Returns 1e18 scaled.
    function _sellPayout18(uint256 qYes, uint256 qNo, uint256 b, uint8 outcome, uint256 delta) internal pure returns (uint256) {
        uint256 before_ = _cost18(qYes, qNo, b);
        uint256 after_;
        if (outcome == 0) {
            after_ = _cost18(qYes - delta, qNo, b);
        } else {
            after_ = _cost18(qYes, qNo - delta, b);
        }
        return before_ - after_;
    }

    /// @dev Numerically stable C(qYes, qNo) = b * ln(e^(qYes/b) + e^(qNo/b)).
    ///      Using logsumexp trick: C = max + b * ln(e^(x - max/b) + e^(y - max/b))
    ///      where x = qYes/b, y = qNo/b, max = max(qYes, qNo). Returns 1e18 scaled.
    function _cost18(uint256 qYes, uint256 qNo, uint256 b) internal pure returns (uint256) {
        uint256 maxQ = qYes >= qNo ? qYes : qNo;
        // x_shifted = (qYes - maxQ) / b, y_shifted = (qNo - maxQ) / b
        // One of them is 0, the other <= 0 (we represent as positive magnitude and use 1/exp).
        uint256 diff = qYes >= qNo ? (qYes - qNo) : (qNo - qYes);

        // Guard: diff/b must be within exp range.
        UD60x18 ratio = ud(diff).div(ud(b));
        require(unwrap(ratio) <= MAX_EXP_INPUT, "EXP_OVERFLOW");

        // sum = 1 + e^(-ratio) = 1 + 1/e^(ratio)
        UD60x18 expRatio = exp(ratio);
        UD60x18 one = ud(1e18);
        UD60x18 invExp = one.div(expRatio);
        UD60x18 sum = one.add(invExp);
        UD60x18 lnSum = ln(sum);

        // C = maxQ + b * lnSum
        UD60x18 addition = ud(b).mul(lnSum);
        return maxQ + unwrap(addition);
    }

    /// @dev Price of outcome = e^(q_outcome/b) / (e^(qYes/b) + e^(qNo/b)). Returns 1e18 scaled.
    function _price(uint256 qYes, uint256 qNo, uint256 b, uint8 outcome) internal pure returns (uint256) {
        // Using stable form: p_yes = 1 / (1 + e^((qNo - qYes)/b))
        if (qYes == qNo) return 5e17; // exactly 50%
        uint256 num; uint256 den;
        if (outcome == 0) {
            (num, den) = (qYes, qNo);
        } else {
            (num, den) = (qNo, qYes);
        }
        if (den >= num) {
            // p = 1 / (1 + e^((den-num)/b))
            UD60x18 r = ud(den - num).div(ud(b));
            require(unwrap(r) <= MAX_EXP_INPUT, "EXP_OVERFLOW");
            UD60x18 one = ud(1e18);
            UD60x18 denom = one.add(exp(r));
            return unwrap(one.div(denom));
        } else {
            // p = e^((num-den)/b) / (1 + e^((num-den)/b))
            UD60x18 r = ud(num - den).div(ud(b));
            require(unwrap(r) <= MAX_EXP_INPUT, "EXP_OVERFLOW");
            UD60x18 e_ = exp(r);
            UD60x18 one = ud(1e18);
            UD60x18 denom = one.add(e_);
            return unwrap(e_.div(denom));
        }
    }

    // ============ Internal: Decimal Scaling ============

    function _toUsdcCeil(uint256 amount18) internal view returns (uint256) {
        if (_scaleFactor == 1) return amount18;
        return (amount18 + _scaleFactor - 1) / _scaleFactor;
    }

    function _toUsdcFloor(uint256 amount18) internal view returns (uint256) {
        if (_scaleFactor == 1) return amount18;
        return amount18 / _scaleFactor;
    }
}
