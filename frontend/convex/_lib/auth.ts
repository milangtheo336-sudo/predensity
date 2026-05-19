/**
 * Shared auth helper for Convex mutations / queries.
 *
 * Background: Convex functions are public by default. Without a Convex auth
 * provider configured (we don't have one yet -- no convex/auth.config.ts),
 * ctx.auth.getUserIdentity() cannot be used. We therefore gate sensitive
 * mutations with a shared secret that only the Next.js server knows.
 *
 * The Next.js API routes already authenticate the user via Magic Link DID
 * tokens (see frontend/src/lib/api-auth.ts). Those routes verify the user,
 * then call Convex mutations passing `_serverToken` + the verified userId.
 * Convex trusts the userId if and only if the token matches.
 *
 * Direct-from-browser callers do not have the token and are rejected.
 *
 * NOTE: keep this in sync with `CONVEX_ADMIN_TOKEN` set in the Convex
 * deployment's environment variables (Convex dashboard -> Settings -> Env).
 */

function serverTokenFromEnv(): string | undefined {
  // Convex functions can read env vars via process.env at runtime.
  return process.env.CONVEX_ADMIN_TOKEN;
}

// Constant-time string equality. Avoids Node's `crypto` module so this file
// can run in Convex's default (non-Node) runtime.
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Require that the caller supplied the server-side shared secret.
 * Use this on admin-only / internal-only mutations (market resolution,
 * batch processing, bet finalization, etc.).
 *
 * Throws if the token is missing, misconfigured, or incorrect.
 */
export function requireServerToken(token: string | undefined): void {
  const expected = serverTokenFromEnv();
  if (!expected) {
    // Fail closed: if the secret is not configured, refuse everything.
    throw new Error("Server authentication is not configured (CONVEX_ADMIN_TOKEN missing)");
  }
  if (!token || !timingSafeStringEqual(token, expected)) {
    throw new Error("Unauthorized: invalid server token");
  }
}

/**
 * Require either the server token (trusted Next.js caller) OR that the
 * mutation is being run with a matching caller identity. Today this is
 * effectively "require the server token" -- once we wire a Convex auth
 * provider we can extend this to accept ctx.auth.getUserIdentity() whose
 * subject matches `claimedUserId`.
 */
export function requireSelfOrServer(
  token: string | undefined,
  _claimedUserId: string
): void {
  // For now the only trust path is the server token. The Next.js route
  // already verified the user's Magic DID before calling us, so the
  // server-token check is enough. This function exists as a seam so that
  // when we add a Convex auth provider, user-scoped mutations can allow
  // direct-from-browser callers whose identity matches `_claimedUserId`.
  requireServerToken(token);
}
