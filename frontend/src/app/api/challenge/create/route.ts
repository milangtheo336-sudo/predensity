export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { decodeEventLog, isAddress } from 'viem';
import { publicClient } from '@/lib/arc-server';
import { getChallengeMarketAddress } from '@/lib/contracts/contract-config';
import { ChallengeMarketABI } from '@/lib/contracts/challenge-market-abi';
import { rateLimit, requireAuthMatchingUser } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { Resend } from 'resend';

const convex = getServerConvex();
const resend = new Resend(process.env.RESEND_API_KEY);

// Email template for match invitation
function getMatchInvitationEmail(data: any) {
  return {
    subject: `You're invited to a ${data.gameTitle} match!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b; margin-bottom: 16px;">🎮 ${data.inviterName} invited you to a match!</h2>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 8px 0;"><strong style="color: #475569;">Game:</strong> ${data.gameTitle}</p>
          ${data.gameMode ? `<p style="margin: 8px 0;"><strong style="color: #475569;">Mode:</strong> ${data.gameMode}</p>` : ''}
          ${data.gameTagline ? `<p style="margin: 8px 0;"><strong style="color: #475569;">Description:</strong> ${data.gameTagline}</p>` : ''}
          <p style="margin: 8px 0;"><strong style="color: #475569;">Starts:</strong> ${new Date(data.startTime * 1000).toLocaleString()}</p>
          <p style="margin: 8px 0;"><strong style="color: #475569;">Closes:</strong> ${new Date(data.expiryTime * 1000).toLocaleString()}</p>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/markets/${data.matchId}" 
           style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 20px;">
          Accept Challenge
        </a>
        <p style="color: #64748b; font-size: 12px;">This is an automated message from Predensity. Do not reply to this email.</p>
      </div>
    `,
    text: `
      ${data.inviterName} invited you to a match!

      Game: ${data.gameTitle}
      ${data.gameMode ? `Mode: ${data.gameMode}` : ''}
      ${data.gameTagline ? `Description: ${data.gameTagline}` : ''}
      Starts: ${new Date(data.startTime * 1000).toLocaleString()}
      Closes: ${new Date(data.expiryTime * 1000).toLocaleString()}

      Accept challenge: ${process.env.NEXT_PUBLIC_APP_URL}/markets/${data.matchId}
    `,
  };
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const {
      userId,
      playerA,
      playerB,
      startTime,
      expiryTime,
      baseCutBps,
      winnerBonusBps,
      copyFeeBps,
      gameTitle,
      gameTagline,
      gameMode,
      platform,
      stakeFree,
      league,
      transactionHash,
    } = body || {};

    if (!userId || !playerA || !playerB || !startTime || !expiryTime || !transactionHash) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    if (!isAddress(playerA) || !isAddress(playerB)) {
      return NextResponse.json({ error: 'Invalid player address' }, { status: 400 });
    }

    const startSec = Number(startTime);
    const expirySec = Number(expiryTime);
    if (!Number.isFinite(startSec) || !Number.isFinite(expirySec)) {
      return NextResponse.json({ error: 'Invalid start/expiry time' }, { status: 400 });
    }
    if (startSec <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: 'Start time must be in the future' }, { status: 400 });
    }
    if (expirySec < startSec + 24 * 60 * 60) {
      return NextResponse.json({ error: 'Expiry must be at least 24h after start' }, { status: 400 });
    }

    const challengeAddress = getChallengeMarketAddress();
    if (!challengeAddress || !isAddress(challengeAddress)) {
      return NextResponse.json({ error: 'Challenge market not configured' }, { status: 503 });
    }

    const txHash = transactionHash.startsWith('0x') ? transactionHash : `0x${transactionHash}`;
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'Transaction not successful' }, { status: 400 });
    }

    const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
    if (!tx.to || tx.to.toLowerCase() !== challengeAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Transaction target does not match challenge market' }, { status: 400 });
    }

    let matchEvent: any | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== challengeAddress.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: ChallengeMarketABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'MatchCreated') {
          matchEvent = decoded;
          break;
        }
      } catch {
        // ignore non-matching logs
      }
    }

    if (!matchEvent) {
      return NextResponse.json({ error: 'MatchCreated event not found' }, { status: 400 });
    }

    const eventArgs = matchEvent.args as any;
    const onChainMatchId = Number(eventArgs.matchId);
    const eventPlayerA = String(eventArgs.playerA).toLowerCase();
    const eventPlayerB = String(eventArgs.playerB).toLowerCase();
    const host = String(eventArgs.host).toLowerCase();

    if (eventPlayerA !== playerA.toLowerCase() || eventPlayerB !== playerB.toLowerCase()) {
      return NextResponse.json({ error: 'Players do not match on-chain event' }, { status: 400 });
    }

    const matchId = `challenge-${onChainMatchId}`;
    await convex.adminMutation(api.challenges.createChallengeMatch, {
      matchId,
      onChainMatchId,
      host,
      playerA: eventPlayerA,
      playerB: eventPlayerB,
      startTime: Number(eventArgs.startTime),
      expiryTime: Number(eventArgs.expiryTime),
      baseCutBps: Number(eventArgs.baseCutBps ?? baseCutBps ?? 0),
      winnerBonusBps: Number(eventArgs.winnerBonusBps ?? winnerBonusBps ?? 0),
      copyFeeBps: Number(eventArgs.copyFeeBps ?? copyFeeBps ?? 0),
      gameTitle,
      gameTagline,
      gameMode,
      platform,
      stakeFree: stakeFree === true,
      league,
      transactionHash: txHash,
    });

    // Create invitation for Player B
    if (eventPlayerB) {
      await convex.adminMutation(api.challenges.createChallengeInvite, {
        matchId,
        inviterAddress: host,
        inviteeAddress: eventPlayerB,
        _serverToken: process.env.CONVEX_ADMIN_TOKEN,
      });

      // Get inviter profile for email
      const inviterProfile = await convex.query(api.social.getUserProfile, {
        userAddress: host,
      });

      // Get Player B email to send invitation
      const playerBEmail = await convex.query(api.social.getEmailByWalletAddress, {
        walletAddress: eventPlayerB,
      });

      if (playerBEmail) {
        // Send email invitation via Resend
        try {
          const emailData = {
            matchId,
            gameTitle: gameTitle || 'Esports Challenge',
            gameMode,
            gameTagline,
            startTime: Number(eventArgs.startTime),
            expiryTime: Number(eventArgs.expiryTime),
            inviterName: inviterProfile?.displayName || host.slice(0, 6),
            playerBName: 'Player',
          };

          const emailTemplate = getMatchInvitationEmail(emailData);
          
          const result = await resend.emails.send({
            from: `${process.env.NEXT_PUBLIC_EMAIL_FROM_NAME || 'Predensity'} <${process.env.NEXT_PUBLIC_EMAIL_SENDER || 'henry@predensity.com'}>`,
            to: playerBEmail,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            text: emailTemplate.text,
          });

          if (result.error) {
            console.error('[challenge/create] Resend error:', result.error);
          } else {
            console.log(`[challenge/create] Email sent to ${playerBEmail} via Resend (ID: ${result.data?.id})`);
          }
        } catch (error) {
          console.error('[challenge/create] Failed to send email:', error);
          // Don't fail the match creation if email fails
        }
      }

      // Create notification in-app
      await convex.adminMutation(api.notifications.createNotification, {
        userId: eventPlayerB,
        type: 'match_invitation',
        message: `${inviterProfile?.displayName || host.slice(0, 6)} invited you to a match: ${gameTitle || 'Esports Challenge'}`,
        matchId,
        _serverToken: process.env.CONVEX_ADMIN_TOKEN,
      });
    }

    return NextResponse.json({
      success: true,
      matchId,
      onChainMatchId,
      transactionHash: txHash,
    });
  } catch (error: any) {
    console.error('[challenge/create] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create match' }, { status: 500 });
  }
}
