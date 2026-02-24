/**
 * Semantic types for data stored in / returned from Redis.
 *
 * Redis hGetAll always yields Record<string, string> (all values are strings).
 * These aliases make the intent of each hash explicit.
 */

/** Hash: hostname → stringified request count (visits, errors, total_requests). */
export type HostCountMap = Record<string, string>;

/** Hash: HTTP status code → stringified request count. */
export type StatusCountMap = Record<string, string>;

/** Hash: HTTP method (GET, POST, …) → stringified request count. */
export type MethodCountMap = Record<string, string>;

/** One entry from a Redis sorted set (zRangeWithScores). */
export type TopPathEntry = { value: string; score: number };
