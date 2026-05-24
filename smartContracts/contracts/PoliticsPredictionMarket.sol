// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BasePredictionMarket.sol";

/**
 * @title PoliticsPredictionMarket
 * @dev Prediction market for political outcomes with continuous ranges
 * @notice Users predict percentage ranges, vote counts, or poll numbers
 * 
 * Example predictions:
 * - "Trump will get 45-48% of popular vote"
 * - "Winner will get 280-310 electoral votes"
 * - "Approval rating will be 52-56%"
 * - "Voter turnout will be 62-65%"
 */
contract PoliticsPredictionMarket is BasePredictionMarket {
    // ==============================================================
    // |                    Enums & Structs                         |
    // ==============================================================
    
    enum PredictionType {
        VOTE_PERCENTAGE,      // Popular vote percentage (0-10000 BPS)
        ELECTORAL_VOTES,      // Electoral vote count (0-538)
        APPROVAL_RATING,      // Approval rating percentage (0-10000 BPS)
        POLL_AVERAGE,         // Poll average percentage (0-10000 BPS)
        VOTER_TURNOUT,        // Voter turnout percentage (0-10000 BPS)
        SEAT_COUNT,           // Congressional/Parliamentary seats
        DELEGATE_COUNT        // Convention delegates
    }

    struct PoliticalEvent {
        string eventName;           // e.g., "2024 US Presidential Election"
        string candidate;           // e.g., "Donald Trump", "Joe Biden"
        PredictionType predType;
        uint256 eventTimestamp;
        bool resolved;
        uint256 actualValue;
    }

    // ==============================================================
    // |                    State Variables                         |
    // ==============================================================
    
    mapping(uint256 => PoliticalEvent) public politicalEvents;
    mapping(uint256 => uint256) public betToEventId; // betId => eventId
    uint256 public nextEventId;

    // ==============================================================
    // |                    Events                                  |
    // ==============================================================
    
    event PoliticalEventCreated(
        uint256 indexed eventId,
        string eventName,
        string candidate,
        PredictionType predType,
        uint256 eventTimestamp
    );
    
    event PoliticalEventResolved(
        uint256 indexed eventId,
        string eventName,
        uint256 actualValue
    );

    // ==============================================================
    // |                    Constructor                             |
    // ==============================================================
    
    /**
     * @param _stakingToken ERC-20 token for stakes (USDC on Arc)
     */
    constructor(address _stakingToken) BasePredictionMarket(_stakingToken) {}

    // ==============================================================
    // |                    Politics-Specific Functions             |
    // ==============================================================

    /**
     * @notice Create a new political event for predictions
     * @param eventName Name of the political event
     * @param candidate Candidate or subject name
     * @param predType Type of prediction
     * @param eventTimestamp When the event occurs
     * @return eventId The ID of the created event
     */
    function createPoliticalEvent(
        string memory eventName,
        string memory candidate,
        PredictionType predType,
        uint256 eventTimestamp
    ) external onlyOwner returns (uint256) {
        uint256 eventId = nextEventId++;
        
        politicalEvents[eventId] = PoliticalEvent({
            eventName: eventName,
            candidate: candidate,
            predType: predType,
            eventTimestamp: eventTimestamp,
            resolved: false,
            actualValue: 0
        });

        emit PoliticalEventCreated(eventId, eventName, candidate, predType, eventTimestamp);
        return eventId;
    }

    /**
     * @notice Place a bet on a political event
     * @param eventId The political event ID
     * @param rangeMin Minimum value in prediction range
     * @param rangeMax Maximum value in prediction range
     * @return betId The ID of the placed bet
     */
    function placePoliticalBet(
        uint256 eventId,
        uint256 rangeMin,
        uint256 rangeMax
    ) external payable returns (uint256) {
        require(eventId < nextEventId, "Event does not exist");
        PoliticalEvent storage event_ = politicalEvents[eventId];
        require(!event_.resolved, "Event already resolved");
        require(event_.eventTimestamp > block.timestamp, "Event in past");

        // Validate range based on prediction type
        _validatePoliticalRange(event_.predType, rangeMin, rangeMax);

        uint256 betId = placeBet(event_.eventTimestamp, rangeMin, rangeMax);
        betToEventId[betId] = eventId;
        
        return betId;
    }

    /**
     * @notice Submit political event result from owner (centralized - scalable)
     * @param eventId The event ID to resolve
     * @param actualValue The actual outcome value
     */
    function submitPoliticalResult(
        uint256 eventId,
        uint256 actualValue
    ) external onlyOwner {
        require(eventId < nextEventId, "Event does not exist");
        PoliticalEvent storage event_ = politicalEvents[eventId];
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
        emit PoliticalEventResolved(eventId, event_.eventName, actualValue);
    }

    /**
     * @notice Batch resolve multiple political events (owner only - scalable)
     * @param eventIds Array of event IDs
     * @param actualValues Array of actual values
     */
    function batchResolvePoliticalEvents(
        uint256[] calldata eventIds,
        uint256[] calldata actualValues
    ) external onlyOwner {
        require(eventIds.length == actualValues.length, "Lengths must match");
        
        for (uint256 i = 0; i < eventIds.length; i++) {
            require(eventIds[i] < nextEventId, "Event does not exist");
            PoliticalEvent storage event_ = politicalEvents[eventIds[i]];
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
            emit PoliticalEventResolved(eventIds[i], event_.eventName, actualValues[i]);
        }
    }

    /**
     * @notice Validate range based on prediction type
     */
    function _validatePoliticalRange(
        PredictionType predType,
        uint256 rangeMin,
        uint256 rangeMax
    ) internal pure {
        if (predType == PredictionType.VOTE_PERCENTAGE ||
            predType == PredictionType.APPROVAL_RATING ||
            predType == PredictionType.POLL_AVERAGE ||
            predType == PredictionType.VOTER_TURNOUT) {
            // Percentage types: 0-10000 BPS (0-100%)
            require(rangeMax <= 10000, "Max cannot exceed 100%");
        } else if (predType == PredictionType.ELECTORAL_VOTES) {
            // US Electoral votes: 0-538
            require(rangeMax <= 538, "Max cannot exceed 538");
        }
        // Other types have no specific upper bound
    }

    // ==============================================================
    // |                    View Functions                          |
    // ==============================================================

    /**
     * @notice Get political event details
     */
    function getPoliticalEvent(uint256 eventId) external view returns (
        string memory eventName,
        string memory candidate,
        PredictionType predType,
        uint256 eventTimestamp,
        bool resolved,
        uint256 actualValue
    ) {
        PoliticalEvent storage event_ = politicalEvents[eventId];
        return (
            event_.eventName,
            event_.candidate,
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
     * @notice Get total number of political events
     */
    function getTotalEvents() external view returns (uint256) {
        return nextEventId;
    }

    /**
     * @notice Format percentage value to human-readable string
     * @param bpsValue Value in basis points (0-10000)
     * @return Formatted percentage string
     */
    function formatPercentage(uint256 bpsValue) external pure returns (string memory) {
        require(bpsValue <= 10000, "Invalid BPS value");
        uint256 wholePart = bpsValue / 100;
        uint256 fractionalPart = bpsValue % 100;
        
        return string(abi.encodePacked(
            _uint2str(wholePart),
            ".",
            _uint2str(fractionalPart),
            "%"
        ));
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
