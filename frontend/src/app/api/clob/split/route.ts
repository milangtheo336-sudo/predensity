
export const dynamic = 'force-dynamic';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
  AccountAllowanceApproveTransaction,
  TokenId,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { STAKING_TOKEN_IDS, STAKING_MODE } from '@/lib/contracts/contract-config';

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

const SPLIT_ABI = new ethers.utils.Interface([
  'function splitPosition(uint256 marketId, uint256 usdcAmount) external',
]);

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  if (OPERATOR_ID && OPERATOR_KEY) {
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    client.setOperator(OPERATOR_ID, PrivateKey.fromStringECDSA(keyHex));
  }
  return client;
}

/**
 * POST /api/clob/split
 * Split USDC into outcome tokens for a market via MarketManager contract.
 * Admin-only -- operator splits USDC to provide liquidity for the order book.
 * Body: { marketManagerContractId, onChainMarketId, usdcAmount }
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { marketManagerContractId, onChainMarketId, usdcAmount } = body;

    if (!marketManagerContractId || onChainMarketId === undefined || !usdcAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    // Approve USDC allowance for the MarketManager contract
    const tokenId = STAKING_TOKEN_IDS[STAKING_MODE];
    if (tokenId) {
      const approveTx = new AccountAllowanceApproveTransaction()
        .approveTokenAllowance(TokenId.fromString(tokenId), OPERATOR_ID, marketManagerContractId, Number(usdcAmount));
      await approveTx.execute(client);
    }

    // Call splitPosition
    const tokenAmount = ethers.utils.parseUnits(usdcAmount.toString(), 6);
    const callData = SPLIT_ABI.encodeFunctionData('splitPosition', [
      onChainMarketId,
      tokenAmount,
    ]);

    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(marketManagerContractId))
      .setGas(1500000)
      .setFunctionParameters(Buffer.from(callData.slice(2), 'hex'))
      .freezeWith(client);

    const signedTx = await tx.sign(operatorKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);

    client.close();

    if (receipt.status.toString() !== 'SUCCESS') {
      return NextResponse.json({ error: `Split failed: ${receipt.status}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      transactionId: response.transactionId.toString(),
      usdcAmount,
      onChainMarketId,
    });
  } catch (error) {
    console.error('[clob/split] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

