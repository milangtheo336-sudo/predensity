import { NextRequest, NextResponse } from 'next/server';
import { Client, ContractCallQuery, ContractId, PrivateKey } from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { CONTRACT_IDS } from '@/lib/contracts/contract-config';
import { rateLimit } from '@/lib/api-auth';

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

const SIMULATE_ABI = new ethers.utils.Interface([
  'function simulatePlaceBet(uint256 targetTimestamp, uint256 priceMin, uint256 priceMax, uint256 stakeAmount) view returns (tuple(uint256 fee, uint256 stakeNet, uint256 sharpnessBps, uint256 timeBps, uint256 qualityBps, uint256 weight, uint256 bucket, bool isValid, string errorMessage))',
]);

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  if (OPERATOR_ID && OPERATOR_KEY) {
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    client.setOperator(OPERATOR_ID, PrivateKey.fromStringECDSA(keyHex));
  }
  return client;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 30 simulations per minute per IP (read-only but costs gas)
    const rateLimitResponse = rateLimit(request, { maxRequests: 30, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const { category, targetTimestamp, priceMin, priceMax, stakeUsdc } = await request.json();

    if (!category || !targetTimestamp || priceMin === undefined || priceMax === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const contractId = CONTRACT_IDS[category as keyof typeof CONTRACT_IDS];
    if (!contractId) {
      return NextResponse.json({ error: `Unknown category: ${category}` }, { status: 400 });
    }

    const stake = stakeUsdc && parseFloat(stakeUsdc) > 0 ? stakeUsdc : '1';
    // Truncate to N decimal places to avoid ethers parseUnits underflow
    const truncate = (val: number | string, decimals: number) => {
      const s = val.toString();
      const dot = s.indexOf('.');
      if (dot === -1) return s;
      return s.slice(0, dot + 1 + decimals);
    };
    const stakeWei = ethers.utils.parseUnits(truncate(stake, 6), 6);

    let priceMinBN: ethers.BigNumber;
    let priceMaxBN: ethers.BigNumber;
    if (category === 'crypto') {
      priceMinBN = ethers.utils.parseUnits(truncate(priceMin, 8), 8);
      priceMaxBN = ethers.utils.parseUnits(truncate(priceMax, 8), 8);
    } else {
      priceMinBN = ethers.BigNumber.from(Math.round(priceMin).toString());
      priceMaxBN = ethers.BigNumber.from(Math.round(priceMax).toString());
    }

    const callData = SIMULATE_ABI.encodeFunctionData('simulatePlaceBet', [
      targetTimestamp.toString(),
      priceMinBN,
      priceMaxBN,
      stakeWei,
    ]);

    const client = getHederaClient();
    try {
      const query = new ContractCallQuery()
        .setContractId(ContractId.fromString(contractId))
        .setGas(200000)
        .setFunctionParameters(Buffer.from(callData.slice(2), 'hex'));

      const result = await query.execute(client);
      client.close();

      const bytes = result.bytes;
      const decoded = SIMULATE_ABI.decodeFunctionResult('simulatePlaceBet', bytes);
      const sim = decoded[0];

      return NextResponse.json({
        fee: sim.fee.toString(),
        stakeNet: sim.stakeNet.toString(),
        sharpnessBps: sim.sharpnessBps.toString(),
        timeBps: sim.timeBps.toString(),
        qualityBps: sim.qualityBps.toString(),
        weight: sim.weight.toString(),
        bucket: sim.bucket.toString(),
        isValid: sim.isValid,
        errorMessage: sim.errorMessage,
      });
    } catch (err) {
      client.close();
      throw err;
    }
  } catch (error) {
    console.error('[bet/simulate] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Simulation failed' }, { status: 500 });
  }
}
