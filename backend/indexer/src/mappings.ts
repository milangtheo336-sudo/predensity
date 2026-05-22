import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  BetPlaced,
  BetClaimed,
  FeeCollected,
  AggregationCompleted,
  BucketPriceSet,
  BatchProcessed,
  SharesSold,
  CryptoPredictionMarket
} from "../generated/CryptoPredictionMarket/CryptoPredictionMarket"

import {
  BetPlaced as BaseBetPlaced,
  BetClaimed as BaseBetClaimed,
  FeeCollected as BaseFeeCollected,
  AggregationCompleted as BaseAggregationCompleted,
  BucketValueSet as BaseBucketPriceSet,
  BatchProcessed as BaseBatchProcessed,
  SharesSold as BaseSharesSold,
} from "../generated/PoliticsPredictionMarket/BasePredictionMarket"

import { User, UserStats, Market, Bet, Fee, Bucket, PriceAtTimestamp } from "../generated/schema"

const ZERO = BigInt.zero()

function getCategoryFromAddress(contractAddress: Address): string {
  let addr = contractAddress.toHexString().toLowerCase()
  
  // Crypto: 0x0DE38B6eCBb09eF05584C9607EE941D4938D1da8 (0.0.8232723)
  if (addr == "0x0de38b6ecbb09ef05584c9607ee941d4938d1da8") return "CRYPTO"
  
  // Politics: 0xA6fcFd8010C0e135aB53936a125e7d57f58edcD8 (0.0.8232724)
  if (addr == "0xa6fcfd8010c0e135ab53936a125e7d57f58edcd8") return "POLITICS"
  
  // Sports: 0x8f62C698a26888424b5170a11610Fa5Fd7DF540b (0.0.8232726)
  if (addr == "0x8f62c698a26888424b5170a11610fa5fd7df540b") return "SPORTS"
  
  // Technology: 0x76bFfEff52b9c515fF2CAdF471Df6915A6766dB8 (0.0.8232727)
  if (addr == "0x76bffeff52b9c515ff2cadf471df6915a6766db8") return "TECHNOLOGY"
  
  return "CRYPTO" // Default fallback
}

function getOrCreateMarket(contractAddress: Address): Market {
  let id = contractAddress.toHexString()
  let market = Market.load(id)
  
  if (!market) {
    market = new Market(id)
    market.category = getCategoryFromAddress(contractAddress)
    market.contractAddress = contractAddress
    market.totalBets = 0
    market.totalVolume = ZERO
    market.totalFees = ZERO
    market.save()
  }
  
  return market as Market
}

function getOrCreateUserAndStats(address: Address): UserStats {
  let id = address.toHexString()

  let stats = UserStats.load(id)
  if (!stats) {
    stats = new UserStats(id)
    stats.totalBets = 0
    stats.totalWon = 0
    stats.totalStaked = ZERO
    stats.totalPayout = ZERO
    stats.save()
  }
  
  let user = User.load(id)
  if (!user) {
    user = new User(id)
    user.stats = stats.id
    user.totalBets = 0
    user.save()
  } else {
    if (user.stats == null) {
      user.stats = stats.id
      user.save()
    }
  }

  return stats as UserStats
}

function incrementUserWon(userId: string): void {
  let stats = UserStats.load(userId)
  if (!stats) return
  stats.totalWon += 1
  stats.save()
}

function addUserPayout(userId: string, payout: BigInt): void {
  let stats = UserStats.load(userId)
  if (!stats) return
  stats.totalPayout = stats.totalPayout.plus(payout)
  stats.save()
}

function getOrCreateBucket(bucketId: string, marketId: string): Bucket {
  let bucket = Bucket.load(bucketId)
  if (!bucket) {
    bucket = new Bucket(bucketId)
    bucket.market = marketId
    bucket.totalBets = 0
    bucket.totalStaked = ZERO
    bucket.aggregationComplete = false
    bucket.totalWinningWeight = ZERO
    bucket.nextProcessIndex = 0
    bucket.expectedPayoutsComputed = false
    bucket.totalExited = ZERO
    bucket.betIds = []
    bucket.save()
  }
  return bucket as Bucket
}

