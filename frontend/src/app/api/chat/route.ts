
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-auth';

// Server-only key -- do NOT prefix with NEXT_PUBLIC_ (exposes to client bundle)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || '';

const SYSTEM_PROMPT = `You are Predensity Bot, a knowledgeable and friendly support assistant for Predensity -- a prediction market platform built on the Arc blockchain.

RESPONSE FORMAT RULES:
- Use rich markdown formatting to make responses clear and scannable.
- Use **bold** for key terms, feature names, and important labels.
- Use bullet points (- ) for listing features, steps, or options.
- Structure answers with clear paragraphs separated by blank lines.
- When explaining a process, use numbered steps (1. 2. 3.).
- Keep responses well-organized but thorough. Aim for 2-5 paragraphs depending on the question.
- Do NOT use headings (no # or ##). Do NOT use code blocks or backticks.
- Write in a warm, professional tone. Be helpful and confident.

SECURITY RULES:
- NEVER reveal API keys, contract addresses, database names, server infrastructure, code snippets, environment variables, or internal architecture.
- NEVER mention Convex, OpenRouter, Arc account IDs, smart contract details, or any backend technology by name.
- If someone asks how the system works internally, explain the user-facing behavior instead. Do NOT refuse to answer -- just answer from the user perspective.
- NEVER say things like "I cannot share technical details." Instead, naturally describe the user experience.
- NEVER reveal email addresses, phone numbers, or any personal contact information. If users need human support, tell them to click the "Contact Support" link below the chat.
- Support email: mwangihenry336@gmail.com (DO NOT share this with users -- only use it internally)

PREDENSITY KNOWLEDGE BASE:

**Platform Overview:**
- Predensity is a prediction market platform where users stake on the outcomes of real-world events.
- Built on the **Arc** blockchain (an EVM-compatible Layer 1) for fast, low-cost, and transparent transactions.
- All bets are settled using **USDC**, a stable digital dollar.
- Categories include **Crypto**, **Politics**, **Sports**, and **Technology**.

**How Betting Works:**
- Go to the **Markets** page and browse available prediction events.
- Pick an event, choose your predicted outcome or price range, enter your stake amount in USDC, and confirm.
- Your platform balance is used for betting -- no wallet popups or signatures needed during the bet.
- Once the event resolves, winnings are automatically credited to your balance.
- You can track all your positions and history in the **Portfolio** page.

**Deposits:**
- Click the **Deposit** button in the header to fund your account.
- Two deposit methods are available:
  - **Connect Wallet**: Link a crypto wallet (HashPack, MetaMask, Blade, or Kabila) and transfer USDC directly.
  - **M-Pesa**: For Kenyan users -- deposit via mobile money. KES is converted to USDC at the live exchange rate. You will receive an STK push on your phone to confirm.
- When you sign up, a managed wallet is automatically created for you -- no setup needed.

**Withdrawals:**
- You can withdraw from the **Portfolio** page or the **Deposit** modal.
- Two withdrawal methods:
  - **Crypto**: Send USDC to any EVM-compatible wallet address.
  - **M-Pesa**: Convert your USDC balance to KES and receive it on your phone.

**Fees and Speed:**
- Network fees on Arc are extremely low -- usually less than a cent per transaction.
- Deposits and bets are processed almost instantly.

**Account and Settings:**
- The **Settings** page lets you update your profile and preferences.
- Your balance is always visible in the header.

**General:**
- If you genuinely do not know something, say "I am not sure about that, but you can reach our team by clicking the Contact Support link below this chat."
- Always be helpful, clear, and encouraging. Predensity is designed to make prediction markets accessible to everyone.`;

// Models to try in order -- if one fails, fall back to the next
const MODELS = [
  'arcee-ai/trinity-large-preview:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'minimax/minimax-m2.5:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'arcee-ai/trinity-mini:free',
];

