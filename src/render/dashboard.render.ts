import { Controller, Get, Inject } from "@albertoielpo/ielpify";
import "@fastify/view";
import { FastifyReply, FastifyRequest } from "fastify";
import { APP_VERSION as version } from "../common/config";
import { Logger } from "../common/logger";
import { RedisServiceProvider } from "../shared/service-provider/redis.service.provider";
import {
    BarItem,
    DashboardViewModel,
    HostRow,
    PathBarItem,
    StatusBarItem
} from "../shared/type/dashboard.type";
import {
    HostCountMap,
    StatusCountMap,
    TopPathEntry
} from "../shared/type/redis.type";

const logger = new Logger("DashboardRender");

type DashboardQuery = { Querystring: { host?: string; period?: string } };

@Controller("dashboard")
export class DashboardRender {
    private static readonly PRESET_PERIODS = [
        "today",
        "yesterday",
        "this-month",
        "last-month"
    ];
    private static readonly CUSTOM_MONTH_RE = /^\d{4}-\d{2}$/;
    private static readonly CUSTOM_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
    private static readonly CUSTOM_HOUR_RE = /^\d{4}-\d{2}-\d{2}T\d{2}$/;

    constructor(
        @Inject(RedisServiceProvider)
        private readonly rsp: RedisServiceProvider
    ) {
        logger.notice("DashboardRender init");
    }

    @Get("")
    async index(req: FastifyRequest<DashboardQuery>, res: FastifyReply) {
        const selectedHost = req.query.host ?? "";
        const period = this.parsePeriod(req.query.period);
        const key = this.periodKey(period);
        const hourly = this.periodIsHourly(period);
        const monthly = this.periodIsMonthly(period);
        const todayKey = new Date().toISOString().slice(0, 10);

        // ── Global data (always needed) ───────────────────────────────────────
        const [
            totalReqData,
            methodsData,
            visitsToday,
            errorsToday,
            lastUpdateRaw
        ] = await Promise.all([
            this.rsp.getTotalRequests(),
            this.rsp.getMethods(),
            this.rsp.getDailyVisits(todayKey),
            this.rsp.getDailyErrors(todayKey),
            this.rsp.getLastUpdate()
        ]);

        const hosts = Object.keys(totalReqData)
            .filter((h) => h !== "unknown")
            .sort();

        // ── Period data ───────────────────────────────────────────────────────
        const [visitsRes, errorsRes] = await Promise.all([
            hourly
                ? this.rsp.getHourlyVisits(key)
                : monthly
                  ? this.rsp.getMonthlyVisits(key)
                  : this.rsp.getDailyVisits(key),
            hourly
                ? this.rsp.getHourlyErrors(key)
                : monthly
                  ? this.rsp.getMonthlyErrors(key)
                  : this.rsp.getDailyErrors(key)
        ]);

        let totalRequests: number;
        let visitsPeriod: number;
        let errorsPeriod: number;
        let uniqueAllTime = "";
        let uniquePeriod = "";
        let topPaths: PathBarItem[] = [];
        let statusCodes: StatusBarItem[] = [];
        let errorsByStatus: StatusBarItem[] = [];

        if (selectedHost) {
            totalRequests = Number(totalReqData[selectedHost] ?? 0);
            visitsPeriod = Number(visitsRes[selectedHost] ?? 0);
            errorsPeriod = Number(errorsRes[selectedHost] ?? 0);

            const [
                uniqueAll,
                uniqueForPeriod,
                pathsData,
                statusData,
                errByStatus
            ] = await Promise.all([
                this.rsp.getUniqueIps(selectedHost),
                hourly
                    ? this.rsp.getHourlyUniqueIps(key, selectedHost)
                    : monthly
                      ? this.rsp.getMonthlyUniqueIps(key, selectedHost)
                      : this.rsp.getDailyUniqueIps(key, selectedHost),
                this.rsp.getTopPaths(selectedHost),
                this.rsp.getStatusByHost(selectedHost),
                this.rsp.getErrorsByStatus(selectedHost)
            ]);

            uniqueAllTime = this.fmt(uniqueAll);
            uniquePeriod = this.fmt(uniqueForPeriod);
            topPaths = this.toPathBarItems(pathsData);
            statusCodes = this.toStatusBarItems(statusData);
            errorsByStatus = this.toStatusBarItems(errByStatus);
        } else {
            totalRequests = this.sumMap(totalReqData);
            visitsPeriod = this.sumMap(visitsRes);
            errorsPeriod = this.sumMap(errorsRes);
        }

        // ── All-hosts table (always today) ────────────────────────────────────
        const allHosts: HostRow[] = hosts.map((h) => ({
            host: h,
            visitsToday: this.fmt(Number(visitsToday[h] ?? 0)),
            errorsToday: this.fmt(Number(errorsToday[h] ?? 0))
        }));

        const vm: DashboardViewModel = {
            hosts,
            selectedHost,
            period,
            periodLabel: this.periodLabel(period),
            customMonth: this.isCustomMonth(period) ? period : "",
            customDay: this.isCustomDay(period) ? period : "",
            customHour: this.isCustomHour(period) ? period : "",
            hasHost: !!selectedHost,
            periodToday: period === "today",
            periodYesterday: period === "yesterday",
            periodThisMonth: period === "this-month",
            periodLastMonth: period === "last-month",
            periodCustom: this.isCustomMonth(period),
            periodCustomDay: this.isCustomDay(period),
            periodCustomHour: this.isCustomHour(period),
            totalRequests: this.fmt(totalRequests),
            uniqueAllTime,
            visitsPeriod: this.fmt(visitsPeriod),
            uniquePeriod,
            errorsPeriod: this.fmt(errorsPeriod),
            topPaths,
            statusCodes,
            errorsByStatus,
            methods: this.toBarItems(methodsData),
            allHosts,
            lastUpdate: this.fmtDate(lastUpdateRaw),
            version
        };

        const accept = req.headers.accept
            ? req.headers.accept.toLowerCase()
            : "";
        if (accept === "application/json") {
            // return the json
            return vm;
        }

        // render the view
        return res.view("dashboard", vm);
    }

