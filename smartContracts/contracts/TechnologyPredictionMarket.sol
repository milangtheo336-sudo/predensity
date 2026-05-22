// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BasePredictionMarket.sol";

/**
 * @title TechnologyPredictionMarket
 * @dev Prediction market for technology/business outcomes with continuous ranges
 * @notice Users predict valuation ranges, user growth, revenue, stock prices
 * 
 * Example predictions:
 * - "Reddit IPO valuation will be $5B-$7B"
 * - "Stock price will be $45-$52 on first day"
 * - "Monthly active users will be 500M-600M"
 * - "Q4 revenue will be $2.5B-$3B"
 * - "App downloads will be 10M-15M"
 */
contract TechnologyPredictionMarket is BasePredictionMarket {
    // ==============================================================
    // |                    Enums & Structs                         |
    // ==============================================================
    
    enum PredictionType {
        IPO_VALUATION,        // Company valuation at IPO
        STOCK_PRICE,          // Stock price at specific time
        MARKET_CAP,           // Market capitalization
        REVENUE,              // Quarterly/Annual revenue
        USER_COUNT,           // Monthly/Daily active users
        APP_DOWNLOADS,        // Total app downloads
        GROWTH_RATE,          // Growth rate percentage (0-10000 BPS)
        PROFIT_MARGIN,        // Profit margin percentage (0-10000 BPS)
        CUSTOMER_COUNT,       // Total customers
        TRANSACTION_VOLUME    // Transaction volume/GMV
    }

    struct TechEvent {
        string eventName;           // e.g., "Reddit IPO", "Tesla Q4 Earnings"
        string company;
        PredictionType predType;
        uint256 eventTimestamp;
        bool resolved;
        uint256 actualValue;
        uint8 decimals;             // For currency/large numbers
    }

    // ==============================================================
    // |                    State Variables                         |
    // ==============================================================
    
    mapping(uint256 => TechEvent) public techEvents;
    mapping(uint256 => uint256) public betToEventId; // betId => eventId
    uint256 public nextEventId;

    // ==============================================================
    // |                    Events                                  |
    // ==============================================================
    
    event TechEventCreated(
        uint256 indexed eventId,
        string eventName,
        string company,
        PredictionType predType,
        uint256 eventTimestamp
    );
    
    event TechEventResolved(
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
    // |                    Tech-Specific Functions                 |
    // ==============================================================

    /**
     * @notice Create a new tech event for predictions
     * @param eventName Name of the tech event
     * @param company Company name
     * @param predType Type of prediction
     * @param eventTimestamp When the event occurs/is announced
     * @param decimals Number of decimals for value representation
     * @return eventId The ID of the created event
     */
    function createTechEvent(
        string memory eventName,
        string memory company,
        PredictionType predType,
        uint256 eventTimestamp,
        uint8 decimals
    ) external onlyOwner returns (uint256) {
        uint256 eventId = nextEventId++;
        
        techEvents[eventId] = TechEvent({
            eventName: eventName,
            company: company,
            predType: predType,
            eventTimestamp: eventTimestamp,
            resolved: false,
            actualValue: 0,
            decimals: decimals
        });

        emit TechEventCreated(eventId, eventName, company, predType, eventTimestamp);
        return eventId;
    }

    /**
     * @notice Place a bet on a tech event
     * @param eventId The tech event ID
     * @param rangeMin Minimum value in prediction range
     * @param rangeMax Maximum value in prediction range
     * @return betId The ID of the placed bet
     */
    function placeTechBet(
        uint256 eventId,
        uint256 rangeMin,
        uint256 rangeMax
    ) external payable returns (uint256) {
        require(eventId < nextEventId, "Event does not exist");
        TechEvent storage event_ = techEvents[eventId];
        require(!event_.resolved, "Event already resolved");
        require(event_.eventTimestamp > block.timestamp, "Event in past");

        // Validate range based on prediction type
        _validateTechRange(event_.predType, rangeMin, rangeMax);

        uint256 betId = placeBet(event_.eventTimestamp, rangeMin, rangeMax);
        betToEventId[betId] = eventId;
        
        return betId;
    }

    /**
     * @notice Submit tech event result from owner (centralized - scalable)
     * @param eventId The event ID to resolve
     * @param actualValue The actual outcome value
     */
    function submitTechResult(
        uint256 eventId,
        uint256 actualValue
    ) external onlyOwner {
        require(eventId < nextEventId, "Event does not exist");
        TechEvent storage event_ = techEvents[eventId];
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
        emit TechEventResolved(eventId, event_.eventName, actualValue);
    }

    /**
     * @notice Batch resolve multiple tech events (owner only - scalable)
     * @param eventIds Array of event IDs
     * @param actualValues Array of actual values
     */
    function batchResolveTechEvents(
        uint256[] calldata eventIds,
        uint256[] calldata actualValues
    ) external onlyOwner {
        require(eventIds.length == actualValues.length, "Lengths must match");
        
        for (uint256 i = 0; i < eventIds.length; i++) {
            require(eventIds[i] < nextEventId, "Event does not exist");
            TechEvent storage event_ = techEvents[eventIds[i]];
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
            emit TechEventResolved(eventIds[i], event_.eventName, actualValues[i]);
        }
    }

    /**
     * @notice Validate range based on prediction type
     */
    function _validateTechRange(
        PredictionType predType,
        uint256 rangeMin,
        uint256 rangeMax
    ) internal pure {
        if (predType == PredictionType.GROWTH_RATE ||
            predType == PredictionType.PROFIT_MARGIN) {
            // Percentage types: 0-10000 BPS (0-100%)
            // Note: Growth rate can exceed 100%, so we allow higher values
            require(rangeMax <= 50000, "Max cannot exceed 500%");
        }
        // Financial metrics have no specific upper bound
    }

    // ==============================================================
    // |                    View Functions                          |
    // ==============================================================

    /**
     * @notice Get tech event details
     */
    function getTechEvent(uint256 eventId) external view returns (
        string memory eventName,
        string memory company,
        PredictionType predType,
        uint256 eventTimestamp,
        bool resolved,
        uint256 actualValue,
        uint8 decimals
    ) {
        TechEvent storage event_ = techEvents[eventId];
        return (
            event_.eventName,
            event_.company,
            event_.predType,
            event_.eventTimestamp,
            event_.resolved,
            event_.actualValue,
            event_.decimals
        );
    }

    /**
     * @notice Get event ID for a bet
     */
    function getBetEventId(uint256 betId) external view returns (uint256) {
        return betToEventId[betId];
    }

    /**
     * @notice Get total number of tech events
     */
    function getTotalEvents() external view returns (uint256) {
        return nextEventId;
    }

    /**
     * @notice Get prediction type name as string
     */
    function getPredictionTypeName(PredictionType predType) external pure returns (string memory) {
        if (predType == PredictionType.IPO_VALUATION) return "IPO Valuation";
        if (predType == PredictionType.STOCK_PRICE) return "Stock Price";
        if (predType == PredictionType.MARKET_CAP) return "Market Cap";
        if (predType == PredictionType.REVENUE) return "Revenue";
        if (predType == PredictionType.USER_COUNT) return "User Count";
        if (predType == PredictionType.APP_DOWNLOADS) return "App Downloads";
        if (predType == PredictionType.GROWTH_RATE) return "Growth Rate";
        if (predType == PredictionType.PROFIT_MARGIN) return "Profit Margin";
        if (predType == PredictionType.CUSTOMER_COUNT) return "Customer Count";
        if (predType == PredictionType.TRANSACTION_VOLUME) return "Transaction Volume";
        return "Unknown";
    }

    /**
     * @notice Format value with decimals
     * @param value Value in smallest unit
     * @param decimals Number of decimal places
     * @return Formatted value string
     */
    function formatValue(uint256 value, uint8 decimals) external pure returns (string memory) {
        if (decimals == 0) {
            return _uint2str(value);
        }
        
        uint256 divisor = 10 ** decimals;
        uint256 wholePart = value / divisor;
        uint256 fractionalPart = value % divisor;
        
        return string(abi.encodePacked(
            _uint2str(wholePart),
            ".",
            _uint2str(fractionalPart)
        ));
    }

    /**
     * @notice Format currency value (USD)
     * @param value Value in cents (2 decimals)
     * @return Formatted currency string
     */
    function formatCurrency(uint256 value) external pure returns (string memory) {
        uint256 dollars = value / 100;
        uint256 cents = value % 100;
        
        return string(abi.encodePacked(
            "$",
            _uint2str(dollars),
            ".",
            cents < 10 ? "0" : "",
            _uint2str(cents)
        ));
    }

    /**
     * @notice Format large numbers with suffixes (K, M, B, T)
     * @param value The value to format
     * @return Formatted string with suffix
     */
    function formatLargeNumber(uint256 value) external pure returns (string memory) {
        if (value >= 1e12) {
            return string(abi.encodePacked(_uint2str(value / 1e12), "T"));
        } else if (value >= 1e9) {
            return string(abi.encodePacked(_uint2str(value / 1e9), "B"));
        } else if (value >= 1e6) {
            return string(abi.encodePacked(_uint2str(value / 1e6), "M"));
        } else if (value >= 1e3) {
            return string(abi.encodePacked(_uint2str(value / 1e3), "K"));
        }
        return _uint2str(value);
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
