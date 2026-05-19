/**
 * Server-side wrapper around ConvexHttpClient that automatically attaches
 * the shared CONVEX_ADMIN_TOKEN to sensitive mutations.
 *
 * Pattern:
 *   const convex = getServerConvex();
 *   await convex.adminMutation(api.users.updateWalletBalance, {
 *     userId,           // verified by requireAuth() in the route
 *     usdcBalance: "10.0",
 *   });
 *
 * The wrapper appends `_serverToken: CONVEX_ADMIN_TOKEN` to the args so the
 * mutation's requireServerToken() check passes. Plain `query()` and public
 * `mutation()` calls are unchanged.
 *
 * NEVER expose CONVEX_ADMIN_TOKEN to the browser -- keep it in a server-only
 * env var (no NEXT_PUBLIC_ prefix).
 */

import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "";
const ADMIN_TOKEN = process.env.CONVEX_ADMIN_TOKEN || "";

let singleton: ServerConvex | null = null;

class ServerConvex {
  private client: ConvexHttpClient;

  constructor() {
    if (!CONVEX_URL) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    }
    this.client = new ConvexHttpClient(CONVEX_URL);
  }

  // Forward plain reads and public mutations unchanged.
  query<F extends FunctionReference<"query">>(ref: F, args?: any) {
    return this.client.query(ref as any, args as any);
  }

  mutation<F extends FunctionReference<"mutation">>(ref: F, args?: any) {
    return this.client.mutation(ref as any, args as any);
  }

  // Gated mutation: attaches the shared server token. Use for anything that
  // touches user-owned or protocol-critical state (balance, bets, orders,
  // session keys, admin ops).
  adminMutation<F extends FunctionReference<"mutation">>(ref: F, args: any) {
    if (!ADMIN_TOKEN) {
      throw new Error(
        "CONVEX_ADMIN_TOKEN is not set -- server cannot call gated mutations"
      );
    }
    return this.client.mutation(ref as any, { ...args, _serverToken: ADMIN_TOKEN });
  }
}

export function getServerConvex(): ServerConvex {
  if (!singleton) singleton = new ServerConvex();
  return singleton;
}
