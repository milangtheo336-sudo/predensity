/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _lib_auth from "../_lib/auth.js";
import type * as challenges from "../challenges.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as events from "../events.js";
import type * as features from "../features.js";
import type * as leaderboard from "../leaderboard.js";
import type * as markets from "../markets.js";
import type * as notifications from "../notifications.js";
import type * as search from "../search.js";
import type * as sessionKeys from "../sessionKeys.js";
import type * as social from "../social.js";
import type * as stats from "../stats.js";
import type * as sync from "../sync.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_lib/auth": typeof _lib_auth;
  challenges: typeof challenges;
  crons: typeof crons;
  email: typeof email;
  events: typeof events;
  features: typeof features;
  leaderboard: typeof leaderboard;
  markets: typeof markets;
  notifications: typeof notifications;
  search: typeof search;
  sessionKeys: typeof sessionKeys;
  social: typeof social;
  stats: typeof stats;
  sync: typeof sync;
  users: typeof users;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