function computeExpectedPayouts(bucket: Bucket): void {
  if (!bucket.aggregationComplete) return
  if (bucket.totalWinningWeight.le(ZERO)) return
  if (bucket.totalStaked.le(ZERO)) return

  // Effective pool = totalStaked minus what was paid out via early exits
  let effectivePool = bucket.totalStaked.minus(bucket.totalExited)
  if (effectivePool.le(ZERO)) return

  let ids = bucket.betIds
  for (let i = 0; i < ids.length; i++) {
    let bet = Bet.load(ids[i])
    if (!bet) continue

    // Exited bets get no resolution payout
    if (bet.exited) {
      bet.expectedPayout = ZERO
      bet.save()
      continue
    }

    if (bet.won) {
      bet.expectedPayout = bet.weight.times(effectivePool).div(bucket.totalWinningWeight)
    } else {
      bet.expectedPayout = ZERO
    }

    bet.save()
  }
}

export function handleBetPlaced(event: BetPlaced): void {
  let market = getOrCreateMarket(event.address)
  let stats = getOrCreateUserAndStats(event.params.bettor)

  let contract = CryptoPredictionMarket.bind(event.address)
  let betResult = contract.try_getBet(event.params.betId)
  if (betResult.reverted) return
  let betData = betResult.value

  // Calculate bucket from targetTimestamp for CryptoPredictionMarket
  // bucket = (targetTimestamp - startTimestamp) / SECONDS_PER_DAY
  let startTimestampResult = contract.try_startTimestamp()
  if (startTimestampResult.reverted) return
  let startTimestamp = startTimestampResult.value
  let SECONDS_PER_DAY = BigInt.fromI32(86400)
  let bucket = betData.targetTimestamp.minus(startTimestamp).div(SECONDS_PER_DAY)

  let betId = `${market.id}-${event.params.betId.toString()}`
  let bucketId = `${market.id}-${bucket.toString()}`
  let bucketObj = getOrCreateBucket(bucketId, market.id)

  bucketObj.betIds = bucketObj.betIds.concat([betId])
  bucketObj.totalBets += 1
  bucketObj.totalStaked = bucketObj.totalStaked.plus(betData.stake)
  bucketObj.save()

  let bet = new Bet(betId)
  bet.user = event.params.bettor.toHexString()
  bet.market = market.id
  bet.bucket = bucket.toI32()
  bet.bucketRef = bucketId

  bet.stake = betData.stake
  bet.priceMin = betData.priceMin
  bet.priceMax = betData.priceMax
  bet.targetTimestamp = betData.targetTimestamp
  bet.qualityBps = betData.qualityBps
  bet.weight = betData.weight

  bet.asset = event.params.asset

  bet.finalized = betData.finalized
  bet.claimed = betData.claimed
  bet.actualPrice = betData.actualPrice
  bet.won = betData.won

  bet.payout = ZERO
  bet.expectedPayout = ZERO
  bet.wonCounted = false

  // DPM fields
  bet.entryBandWeight = betData.entryBandWeight
  bet.exited = betData.exited
  bet.exitPayout = ZERO
  bet.exitFee = ZERO

  bet.blockNumber = event.block.number
  bet.timestamp = event.block.timestamp
  bet.transactionHash = event.transaction.hash

  bet.save()

  let user = User.load(event.params.bettor.toHexString())
  if (user) {
    user.totalBets += 1
    user.save()
  }

  stats.totalBets += 1
  stats.totalStaked = stats.totalStaked.plus(bet.stake)
  stats.save()

  market.totalBets += 1
  market.totalVolume = market.totalVolume.plus(bet.stake)
  market.save()
}

