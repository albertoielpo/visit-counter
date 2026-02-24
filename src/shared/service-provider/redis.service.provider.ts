/**
 * Redis client and stats persistence
 * @author Alberto Ielpo <alberto.ielpo@gmail.com>
 * @license MIT
 */
import { Injectable } from "@albertoielpo/ielpify";
import { createClient } from "redis";
import { Logger } from "../../common/logger";

const logger = new Logger("RedisServiceProvider");
import { shutdown } from "../../common/shutdown";
import { LogEntry } from "../type/log-entry.type";
import {
    HostCountMap,
    MethodCountMap,
    StatusCountMap,
    TopPathEntry,
} from "../type/redis.type";

@Injectable()
export class RedisServiceProvider {
    private readonly redis;

    /**
     * RFC-1123 hostname: labels of [a-z0-9-], separated by dots,
     * no label starting/ending with a hyphen, total length <= 253.
     */
    private readonly VALID_HOSTNAME_RE =
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
    private readonly MAX_HOST_LENGTH = 253;
    /** Max number of dot-separated labels (e.g. "a.b.c.d" = 4). Rejects www.www.www… bot floods. */
    private readonly MAX_HOST_LABELS = 3;
    /** Rejects raw IPv4 addresses used as hostnames. */
    private readonly IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

    private readonly allowedHosts: string[] | null;

    constructor() {
        const redisUrl: string =
            process.env.REDIS_URL || "redis://localhost:6379";

        logger.notice(`Redis    : ${redisUrl}`);

        this.redis = createClient({ url: redisUrl });

        this.redis.on("error", (err: Error) => {
            logger.error(err);
        });

        this.redis.on("connect", () => {
            logger.notice("Redis connected");
        });

        process.on("SIGTERM", () => {
            this.redis.quit().finally(() => shutdown(0));
        });

        /**
         * Optional allowlist from TAIL_ALLOWED_HOSTS env var (comma-separated).
         * When set, only hostnames ending with one of the listed domains are tracked.
         * Example: TAIL_ALLOWED_HOSTS=ielpo.net,mondeando.com
         */
        this.allowedHosts = process.env.TAIL_ALLOWED_HOSTS
            ? process.env.TAIL_ALLOWED_HOSTS.split(",").map((h) =>
                  h.trim().toLowerCase()
              )
            : null;

        logger.notice(
            `Allowed  : ${this.allowedHosts ? this.allowedHosts.join(", ") : "all"}`
        );
    }

    async connect(): Promise<void> {
        await this.redis.connect();
    }

    async getHourlyVisits(hour: string): Promise<HostCountMap> {
        return this.redis.hGetAll(`visits:hourly:${hour}`);
    }

    async getDailyVisits(date: string): Promise<HostCountMap> {
        return this.redis.hGetAll(`visits:daily:${date}`);
    }

    async getMonthlyVisits(month: string): Promise<HostCountMap> {
        return this.redis.hGetAll(`visits:monthly:${month}`);
    }

    // errors

    async getHourlyErrors(hour: string): Promise<HostCountMap> {
        return this.redis.hGetAll(`errors:hourly:${hour}`);
    }

    async getDailyErrors(date: string): Promise<HostCountMap> {
        return this.redis.hGetAll(`errors:daily:${date}`);
    }

    async getMonthlyErrors(month: string): Promise<HostCountMap> {
        return this.redis.hGetAll(`errors:monthly:${month}`);
    }

    async getErrorsByStatus(host: string): Promise<StatusCountMap> {
        return this.redis.hGetAll(`errors:by_status:${host}`);
    }

    // stats

    async getTotalRequests(): Promise<HostCountMap> {
        return this.redis.hGetAll("stats:total_requests");
    }

    async getStatusByHost(host: string): Promise<StatusCountMap> {
        return this.redis.hGetAll(`stats:status:${host}`);
    }

    async getMethods(): Promise<MethodCountMap> {
        return this.redis.hGetAll("stats:methods");
    }

    async getLastUpdate(): Promise<string | null> {
        return this.redis.get("stats:last_update");
    }

    async getTopPaths(host: string, limit = 100): Promise<TopPathEntry[]> {
        return this.redis.zRangeWithScores(`stats:top_paths:${host}`, 0, limit - 1, {
            REV: true
        });
    }

    // unique_ips

    async getUniqueIps(host: string): Promise<number> {
        return this.redis.sCard(`unique_ips:${host}`);
    }

    async getHourlyUniqueIps(hour: string, host: string): Promise<number> {
        return this.redis.sCard(`unique_ips:hourly:${hour}:${host}`);
    }

    async getDailyUniqueIps(date: string, host: string): Promise<number> {
        return this.redis.sCard(`unique_ips:daily:${date}:${host}`);
    }

    async getMonthlyUniqueIps(month: string, host: string): Promise<number> {
        return this.redis.sCard(`unique_ips:monthly:${month}:${host}`);
    }

    /** Returns "YYYY-MM-DDTHH" from a nginx time_iso8601 string. */
    private getHourKey(isoTime: string): string {
        return isoTime.slice(0, 13);
    }

