# 🔥 Predensity Prediction Market - Smart Contracts

> **A sophisticated prediction market built on Arc (EVM) using dual development frameworks**

[![Solidity](https://img.shields.io/badge/Solidity-0.8.0+-blue.svg)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.12.6-orange.svg)](https://hardhat.org/)
[![Foundry](https://img.shields.io/badge/Foundry-Latest-red.svg)](https://getfoundry.sh/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-4.1.0-green.svg)](https://openzeppelin.com/)

## 🚀 Overview

This repository contains the smart contracts for a **quality-weighted prediction market** where users can bet on future crypto prices. Built with enterprise-grade security and deployed on the Arc network (chain ID 5042002).

## 🌐 Live Deployments

Contracts are deployed on Arc mainnet. See `contract-config.ts` in the frontend for current addresses.

## 🏗 Architecture

- **BasePredictionMarket.sol** — Core prediction market logic (DPM-based pricing)
- **CryptoPredictionMarket.sol** — Crypto-specific market with Chainlink price feeds
- **MarketManager.sol** — Multi-category market management
- **ExchangeSettlement.sol** — Exchange settlement (operator + EIP-712 signed trades)
- **SimpleProxyWallet.sol** — Proxy wallet for gasless UX

## 🛠 Development

```bash
# Hardhat
npx hardhat test
npx hardhat compile

# Foundry
cd foundry
forge build
forge test
```

## 📦 Dependencies

- OpenZeppelin Contracts 4.x
- Hardhat 2.12+
- Foundry (latest)