// Handler for politics/sports/tech contracts (BasePredictionMarket events).
// These contracts emit BetPlaced with a bucket param instead of asset,
// and the event signature differs from CryptoPredictionMarket.
export function handleBaseBetPlaced(event: BaseBetPlaced): void {
  let market = getOrCreateMarket(event.address)
  let stats = getOrCreateUserAndStats(event.params.bettor)

  // All contracts share the same getBet ABI from BasePredictionMarket
  let contract = CryptoPredictionMarket.bind(event.address)
  let betResult = contract.try_getBet(event.params.betId)
  if (betResult.reverted) return
  let betData = betResult.value

  // Bucket comes directly from the event params for base contracts
  let bucket = event.params.bucket

  let betId = `${market.id}-${event.params.betId.toString()}`
  let bucketId = `${market.id}-${bucket.toString()}`
  let bucketObj = getOrCreateBucket(bucketId, market.id)

  bucketObj.betIds = bucketObj.betIds.concat([betId])
  bucketObj.totalBets += 1
  bucketObj.totalStaked = bucketObj.totalStaked.plus(betData.stake)
  bucketObj.save()

  let bet = new Bet(betId)
  bet.user = event.params.bettor.toHexString()
  bet.market = market.id
  bet.bucket = bucket.toI32()
  bet.bucketRef = bucketId

  bet.stake = betData.stake
  bet.priceMin = betData.priceMin
  bet.priceMax = betData.priceMax
  bet.targetTimestamp = betData.targetTimestamp
  bet.qualityBps = betData.qualityBps
  bet.weight = betData.weight

  // No asset field on base contracts -- use the market category
  bet.asset = getCategoryFromAddress(event.address)

  bet.finalized = betData.finalized
  bet.claimed = betData.claimed
  bet.actualPrice = betData.actualPrice
  bet.won = betData.won

  bet.payout = ZERO
  bet.expectedPayout = ZERO
  bet.wonCounted = false

  // DPM fields
  bet.entryBandWeight = betData.entryBandWeight
  bet.exited = betData.exited
  bet.exitPayout = ZERO
  bet.exitFee = ZERO

  bet.blockNumber = event.block.number
  bet.timestamp = event.block.timestamp
  bet.transactionHash = event.transaction.hash

  bet.save()

  let user = User.load(event.params.bettor.toHexString())
  if (user) {
    user.totalBets += 1
    user.save()
  }

  stats.totalBets += 1
  stats.totalStaked = stats.totalStaked.plus(bet.stake)
  stats.save()

  market.totalBets += 1
  market.totalVolume = market.totalVolume.plus(bet.stake)
  market.save()
}

// Handler for base contract BetClaimed (same signature, different generated type)
export function handleBaseBetClaimed(event: BaseBetClaimed): void {
  let market = getOrCreateMarket(event.address)
  let betId = `${market.id}-${event.params.betId.toString()}`
  let bet = Bet.load(betId)
  if (!bet) return

  bet.claimed = true
  bet.payout = event.params.payout
  bet.save()

  if (bet.won && !bet.wonCounted) {
    bet.wonCounted = true
    bet.save()
    incrementUserWon(bet.user)
  }

  if (event.params.payout.gt(ZERO)) {
    addUserPayout(event.params.bettor.toHexString(), event.params.payout)
  }
}

// Handler for base contract FeeCollected
export function handleBaseFeeCollected(event: BaseFeeCollected): void {
  let market = getOrCreateMarket(event.address)
  let id = `${market.id}-${event.transaction.hash.toHex()}-${event.logIndex.toString()}`
  let fee = new Fee(id)

  fee.market = market.id
  fee.amount = event.params.amount
  fee.blockNumber = event.block.number
  fee.timestamp = event.block.timestamp
  fee.transactionHash = event.transaction.hash

  fee.save()

  market.totalFees = market.totalFees.plus(event.params.amount)
  market.save()
}

// Handler for base contract AggregationCompleted
export function handleBaseAggregationCompleted(event: BaseAggregationCompleted): void {
  let market = getOrCreateMarket(event.address)
  let bucketId = `${market.id}-${event.params.bucket.toString()}`
  let bucket = Bucket.load(bucketId)
  if (!bucket) {
    bucket = getOrCreateBucket(bucketId, market.id)
  }

  bucket.aggregationComplete = true
  bucket.totalWinningWeight = event.params.totalWinningWeight
  bucket.save()
}

// Handler for base contract BucketValueSet (maps to PriceAtTimestamp)
export function handleBaseBucketPriceSet(event: BaseBucketPriceSet): void {
  let market = getOrCreateMarket(event.address)
  let bucket = event.params.bucket
  let id = `${market.id}-${bucket.toString()}`

  let p = PriceAtTimestamp.load(id)
  if (!p) {
    p = new PriceAtTimestamp(id)
    p.market = market.id
    p.timestamp = bucket
  }

  p.price = event.params.value
  p.blockNumber = event.block.number
  p.blockTimestamp = event.block.timestamp
  p.transactionHash = event.transaction.hash
  p.save()
}

