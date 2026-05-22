// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockOracle
 * @dev A simple mock oracle for testing the prediction market
 */
contract MockOracle is Ownable {
    mapping(uint256 => uint256) public prices;  // timestamp => price
    mapping(uint256 => bool) public priceSet;   // timestamp => whether price is set
    
    event PriceSet(uint256 indexed timestamp, uint256 price);
    
    constructor() {}
    
    /**
     * @notice Set a price for a specific timestamp (only owner)
     * @param timestamp The timestamp for the price
     * @param price The price in BPS
     */
    function setPrice(uint256 timestamp, uint256 price) external onlyOwner {
        require(price > 0, "Price must be positive");
        prices[timestamp] = price;
        priceSet[timestamp] = true;
        emit PriceSet(timestamp, price);
    }
    
    /**
     * @notice Get the price for a specific timestamp
     * @param timestamp The timestamp to get price for
     * @return price The price in BPS
     */
    function getPrice(uint256 timestamp) external view returns (uint256) {
        require(priceSet[timestamp], "Price not set for timestamp");
        return prices[timestamp];
    }
    
    /**
     * @notice Check if price is set for a timestamp
     * @param timestamp The timestamp to check
     * @return True if price is set
     */
    function isPriceSet(uint256 timestamp) external view returns (bool) {
        return priceSet[timestamp];
    }
} 