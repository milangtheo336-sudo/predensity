
export const dynamic = 'force-dynamic';

// Cache the rate for 10 minutes to avoid hammering the API
let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;
const FALLBACK_RATE = 130.26;

export async function GET() {
  try {
    if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_TTL) {
      return NextResponse.json({ rate: cachedRate.rate, cached: true });
    }

    // Free API -- no key needed, 1500 requests/month
    const res = await fetch(
      'https://open.er-api.com/v6/latest/USD',
      { next: { revalidate: 600 } }
    );

    if (!res.ok) throw new Error('Exchange API returned ' + res.status);

    const data = await res.json();
    const kesRate = data?.rates?.KES;

    if (!kesRate || typeof kesRate !== 'number') {
      throw new Error('KES rate not found in response');
    }

    cachedRate = { rate: kesRate, timestamp: Date.now() };
    return NextResponse.json({ rate: kesRate, cached: false });
  } catch (err) {
    console.error('Exchange rate fetch failed:', err);
    return NextResponse.json({ rate: cachedRate?.rate || FALLBACK_RATE, cached: true, fallback: true });
  }
}

