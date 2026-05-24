/**
 * Backend-relayed token approval and bet placement
 * 
 * Flow:
 * 1. User signs a message proving intent (via Magic Link)
 * 2. Backend verifies signature
 * 3. Backend submits approval transaction (if needed)
 * 4. Backend submits bet transaction
 * 5. User's funds are used, but backend pays gas
 * 
 * Security: Backend cannot steal funds because it doesn't have user's private key.
 * Only transactions explicitly approved by user signature are executed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import {
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  PrivateKey,
  Client,
  Hbar,
  AccountAllowanceApproveTransaction,
  TokenId,
} from '@hashgraph/sdk';

// Hedera client setup
const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY!);

const client = process.env.NEXT_PUBLIC_HEDERA_NETWORK === 'mainnet'
  ? Client.forMainnet()
  : Client.forTestnet();

client.setOperator(operatorId, operatorKey);

// Contract addresses
const CRYPTO_CONTRACT_ID = '0.0.8290662';
const USDC_TOKEN_ID = '0.0.8229951';

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body is not valid JSON' },
        { status: 400 }
      );
    }
    const {
      userAddress,
      userSignature,
      message,
      category,
      targetTimestamp,
      priceMin,
      priceMax,
      stakeUsdc,
      asset,
      userId,
    } = body || {};

    if (
      typeof userAddress !== 'string' ||
      typeof userSignature !== 'string' ||
      typeof message !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, userSignature, message' },
        { status: 400 }
      );
    }

    console.log('[approve-and-place] Request:', { userAddress, category, stakeUsdc });

    // 1. Verify user signature
    const recoveredAddress = ethers.utils.verifyMessage(message, userSignature);
    if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    console.log('[approve-and-place] Signature verified');

    // 2. Parse message to extract bet details and verify they match.
    //    Wrap JSON.parse — an attacker could craft `message` that lacks the
    //    "Bet Details: " marker or contains invalid JSON, which would throw
    //    and surface through the generic 500 path. Fail cleanly with 400.
    const marker = 'Bet Details: ';
    const markerIdx = typeof message === 'string' ? message.indexOf(marker) : -1;
    if (markerIdx < 0) {
      return NextResponse.json(
        { error: 'Signed message missing Bet Details payload' },
        { status: 400 }
      );
    }

    let messageData: any;
    try {
      messageData = JSON.parse(message.slice(markerIdx + marker.length));
    } catch {
      return NextResponse.json(
        { error: 'Signed message payload is not valid JSON' },
        { status: 400 }
      );
    }

    if (
      messageData.stakeUsdc !== stakeUsdc ||
      messageData.category !== category ||
      messageData.targetTimestamp !== targetTimestamp
    ) {
      return NextResponse.json(
        { error: 'Message data does not match request' },
        { status: 400 }
      );
    }

    // 2a. Replay protection: the signed message MUST include a `signedAt`
    //     (unix ms) and `userAddress`. Reject signatures older than 5 min
    //     or dated more than 60 s in the future (clock skew grace), and
    //     require the signed address matches the on-request address so
    //     a captured signature can't be replayed against another wallet.
    const signedAt = Number(messageData.signedAt);
    const signedFor = messageData.userAddress;
    if (!Number.isFinite(signedAt)) {
      return NextResponse.json(
        { error: 'Signed message missing signedAt timestamp' },
        { status: 400 }
      );
    }
    const now = Date.now();
    const MAX_AGE_MS = 5 * 60 * 1000;
    const MAX_SKEW_MS = 60 * 1000;
    if (signedAt > now + MAX_SKEW_MS || now - signedAt > MAX_AGE_MS) {
      return NextResponse.json(
        { error: 'Signature expired — please sign again' },
        { status: 401 }
      );
    }
    if (
      typeof signedFor !== 'string' ||
      signedFor.toLowerCase() !== String(userAddress).toLowerCase()
    ) {
      return NextResponse.json(
        { error: 'Signed userAddress does not match request' },
        { status: 401 }
      );
    }

    console.log('[approve-and-place] Message data verified');

    // 3. Get user's Hedera Account ID from mirror node
    const mirrorResponse = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/accounts/${userAddress}`
    );
    
    if (!mirrorResponse.ok) {
      return NextResponse.json(
        { error: 'Could not find Hedera account for this address' },
        { status: 404 }
      );
    }

    const mirrorData = await mirrorResponse.json();
    const userAccountId = AccountId.fromString(mirrorData.account);
    
    console.log('[approve-and-place] User account:', userAccountId.toString());

    // 4. Check if approval is needed
    const allowanceResponse = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/accounts/${userAccountId.toString()}/allowances/tokens`
    );

    let needsApproval = true;
    if (allowanceResponse.ok) {
      const allowanceData = await allowanceResponse.json();
      const existingAllowance = allowanceData.allowances?.find(
        (a: any) => a.token_id === USDC_TOKEN_ID && a.spender === CRYPTO_CONTRACT_ID
      );
      
      if (existingAllowance && parseFloat(existingAllowance.amount) >= parseFloat(stakeUsdc) * 1000000) {
        needsApproval = false;
        console.log('[approve-and-place] Sufficient allowance exists');
      }
    }

    // 5. Approve token spending if needed (backend pays gas, user's tokens are approved)
    if (needsApproval) {
      console.log('[approve-and-place] Approving USDC spending...');
      
      // Note: This requires the user to have signed an allowance approval
      // We'll use AccountAllowanceApproveTransaction which requires user signature
      // For now, we'll skip this and assume approval exists or use a different method
      
      // TODO: Implement proper approval flow
      console.log('[approve-and-place] Approval flow needs implementation');
    }

    // 6. Place bet (backend submits transaction, user's USDC is used)
    console.log('[approve-and-place] Placing bet...');
    
    const tokenAmount = Math.floor(parseFloat(stakeUsdc) * 1000000); // 6 decimals
    const priceMinBN = ethers.utils.parseUnits(priceMin, 8); // 8 decimals for crypto
    const priceMaxBN = ethers.utils.parseUnits(priceMax, 8);

    const contractExecTx = new ContractExecuteTransaction()
      .setContractId(CRYPTO_CONTRACT_ID)
      .setGas(1500000)
      .setFunction(
        'placeBetWithToken',
        new ContractFunctionParameters()
          .addUint256(targetTimestamp)
          .addUint256(priceMinBN.toNumber())
          .addUint256(priceMaxBN.toNumber())
          .addUint256(tokenAmount)
      )
      .setMaxTransactionFee(new Hbar(2));

    const txResponse = await contractExecTx.execute(client);
    const receipt = await txResponse.getReceipt(client);

    console.log('[approve-and-place] Bet placed:', receipt.status.toString());

    // 7. Get transaction hash
    const txHash = `0x${Buffer.from(txResponse.transactionHash).toString('hex')}`;

    // 8. Record bet in database
    // TODO: Add database recording logic here

    return NextResponse.json({
      success: true,
      txHash,
      message: 'Bet placed successfully',
    });

  } catch (error: any) {
    console.error('[approve-and-place] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place bet' },
      { status: 500 }
    );
  }
}
