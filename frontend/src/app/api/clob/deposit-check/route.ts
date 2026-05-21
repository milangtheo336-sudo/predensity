import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { requireAuthMatchingUser, rateLimit } from '@/lib/api-auth';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
const USDC_TOKEN_ID = HEDERA_NETWORK === 'mainnet' ? '0.0.456858' : '0.0.8229951';

/**
 * POST /api/clob/deposit-check -- Check if a user's Turnkey wallet has received USDC