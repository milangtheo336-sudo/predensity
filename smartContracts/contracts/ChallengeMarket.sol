// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ChallengeMarket
 * @notice 1v1 player-to-player parimutuel betting markets with manual resolution.
 *         Pools are split by side (PlayerA/PlayerB) and only the losing side
 *         funds platform/creator/winner bonuses. Copy-trading fees are taken
 *         only from winning copier profits.
 */
contract ChallengeMarket is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Side { None, PlayerA, PlayerB }
    enum MatchStatus { Open, Resolved, Disputed, Expired }

    uint16 public constant BPS_DENOM = 10000;
    uint16 public constant PLATFORM_FEE_BPS = 500; // 5% from losing side
    uint16 public constant EXPIRY_FEE_BPS = 1000; // 10% of total pool if match expires
    uint256 public constant RESPONSE_WINDOW = 6 hours;
    uint256 public constant MIN_EXPIRY_WINDOW = 24 hours;

    struct ResultSubmission {
        bool submitted;
        Side winner;
        uint64 submittedAt;
    }

    struct MatchInfo {
        address host;
        address playerA;
        address playerB;
        uint64 startTime;
        uint64 expiryTime;
        uint16 baseCutBps;      // creator/host cut from losing side
        uint16 winnerBonusBps;  // extra share to winning player from losing side
        uint16 copyFeeBps;      // 10-15% fee on copier profits (winning only)
        MatchStatus status;
        Side winner;
        uint256 poolA;
        uint256 poolB;
        uint256 totalWinningStake;
        uint256 losingPool;
        uint256 remainingLosingPool;
        uint256 platformFee;
        uint256 baseCut;
        uint256 winnerBonus;
        ResultSubmission submissionA;
        ResultSubmission submissionB;
        uint64 firstSubmissionTime;
        Side firstSubmittedWinner;
    }

    struct Bet {
        uint256 matchId;
        address bettor;
        Side side;
        uint256 amount;
        bool claimed;
        address copiedFrom;
    }

    IERC20 public immutable stakingToken;
    address public feeRecipient;
    uint256 public nextMatchId;
    uint256 public nextBetId;

    mapping(uint256 => MatchInfo) public matches;
    mapping(uint256 => Bet) public bets;

    event MatchCreated(
        uint256 indexed matchId,
        address indexed host,
        address indexed playerA,
        address playerB,
        uint64 startTime,
        uint64 expiryTime,
        uint16 baseCutBps,
        uint16 winnerBonusBps,
        uint16 copyFeeBps
    );
    event BetPlaced(uint256 indexed betId, uint256 indexed matchId, address indexed bettor, Side side, uint256 amount, address copiedFrom);
    event ResultSubmitted(uint256 indexed matchId, address indexed player, Side winner);
    event MatchResolved(uint256 indexed matchId, Side winner, uint256 losingPool, uint256 remainingLosingPool);
    event MatchDisputed(uint256 indexed matchId, Side playerAWinner, Side playerBWinner);
    event MatchExpired(uint256 indexed matchId, uint256 totalPool, uint256 expiryFee);
    event BetClaimed(uint256 indexed betId, uint256 payout, uint256 copyFee);
    event FeeRecipientUpdated(address indexed newRecipient);

    constructor(address _stakingToken, address _feeRecipient) {
        require(_stakingToken != address(0), "Invalid token");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        stakingToken = IERC20(_stakingToken);
        feeRecipient = _feeRecipient;
        _transferOwnership(msg.sender);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid fee recipient");
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    function createMatch(
        address playerA,
        address playerB,
        uint64 startTime,
        uint64 expiryTime,
        uint16 baseCutBps,
        uint16 winnerBonusBps,
        uint16 copyFeeBps
    ) external whenNotPaused returns (uint256 matchId) {
        require(playerA != address(0) && playerB != address(0), "Invalid players");
        require(playerA != playerB, "Players must differ");
        require(startTime > block.timestamp, "Start must be in future");
        require(expiryTime >= startTime + MIN_EXPIRY_WINDOW, "Expiry too soon");
        require(baseCutBps + winnerBonusBps + PLATFORM_FEE_BPS <= BPS_DENOM, "Fee bps too high");
        require(copyFeeBps >= 1000 && copyFeeBps <= 1500, "Copy fee out of range");

        matchId = nextMatchId++;
        MatchInfo storage m = matches[matchId];
        m.host = msg.sender;
        m.playerA = playerA;
        m.playerB = playerB;
        m.startTime = startTime;
        m.expiryTime = expiryTime;
        m.baseCutBps = baseCutBps;
        m.winnerBonusBps = winnerBonusBps;
        m.copyFeeBps = copyFeeBps;
        m.status = MatchStatus.Open;

        emit MatchCreated(matchId, msg.sender, playerA, playerB, startTime, expiryTime, baseCutBps, winnerBonusBps, copyFeeBps);
    }

    function placeBet(uint256 matchId, Side side, uint256 amount, address copiedFrom) external whenNotPaused nonReentrant returns (uint256 betId) {
        MatchInfo storage m = matches[matchId];
        require(m.status == MatchStatus.Open, "Match not open");
        require(block.timestamp < m.startTime, "Betting closed");
        require(side == Side.PlayerA || side == Side.PlayerB, "Invalid side");
        require(amount > 0, "Amount must be > 0");

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        if (side == Side.PlayerA) {
            m.poolA += amount;
        } else {
            m.poolB += amount;
        }

        betId = nextBetId++;
        bets[betId] = Bet({
            matchId: matchId,
            bettor: msg.sender,
            side: side,
            amount: amount,
            claimed: false,
            copiedFrom: copiedFrom
        });

        emit BetPlaced(betId, matchId, msg.sender, side, amount, copiedFrom);
    }

    function submitResult(uint256 matchId, Side winner) external whenNotPaused {
        MatchInfo storage m = matches[matchId];
        require(m.status == MatchStatus.Open, "Match not open");
        require(block.timestamp >= m.startTime, "Match not started");
        require(block.timestamp <= m.expiryTime, "Match expired");
        require(winner == Side.PlayerA || winner == Side.PlayerB, "Invalid winner");

        if (msg.sender == m.playerA) {
            require(!m.submissionA.submitted, "Already submitted");
            m.submissionA = ResultSubmission(true, winner, uint64(block.timestamp));
        } else if (msg.sender == m.playerB) {
            require(!m.submissionB.submitted, "Already submitted");
            m.submissionB = ResultSubmission(true, winner, uint64(block.timestamp));
        } else {
            revert("Only players can submit");
        }

        emit ResultSubmitted(matchId, msg.sender, winner);

        if (m.submissionA.submitted && m.submissionB.submitted) {
            if (m.submissionA.winner == m.submissionB.winner) {
                _resolveMatch(matchId, m.submissionA.winner);
            } else {
                m.status = MatchStatus.Disputed;
                emit MatchDisputed(matchId, m.submissionA.winner, m.submissionB.winner);
            }
            return;
        }

        if (m.firstSubmissionTime == 0) {
            m.firstSubmissionTime = uint64(block.timestamp);
            m.firstSubmittedWinner = winner;
        }
    }

    function finalizeAfterTimeout(uint256 matchId) external whenNotPaused {
        MatchInfo storage m = matches[matchId];
        require(m.status == MatchStatus.Open, "Match not open");
        require(m.firstSubmissionTime != 0, "No submission yet");
        require(block.timestamp >= m.firstSubmissionTime + RESPONSE_WINDOW, "Response window active");

        bool otherSubmitted = m.submissionA.submitted && m.submissionB.submitted;
        require(!otherSubmitted, "Both submitted");

        _resolveMatch(matchId, m.firstSubmittedWinner);
    }

    function resolveDispute(uint256 matchId, Side winner) external onlyOwner {
        MatchInfo storage m = matches[matchId];
        require(m.status == MatchStatus.Disputed, "Not disputed");
        require(winner == Side.PlayerA || winner == Side.PlayerB, "Invalid winner");
        _resolveMatch(matchId, winner);
    }

    function expireMatch(uint256 matchId) external whenNotPaused nonReentrant {
        MatchInfo storage m = matches[matchId];
        require(m.status == MatchStatus.Open, "Match not open");
        require(block.timestamp > m.expiryTime, "Not expired");
        require(!m.submissionA.submitted && !m.submissionB.submitted, "Submission exists");

        m.status = MatchStatus.Expired;

        uint256 totalPool = m.poolA + m.poolB;
        uint256 expiryFee = (totalPool * EXPIRY_FEE_BPS) / BPS_DENOM;
        if (expiryFee > 0) {
            stakingToken.safeTransfer(feeRecipient, expiryFee);
        }

        emit MatchExpired(matchId, totalPool, expiryFee);
    }

    function claimBet(uint256 betId) external whenNotPaused nonReentrant {
        Bet storage b = bets[betId];
        require(b.bettor == msg.sender, "Not bet owner");
        require(!b.claimed, "Already claimed");

        MatchInfo storage m = matches[b.matchId];

        if (m.status == MatchStatus.Expired) {
            uint256 refund = b.amount - ((b.amount * EXPIRY_FEE_BPS) / BPS_DENOM);
            b.claimed = true;
            stakingToken.safeTransfer(msg.sender, refund);
            emit BetClaimed(betId, refund, 0);
            return;
        }

        require(m.status == MatchStatus.Resolved, "Match not resolved");
        require(b.side == m.winner, "Not a winning bet");
        require(m.totalWinningStake > 0, "No winning pool");

        uint256 payout = b.amount + ((b.amount * m.remainingLosingPool) / m.totalWinningStake);
        uint256 profit = payout > b.amount ? (payout - b.amount) : 0;

        uint256 copyFee = 0;
        if (b.copiedFrom != address(0) && profit > 0 && m.copyFeeBps > 0) {
            copyFee = (profit * m.copyFeeBps) / BPS_DENOM;
            if (copyFee > 0) {
                stakingToken.safeTransfer(b.copiedFrom, copyFee);
                payout -= copyFee;
            }
        }

        b.claimed = true;
        stakingToken.safeTransfer(msg.sender, payout);
        emit BetClaimed(betId, payout, copyFee);
    }

    function _resolveMatch(uint256 matchId, Side winner) internal {
        MatchInfo storage m = matches[matchId];
        require(m.status == MatchStatus.Open || m.status == MatchStatus.Disputed, "Invalid status");

        m.status = MatchStatus.Resolved;
        m.winner = winner;

        uint256 winningPool = winner == Side.PlayerA ? m.poolA : m.poolB;
        uint256 losingPool = winner == Side.PlayerA ? m.poolB : m.poolA;
        m.totalWinningStake = winningPool;
        m.losingPool = losingPool;

        uint256 platformFee = (losingPool * PLATFORM_FEE_BPS) / BPS_DENOM;
        uint256 baseCut = (losingPool * m.baseCutBps) / BPS_DENOM;
        uint256 winnerBonus = (losingPool * m.winnerBonusBps) / BPS_DENOM;
        uint256 totalCuts = platformFee + baseCut + winnerBonus;
        require(totalCuts <= losingPool, "Cuts exceed losing pool");

        m.platformFee = platformFee;
        m.baseCut = baseCut;
        m.winnerBonus = winnerBonus;
        m.remainingLosingPool = losingPool - totalCuts;

        if (platformFee > 0) {
            stakingToken.safeTransfer(feeRecipient, platformFee);
        }
        if (baseCut > 0 && m.host != address(0)) {
            stakingToken.safeTransfer(m.host, baseCut);
        }
        if (winnerBonus > 0) {
            address winnerAddr = winner == Side.PlayerA ? m.playerA : m.playerB;
            stakingToken.safeTransfer(winnerAddr, winnerBonus);
        }

        if (m.totalWinningStake == 0 && m.remainingLosingPool > 0) {
            stakingToken.safeTransfer(feeRecipient, m.remainingLosingPool);
            m.remainingLosingPool = 0;
        }

        emit MatchResolved(matchId, winner, losingPool, m.remainingLosingPool);
    }
}