// Handler for base contract BatchProcessed
export function handleBaseBatchProcessed(event: BaseBatchProcessed): void {
  let market = getOrCreateMarket(event.address)
  let bucketId = `${market.id}-${event.params.bucket.toString()}`
  let bucket = Bucket.load(bucketId)
  if (!bucket) return

  let contract = CryptoPredictionMarket.bind(event.address)
  let oldStart = bucket.nextProcessIndex

  let info = contract.try_getBucketInfo(event.params.bucket)
  if (info.reverted) return

  let totalBets = info.value.value0.toI32()
  let totalWinningWeight = info.value.value1
  let newNext = info.value.value2.toI32()
  let aggregationComplete = info.value.value3

  for (let i = oldStart; i < newNext; i++) {
    if (i >= bucket.betIds.length) break

    let betId = bucket.betIds[i]
    let bet = Bet.load(betId)
    if (!bet) continue

    let betIdNum = betId.split("-")[1]
    let betResult = contract.try_getBet(BigInt.fromString(betIdNum))
    if (betResult.reverted) continue
    let betData = betResult.value

    bet.finalized = betData.finalized
    bet.actualPrice = betData.actualPrice
    bet.won = betData.won

    if (betData.won && !bet.wonCounted) {
      bet.wonCounted = true
      incrementUserWon(bet.user)
    }

    bet.save()
  }

  bucket.totalBets = totalBets
  bucket.totalWinningWeight = totalWinningWeight
  bucket.nextProcessIndex = newNext
  bucket.aggregationComplete = aggregationComplete
  bucket.save()

  if (bucket.aggregationComplete && !bucket.expectedPayoutsComputed) {
    computeExpectedPayouts(bucket as Bucket)
    bucket.expectedPayoutsComputed = true
    bucket.save()
  }
}

export function handleBatchProcessed(event: BatchProcessed): void {
  let market = getOrCreateMarket(event.address)
  let bucketId = `${market.id}-${event.params.bucket.toString()}`
  let bucket = Bucket.load(bucketId)
  if (!bucket) return

  let contract = CryptoPredictionMarket.bind(event.address)
  let oldStart = bucket.nextProcessIndex

  let info = contract.try_getBucketInfo(event.params.bucket)
  if (info.reverted) return

  let totalBets = info.value.value0.toI32()
  let totalWinningWeight = info.value.value1
  let newNext = info.value.value2.toI32()
  let aggregationComplete = info.value.value3

  for (let i = oldStart; i < newNext; i++) {
    if (i >= bucket.betIds.length) break

    let betId = bucket.betIds[i]
    let bet = Bet.load(betId)
    if (!bet) continue

    let betIdNum = betId.split("-")[1]
    let betResult = contract.try_getBet(BigInt.fromString(betIdNum))
    if (betResult.reverted) continue
    let betData = betResult.value

    bet.finalized = betData.finalized
    bet.actualPrice = betData.actualPrice
    bet.won = betData.won

    if (betData.won && !bet.wonCounted) {
      bet.wonCounted = true
      incrementUserWon(bet.user)
    }

    bet.save()
  }

  bucket.totalBets = totalBets
  bucket.totalWinningWeight = totalWinningWeight
  bucket.nextProcessIndex = newNext
  bucket.aggregationComplete = aggregationComplete
  bucket.save()

  if (bucket.aggregationComplete && !bucket.expectedPayoutsComputed) {
    computeExpectedPayouts(bucket as Bucket)
    bucket.expectedPayoutsComputed = true
    bucket.save()
  }
}

export function handleAggregationCompleted(event: AggregationCompleted): void {
  let market = getOrCreateMarket(event.address)
  let bucketId = `${market.id}-${event.params.bucket.toString()}`
  let bucket = Bucket.load(bucketId)
  if (!bucket) {
    bucket = getOrCreateBucket(bucketId, market.id)
  }

  bucket.aggregationComplete = true
  bucket.totalWinningWeight = event.params.totalWinningWeight
  bucket.save()
}