    // ── Period helpers ────────────────────────────────────────────────────────

    private isCustomMonth(period: string): boolean {
        return DashboardRender.CUSTOM_MONTH_RE.test(period);
    }

    private isCustomDay(period: string): boolean {
        return DashboardRender.CUSTOM_DAY_RE.test(period);
    }

    private isCustomHour(period: string): boolean {
        return DashboardRender.CUSTOM_HOUR_RE.test(period);
    }

    private parsePeriod(raw?: string): string {
        if (!raw) return "today";
        if (
            DashboardRender.PRESET_PERIODS.includes(raw) ||
            this.isCustomMonth(raw) ||
            this.isCustomDay(raw) ||
            this.isCustomHour(raw)
        )
            return raw;
        return "today";
    }

    private periodKey(period: string): string {
        const now = new Date();
        switch (period) {
            case "today":
                return now.toISOString().slice(0, 10);
            case "yesterday": {
                const d = new Date(now);
                d.setDate(d.getDate() - 1);
                return d.toISOString().slice(0, 10);
            }
            case "this-month":
                return now.toISOString().slice(0, 7);
            case "last-month": {
                const d = new Date(now);
                d.setMonth(d.getMonth() - 1);
                return d.toISOString().slice(0, 7);
            }
            default:
                return period; // YYYY-MM
        }
    }

    private periodIsMonthly(period: string): boolean {
        return (
            period === "this-month" ||
            period === "last-month" ||
            this.isCustomMonth(period)
        );
    }

    private periodIsHourly(period: string): boolean {
        return this.isCustomHour(period);
    }

    private periodLabel(period: string): string {
        switch (period) {
            case "today":
                return "Today";
            case "yesterday":
                return "Yesterday";
            case "this-month":
                return "This Month";
            case "last-month":
                return "Last Month";
            default:
                return period; // YYYY-MM
        }
    }

    // ── Formatting helpers ────────────────────────────────────────────────────

    private fmtDate(iso: string | null): string {
        if (!iso) return "never";
        const d = new Date(iso);
        return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
    }

    private fmt(n: number): string {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
        if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
        return n.toLocaleString("en");
    }

    private sumMap(map: HostCountMap): number {
        return Object.values(map).reduce((s, v) => s + Number(v), 0);
    }

    // ── Data transformation helpers ───────────────────────────────────────────

    private toBarItems(map: Record<string, string>): BarItem[] {
        const entries = Object.entries(map).sort(
            (a, b) => Number(b[1]) - Number(a[1])
        );
        const max = entries.length ? Number(entries[0][1]) : 0;
        return entries.map(([key, raw]) => {
            const n = Number(raw);
            return {
                key,
                val: this.fmt(n),
                pct: max ? Math.max(2, Math.round((n / max) * 100)) : 0
            };
        });
    }

    private toStatusBarItems(map: StatusCountMap): StatusBarItem[] {
        const entries = Object.entries(map).sort(
            (a, b) => Number(b[1]) - Number(a[1])
        );
        const max = entries.length ? Number(entries[0][1]) : 0;
        return entries.map(([code, raw]) => {
            const n = Number(raw);
            const c = parseInt(code);
            return {
                code,
                val: this.fmt(n),
                pct: max ? Math.max(2, Math.round((n / max) * 100)) : 0,
                badgeClass:
                    c >= 500
                        ? "badge-5xx"
                        : c >= 400
                          ? "badge-4xx"
                          : c >= 300
                            ? "badge-3xx"
                            : "badge-2xx",
                barClass:
                    c >= 500
                        ? "red"
                        : c >= 400
                          ? "yellow"
                          : c >= 300
                            ? "blue"
                            : "green"
            };
        });
    }

    private toPathBarItems(entries: TopPathEntry[]): PathBarItem[] {
        const max = entries.length ? entries[0].score : 0;
        return entries.map(({ value, score }) => ({
            path: value,
            val: this.fmt(score),
            pct: max ? Math.max(2, Math.round((score / max) * 100)) : 0
        }));
    }
}