    /** Returns "YYYY-MM-DD" from a nginx time_iso8601 string. */
    private getDayKey(isoTime: string): string {
        return isoTime.slice(0, 10);
    }

    /** Returns "YYYY-MM" from a nginx time_iso8601 string. */
    private getMonthKey(isoTime: string): string {
        return isoTime.slice(0, 7);
    }

    /**
     * Extracts the hostname from the full URL captured in the log
     * (nginx $scheme://$host$request_uri).
     * Returns "unknown" for malformed, invalid, or non-allowlisted hostnames.
     */
    private extractHost(url: string): string {
        try {
            const host = new URL(url).hostname.toLowerCase();
            if (
                host.length > this.MAX_HOST_LENGTH ||
                !this.VALID_HOSTNAME_RE.test(host) ||
                this.IPV4_RE.test(host) ||
                host.split(".").length > this.MAX_HOST_LABELS
            ) {
                return "unknown";
            }
            if (this.allowedHosts && !this.allowedHosts.includes(host)) {
                return "unknown";
            }
            return host;
        } catch {
            return "unknown";
        }
    }

    /**
     * Persists all stats for a single log entry into Redis using a MULTI/EXEC pipeline.
     *
     * Keys written:
     *   visits:hourly:{YYYY-MM-DDTHH}            Hash  host → count  (2xx only)
     *   visits:daily:{YYYY-MM-DD}                Hash  host → count  (2xx only)
     *   visits:monthly:{YYYY-MM}                 Hash  host → count  (2xx only)
     *
     *   unique_ips:{host}                         Set  (all-time unique IPs — exact, 1xx/2xx/3xx only)
     *   unique_ips:hourly:{YYYY-MM-DDTHH}:{host}  Set  (unique IPs per hour — exact, 1xx/2xx/3xx only)
     *   unique_ips:daily:{YYYY-MM-DD}:{host}      Set  (unique IPs per day — exact, 1xx/2xx/3xx only)
     *   unique_ips:monthly:{YYYY-MM}:{host}       Set  (unique IPs per month — exact, 1xx/2xx/3xx only)
     *
     *   errors:hourly:{YYYY-MM-DDTHH}            Hash  host → count  (status undefined, <100 or >=400)
     *   errors:daily:{YYYY-MM-DD}                Hash  host → count  (status undefined, <100 or >=400)
     *   errors:monthly:{YYYY-MM}                 Hash  host → count  (status undefined, <100 or >=400)
     *   errors:by_status:{host}                  Hash  status_code → count  (all-time)
     *
     *   stats:total_requests                      Hash  host → count  (all-time)
     *   stats:status:{host}                       Hash  status_code → count
     *   stats:methods                             Hash  method → count
     *   stats:top_paths:{host}                    Sorted Set  path → score (request count)
     */
    async persistEntry(entry: LogEntry): Promise<void> {
        const host = this.extractHost(entry.url);
        const hourKey = this.getHourKey(entry.time);
        const dayKey = this.getDayKey(entry.time);
        const monthKey = this.getMonthKey(entry.time);
        const isSuccess = entry.status >= 200 && entry.status <= 299;
        const isError =
            isNaN(entry.status) || entry.status < 100 || entry.status >= 400;
        const isValidClient = !isError; // 1xx, 2xx, 3xx

        const multi = this.redis.multi();

        // visits per hour / day / month per host (2xx only)
        if (isSuccess) {
            multi.hIncrBy(`visits:hourly:${hourKey}`, host, 1);
            multi.hIncrBy(`visits:daily:${dayKey}`, host, 1);
            multi.hIncrBy(`visits:monthly:${monthKey}`, host, 1);
        }

        // unique IPs — exact count using Set (1xx, 2xx, 3xx — excludes errors)
        if (isValidClient) {
            multi.sAdd(`unique_ips:${host}`, entry.remote_addr);
            multi.sAdd(`unique_ips:hourly:${hourKey}:${host}`, entry.remote_addr);
            multi.sAdd(`unique_ips:daily:${dayKey}:${host}`, entry.remote_addr);
            multi.sAdd(`unique_ips:monthly:${monthKey}:${host}`, entry.remote_addr);
        }

        // error counters
        if (isError) {
            multi.hIncrBy(`errors:hourly:${hourKey}`, host, 1);
            multi.hIncrBy(`errors:daily:${dayKey}`, host, 1);
            multi.hIncrBy(`errors:monthly:${monthKey}`, host, 1);
            multi.hIncrBy(`errors:by_status:${host}`, String(entry.status), 1);
        }

        // all-time totals
        multi.hIncrBy("stats:total_requests", host, 1);

        // status code distribution per host
        multi.hIncrBy(`stats:status:${host}`, String(entry.status), 1);

        // HTTP method distribution (global)
        multi.hIncrBy("stats:methods", entry.method, 1);

        // top requested paths per host (sorted set) — valid clients only (1xx/2xx/3xx)
        if (isValidClient) {
            try {
                const path = new URL(entry.url).pathname;
                multi.zIncrBy(`stats:top_paths:${host}`, 1, path);
            } catch {
                // ignore malformed URLs
            }
        }

        multi.set("stats:last_update", new Date().toISOString());

        await multi.exec();
    }
}