export function handleBetClaimed(event: BetClaimed): void {
  let market = getOrCreateMarket(event.address)
  let betId = `${market.id}-${event.params.betId.toString()}`
  let bet = Bet.load(betId)
  if (!bet) return

  bet.claimed = true
  bet.payout = event.params.payout
  bet.save()

  if (bet.won && !bet.wonCounted) {
    bet.wonCounted = true
    bet.save()
    incrementUserWon(bet.user)
  }

  if (event.params.payout.gt(ZERO)) {
    addUserPayout(event.params.bettor.toHexString(), event.params.payout)
  }
}

export function handleFeeCollected(event: FeeCollected): void {
  let market = getOrCreateMarket(event.address)
  let id = `${market.id}-${event.transaction.hash.toHex()}-${event.logIndex.toString()}`
  let fee = new Fee(id)

  fee.market = market.id
  fee.amount = event.params.amount
  fee.blockNumber = event.block.number
  fee.timestamp = event.block.timestamp
  fee.transactionHash = event.transaction.hash

  fee.save()

  market.totalFees = market.totalFees.plus(event.params.amount)
  market.save()
}

export function handleBucketPriceSet(event: BucketPriceSet): void {
  let market = getOrCreateMarket(event.address)
  let bucket = event.params.bucket
  let id = `${market.id}-${bucket.toString()}`

  let p = PriceAtTimestamp.load(id)
  if (!p) {
    p = new PriceAtTimestamp(id)
    p.market = market.id
    p.timestamp = bucket
  }

  p.price = event.params.price
  p.blockNumber = event.block.number
  p.blockTimestamp = event.block.timestamp
  p.transactionHash = event.transaction.hash
  p.save()
}

// DPM: Handle early exit (sell shares) for CryptoPredictionMarket
export function handleSharesSold(event: SharesSold): void {
  let market = getOrCreateMarket(event.address)
  let betId = `${market.id}-${event.params.betId.toString()}`
  let bet = Bet.load(betId)
  if (!bet) return

  bet.exited = true
  bet.exitPayout = event.params.exitPayout
  bet.exitFee = event.params.exitFee
  bet.save()

  // Update bucket totalExited
  let contract = CryptoPredictionMarket.bind(event.address)
  let startTimestampResult = contract.try_startTimestamp()
  if (startTimestampResult.reverted) return
  let startTimestamp = startTimestampResult.value
  let SECONDS_PER_DAY = BigInt.fromI32(86400)

  let betResult = contract.try_getBet(event.params.betId)
  if (betResult.reverted) return
  let betData = betResult.value

  let bucket = betData.targetTimestamp.minus(startTimestamp).div(SECONDS_PER_DAY)
  let bucketId = `${market.id}-${bucket.toString()}`
  let bucketObj = Bucket.load(bucketId)
  if (bucketObj) {
    bucketObj.totalExited = bucketObj.totalExited.plus(event.params.exitPayout)
    bucketObj.save()
  }

  // Track exit fee in market totals
  market.totalFees = market.totalFees.plus(event.params.exitFee)
  market.save()

  // Add exit payout to user stats
  addUserPayout(event.params.bettor.toHexString(), event.params.exitPayout)
}

// DPM: Handle early exit for base contracts (Politics, Sports, Technology)
export function handleBaseSharesSold(event: BaseSharesSold): void {
  let market = getOrCreateMarket(event.address)
  let betId = `${market.id}-${event.params.betId.toString()}`
  let bet = Bet.load(betId)
  if (!bet) return

  bet.exited = true
  bet.exitPayout = event.params.exitPayout
  bet.exitFee = event.params.exitFee
  bet.save()

  // Update bucket totalExited using the bet's stored bucket
  let bucketId = `${market.id}-${bet.bucket.toString()}`
  let bucketObj = Bucket.load(bucketId)
  if (bucketObj) {
    bucketObj.totalExited = bucketObj.totalExited.plus(event.params.exitPayout)
    bucketObj.save()
  }

  // Track exit fee in market totals
  market.totalFees = market.totalFees.plus(event.params.exitFee)
  market.save()

  // Add exit payout to user stats
  addUserPayout(event.params.bettor.toHexString(), event.params.exitPayout)
}
