/**
 * Typed shapes for every API response returned by the controllers.
 * These are what the frontend receives over the wire.
 */
import {
    HostCountMap,
    MethodCountMap,
    StatusCountMap,
    TopPathEntry,
} from "./redis.type";

// ── /visits ──────────────────────────────────────────────────────────────────

export type HourlyVisitsResponse  = { hour: string;  visits: HostCountMap };
export type DailyVisitsResponse   = { date: string;  visits: HostCountMap };
export type MonthlyVisitsResponse = { month: string; visits: HostCountMap };

// ── /errors ──────────────────────────────────────────────────────────────────

export type HourlyErrorsResponse    = { hour: string;  errors: HostCountMap   };
export type DailyErrorsResponse     = { date: string;  errors: HostCountMap   };
export type MonthlyErrorsResponse   = { month: string; errors: HostCountMap   };
export type ErrorsByStatusResponse  = { host: string;  errors: StatusCountMap };

// ── /unique ──────────────────────────────────────────────────────────────────

export type UniqueAllTimeResponse = { host: string; count: number };
export type UniqueHourlyResponse  = { hour: string;  host: string; count: number };
export type UniqueDailyResponse   = { date: string;  host: string; count: number };
export type UniqueMonthlyResponse = { month: string; host: string; count: number };

// ── /stats ───────────────────────────────────────────────────────────────────

export type TotalRequestsResponse = { totals: HostCountMap   };
export type MethodsResponse       = { methods: MethodCountMap };
export type StatusByHostResponse  = { host: string; status: StatusCountMap        };
export type TopPathsResponse      = { host: string; paths: TopPathEntry[]          };
