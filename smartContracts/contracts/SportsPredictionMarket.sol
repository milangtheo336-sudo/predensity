// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BasePredictionMarket.sol";

/**
 * @title SportsPredictionMarket
 * @dev Prediction market for sports outcomes with continuous ranges
 * @notice Users predict score ranges, point differentials, player stats
 * 
 * Example predictions:
 * - "Final score will be 95-105 points"
 * - "Point differential will be 5-10 points"
 * - "Player will score 25-30 points"
 * - "Total goals will be 2-4"
 * - "Team possession will be 55-60%"
 */
contract SportsPredictionMarket is BasePredictionMarket {
    // ==============================================================
    // |                    Enums & Structs                         |
    // ==============================================================
    
    enum PredictionType {
        FINAL_SCORE,          // Total points/goals scored
        POINT_DIFFERENTIAL,   // Margin of victory
        PLAYER_POINTS,        // Individual player scoring
        PLAYER_ASSISTS,       // Individual player assists
        PLAYER_REBOUNDS,      // Individual player rebounds
        TEAM_POSSESSION,      // Possession percentage (0-10000 BPS)
        SHOTS_ON_GOAL,        // Number of shots on goal
        TOTAL_GOALS,          // Total goals in match
        TOTAL_YARDS,          // Total yards (football)
        COMPLETION_PERCENTAGE // QB completion % (0-10000 BPS)
    }

    enum SportType {
        BASKETBALL,
        FOOTBALL_AMERICAN,
        FOOTBALL_SOCCER,
        BASEBALL,
        HOCKEY,
        TENNIS,
        OTHER
    }

    struct SportsEvent {
        string eventName;           // e.g., "Lakers vs Warriors"
        string team1;
        string team2;
        string player;              // For player-specific predictions
        SportType sport;
        PredictionType predType;
        uint256 eventTimestamp;
        bool resolved;
        uint256 actualValue;
    }

    // ==============================================================
    // |                    State Variables                         |
    // ==============================================================
    
    mapping(uint256 => SportsEvent) public sportsEvents;
    mapping(uint256 => uint256) public betToEventId; // betId => eventId
    uint256 public nextEventId;

    // ==============================================================
    // |                    Events                                  |
    // ==============================================================
    
    event SportsEventCreated(
        uint256 indexed eventId,
        string eventName,
        SportType sport,
        PredictionType predType,
        uint256 eventTimestamp
    );
    
    event SportsEventResolved(
        uint256 indexed eventId,
        string eventName,
        uint256 actualValue
    );

    // ==============================================================
    // |                    Constructor                             |
    // ==============================================================
    
    /**
     * @param _stakingToken ERC-20 token for stakes (address(0) = native HBAR mode)
     */
    constructor(address _stakingToken) BasePredictionMarket(_stakingToken) {}

    // ==============================================================
    // |                    Sports-Specific Functions               |
    // ==============================================================

    /**
     * @notice Create a new sports event for predictions
     * @param eventName Name of the sports event
     * @param team1 First team name
     * @param team2 Second team name
     * @param player Player name (empty if team prediction)
     * @param sport Type of sport
     * @param predType Type of prediction
     * @param eventTimestamp When the event occurs
     * @return eventId The ID of the created event
     */
    function createSportsEvent(
        string memory eventName,
        string memory team1,
        string memory team2,
        string memory player,
        SportType sport,
        PredictionType predType,
        uint256 eventTimestamp
    ) external onlyOwner returns (uint256) {
        uint256 eventId = nextEventId++;
        
        sportsEvents[eventId] = SportsEvent({
            eventName: eventName,
            team1: team1,
            team2: team2,
            player: player,
            sport: sport,
            predType: predType,
            eventTimestamp: eventTimestamp,
            resolved: false,
            actualValue: 0
        });

        emit SportsEventCreated(eventId, eventName, sport, predType, eventTimestamp);
        return eventId;
    }

    /**
     * @notice Place a bet on a sports event
     * @param eventId The sports event ID
     * @param rangeMin Minimum value in prediction range
     * @param rangeMax Maximum value in prediction range
     * @return betId The ID of the placed bet
     */
    function placeSportsBet(
        uint256 eventId,
        uint256 rangeMin,
        uint256 rangeMax
    ) external payable returns (uint256) {
        require(eventId < nextEventId, "Event does not exist");
        SportsEvent storage event_ = sportsEvents[eventId];
        require(!event_.resolved, "Event already resolved");
        require(event_.eventTimestamp > block.timestamp, "Event in past");

        // Validate range based on prediction type
        _validateSportsRange(event_.predType, rangeMin, rangeMax);

        uint256 betId = placeBet(event_.eventTimestamp, rangeMin, rangeMax);
        betToEventId[betId] = eventId;
        
        return betId;
    }

    /**
     * @notice Submit sports event result from owner (centralized - scalable)
     * @param eventId The event ID to resolve
     * @param actualValue The actual outcome value
     */
    function submitSportsResult(
        uint256 eventId,
        uint256 actualValue
    ) external onlyOwner {
        require(eventId < nextEventId, "Event does not exist");
        SportsEvent storage event_ = sportsEvents[eventId];
        require(!event_.resolved, "Already resolved");
        require(event_.eventTimestamp <= block.timestamp, "Event not occurred");
        require(actualValue > 0, "Value must be positive");

        // Directly set resolved value (centralized)
        resolvedValues[event_.eventTimestamp] = actualValue;
        isResolved[event_.eventTimestamp] = true;
        
        // Mark event as resolved
        event_.resolved = true;
        event_.actualValue = actualValue;
        
        emit ValueResolved(event_.eventTimestamp, actualValue, 1);
        emit SportsEventResolved(eventId, event_.eventName, actualValue);
    }

    /**
     * @notice Batch resolve multiple sports events (owner only - scalable)
     * @param eventIds Array of event IDs
     * @param actualValues Array of actual values
     */
    function batchResolveSportsEvents(
        uint256[] calldata eventIds,
        uint256[] calldata actualValues
    ) external onlyOwner {
        require(eventIds.length == actualValues.length, "Lengths must match");
        
        for (uint256 i = 0; i < eventIds.length; i++) {
            require(eventIds[i] < nextEventId, "Event does not exist");
            SportsEvent storage event_ = sportsEvents[eventIds[i]];
            require(!event_.resolved, "Already resolved");
            require(event_.eventTimestamp <= block.timestamp, "Event not occurred");
            require(actualValues[i] > 0, "Value must be positive");

            // Directly set resolved value
            resolvedValues[event_.eventTimestamp] = actualValues[i];
            isResolved[event_.eventTimestamp] = true;
            
            // Mark event as resolved
            event_.resolved = true;
            event_.actualValue = actualValues[i];
            
            emit ValueResolved(event_.eventTimestamp, actualValues[i], 1);
            emit SportsEventResolved(eventIds[i], event_.eventName, actualValues[i]);
        }
    }

    /**
     * @notice Validate range based on prediction type
     */
    function _validateSportsRange(
        PredictionType predType,
        uint256 rangeMin,
        uint256 rangeMax
    ) internal pure {
        if (predType == PredictionType.TEAM_POSSESSION ||
            predType == PredictionType.COMPLETION_PERCENTAGE) {
            // Percentage types: 0-10000 BPS (0-100%)
            require(rangeMax <= 10000, "Max cannot exceed 100%");
        }
        // Score-based predictions have no specific upper bound
        // but we can add sport-specific validation if needed
    }

    // ==============================================================
    // |                    View Functions                          |
    // ==============================================================

    /**
     * @notice Get sports event details
     */
    function getSportsEvent(uint256 eventId) external view returns (
        string memory eventName,
        string memory team1,
        string memory team2,
        string memory player,
        SportType sport,
        PredictionType predType,
        uint256 eventTimestamp,
        bool resolved,
        uint256 actualValue
    ) {
        SportsEvent storage event_ = sportsEvents[eventId];
        return (
            event_.eventName,
            event_.team1,
            event_.team2,
            event_.player,
            event_.sport,
            event_.predType,
            event_.eventTimestamp,
            event_.resolved,
            event_.actualValue
        );
    }

    /**
     * @notice Get event ID for a bet
     */
    function getBetEventId(uint256 betId) external view returns (uint256) {
        return betToEventId[betId];
    }

    /**
     * @notice Get total number of sports events
     */
    function getTotalEvents() external view returns (uint256) {
        return nextEventId;
    }

    /**
     * @notice Get sport type name as string
     */
    function getSportTypeName(SportType sport) external pure returns (string memory) {
        if (sport == SportType.BASKETBALL) return "Basketball";
        if (sport == SportType.FOOTBALL_AMERICAN) return "American Football";
        if (sport == SportType.FOOTBALL_SOCCER) return "Soccer";
        if (sport == SportType.BASEBALL) return "Baseball";
        if (sport == SportType.HOCKEY) return "Hockey";
        if (sport == SportType.TENNIS) return "Tennis";
        return "Other";
    }

    /**
     * @notice Get prediction type name as string
     */
    function getPredictionTypeName(PredictionType predType) external pure returns (string memory) {
        if (predType == PredictionType.FINAL_SCORE) return "Final Score";
        if (predType == PredictionType.POINT_DIFFERENTIAL) return "Point Differential";
        if (predType == PredictionType.PLAYER_POINTS) return "Player Points";
        if (predType == PredictionType.PLAYER_ASSISTS) return "Player Assists";
        if (predType == PredictionType.PLAYER_REBOUNDS) return "Player Rebounds";
        if (predType == PredictionType.TEAM_POSSESSION) return "Team Possession %";
        if (predType == PredictionType.SHOTS_ON_GOAL) return "Shots on Goal";
        if (predType == PredictionType.TOTAL_GOALS) return "Total Goals";
        if (predType == PredictionType.TOTAL_YARDS) return "Total Yards";
        if (predType == PredictionType.COMPLETION_PERCENTAGE) return "Completion %";
        return "Unknown";
    }

    /**
     * @notice Helper function to convert uint to string
     */
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
