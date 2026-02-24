/** Bar chart item for generic key → count data (methods, etc.). */
export type BarItem = {
    key: string;
    val: string;   // pre-formatted number
    pct: number;   // bar fill width (2–100)
};

/** Bar chart item for HTTP status code data. */
export type StatusBarItem = {
    code: string;
    val: string;
    pct: number;
    badgeClass: string;  // badge-2xx | badge-3xx | badge-4xx | badge-5xx
    barClass: string;    // green | blue | yellow | red
};

/** Bar chart item for top paths. */
export type PathBarItem = {
    path: string;
    val: string;
    pct: number;
};

/** Row in the All Hosts summary table. */
export type HostRow = {
    host: string;
    visitsToday: string;
    errorsToday: string;
};

/**
 * Full view model passed to the dashboard Handlebars template.
 * All data is pre-formatted and pre-computed server-side so the
 * template stays logic-free.
 */
export type DashboardViewModel = {
    // ── navigation context ────────────────────────────────────────────
    hosts: string[];
    selectedHost: string;
    period: string;
    periodLabel: string;
    customMonth: string;   // YYYY-MM when period is a custom month, else ''
    customDay: string;     // YYYY-MM-DD when period is a custom day, else ''
    customHour: string;    // YYYY-MM-DDTHH when period is a custom hour, else ''

    // pre-computed boolean flags (Handlebars lacks native equality expressions)
    hasHost: boolean;
    periodToday: boolean;
    periodYesterday: boolean;
    periodThisMonth: boolean;
    periodLastMonth: boolean;
    periodCustom: boolean;      // custom month
    periodCustomDay: boolean;   // custom day
    periodCustomHour: boolean;  // custom hour

    // ── overview cards ────────────────────────────────────────────────
    totalRequests: string;
    uniqueAllTime: string;  // '' when no host selected
    visitsPeriod: string;
    uniquePeriod: string;   // '' when no host selected
    errorsPeriod: string;

    // ── host-only panels ──────────────────────────────────────────────
    topPaths: PathBarItem[];
    statusCodes: StatusBarItem[];
    errorsByStatus: StatusBarItem[];

    // ── all-hosts-only panels ─────────────────────────────────────────
    methods: BarItem[];
    allHosts: HostRow[];

    // ── footer ────────────────────────────────────────────────────────
    lastUpdate: string;  // formatted date-time of last persistEntry call, or 'never'
    version: string;
};