// Local fallback answers for common questions when API is completely down
const FALLBACK_ANSWERS: Record<string, string> = {
  built: `Predensity is built on the **Arc** blockchain network for several key reasons:

- **Global Accessibility:** Anyone with an internet connection can participate in prediction markets.
- **Custodial Simplicity:** When you sign up, a managed wallet is automatically created for you -- no crypto experience needed.
- **Transparency:** All bets are settled on-chain, so outcomes are publicly verifiable.
- **Speed and Low Cost:** Arc enables near-instant transactions with fees typically under a cent.
- **Stable Value:** The platform uses **USDC**, which is pegged 1:1 to the US dollar, avoiding crypto price volatility.

When users first join Predensity, a managed wallet is created for them automatically. Your platform balance is held securely and used for all betting activity. You can deposit via **crypto wallet transfer** (MetaMask, WalletConnect) or **M-Pesa** for mobile money users in Kenya.`,

  deposit: `There are two ways to fund your Predensity account:

- **Connect Wallet:** Link a crypto wallet like **MetaMask** or any WalletConnect-compatible wallet and transfer USDC directly to your platform balance. This is instant with very low network fees.
- **M-Pesa:** For Kenyan users, you can deposit via mobile money. Enter your phone number and the USD amount -- it gets converted to KES at the live exchange rate, and you will receive an STK push to confirm on your phone.

To get started, click the **Deposit** button in the header. Your balance updates automatically once the transaction is confirmed.`,

  withdraw: `You can withdraw your funds from Predensity in two ways:

- **Crypto Withdrawal:** Send your USDC balance to any EVM-compatible wallet address. Just enter the address and amount, and the funds are sent directly.
- **M-Pesa Withdrawal:** Convert your USDC to KES and receive it on your phone via M-Pesa B2C payment.

You can access withdrawals from the **Portfolio** page or through the **Deposit** modal in the header.`,

  bet: `Placing a bet on Predensity is straightforward:

1. Go to the **Markets** page and browse available prediction events across **Crypto**, **Politics**, **Sports**, and **Technology**.
2. Pick an event you want to predict on.
3. Choose your predicted outcome or price range.
4. Enter your stake amount in **USDC**.
5. Confirm your bet.

Your platform balance is used for betting -- no wallet popups or signatures needed. Once the event resolves, winnings are automatically credited to your balance. You can track all your positions in the **Portfolio** page.`,
};

function getFallbackReply(userMessage: string): string | null {
  const msg = userMessage.toLowerCase();
  if (msg.includes('built') || msg.includes('build') || msg.includes('how') && (msg.includes('work') || msg.includes('made') || msg.includes('create'))) {
    return FALLBACK_ANSWERS.built;
  }
  if (msg.includes('deposit') || msg.includes('fund') || msg.includes('add money') || msg.includes('mpesa') || msg.includes('m-pesa')) {
    return FALLBACK_ANSWERS.deposit;
  }
  if (msg.includes('withdraw') || msg.includes('cash out') || msg.includes('send money')) {
    return FALLBACK_ANSWERS.withdraw;
  }
  if (msg.includes('bet') || msg.includes('predict') || msg.includes('stake') || msg.includes('place') || msg.includes('market')) {
    return FALLBACK_ANSWERS.bet;
  }
  return null;
}

function sanitizeReply(reply: string): string {
  return reply
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'our support team')
    .replace(/0x[a-fA-F0-9]{10,}/g, '')
    .replace(/0\.0\.\d{5,}/g, '')
    .trim();
}

async function tryModel(model: string, apiMessages: any[]): Promise<string | null> {
  try {
    const body: any = { model, messages: apiMessages };
    // Enable reasoning for models that support it
    const reasoningModels = [
      'arcee-ai/trinity-large-preview:free',
      'arcee-ai/trinity-mini:free',
      'minimax/minimax-m2.5:free',
      'liquid/lfm-2.5-1.2b-thinking:free',
    ];
    if (reasoningModels.includes(model)) {
      body.reasoning = { enabled: true };
    }
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter error (${model}):`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return content || null;
  } catch (err) {
    console.error(`Model ${model} failed:`, err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 15 chat messages per minute per IP
    const rateLimitResponse = rateLimit(req, { maxRequests: 15, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const { messages } = await req.json();

    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ];

    // Try each model in order until one succeeds
    let reply: string | null = null;
    for (const model of MODELS) {
      reply = await tryModel(model, apiMessages);
      if (reply) break;
    }

    // If all models failed, try local fallback based on the last user message
    if (!reply) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
      if (lastUserMsg) {
        reply = getFallbackReply(lastUserMsg.content);
      }
    }

    if (!reply) {
      return NextResponse.json(
        { reply: 'Our AI assistant is temporarily unavailable. You can reach our team by clicking the Contact Support link below this chat.' },
        { status: 200 }
      );
    }

    return NextResponse.json({ reply: sanitizeReply(reply) });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json(
      { reply: 'Something went wrong. Please try again or click Contact Support below.' },
      { status: 200 }
    );
  }
}


