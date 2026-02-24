/**
 * Log line parsing and terminal rendering
 * @author Alberto Ielpo <alberto.ielpo@gmail.com>
 * @license MIT
 */
import { Logger } from "../common/logger";

const logger = new Logger("Parser");
import { LogEntry } from "../shared/type/log-entry.type";

/**
 * Line regex is for
 * log_format main '$remote_addr - $realip_remote_addr [$time_iso8601] "$request_method $scheme://$host$request_uri $server_protocol" ' '$status $body_bytes_sent "$http_referer" ' '"$http_user_agent" "$http_x_forwarded_for"';
 * This is not default nginx.conf format
 */
const LINE_RE =
    /^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) ([^"]+)" (\d+) (\d+) "([^"]*)" "([^"]*)" "([^"]*)"$/;

export function parseLine(line: string): LogEntry | null {
    const m = LINE_RE.exec(line.trim());
    if (!m) return null;
    return {
        remote_addr: m[1],
        realip_remote_addr: m[2],
        time: m[3],
        method: m[4],
        url: m[5],
        protocol: m[6],
        status: parseInt(m[7], 10),
        bytes_sent: parseInt(m[8], 10),
        referer: m[9],
        user_agent: m[10],
        x_forwarded_for: m[11]
    };
}

export function printEntry(e: LogEntry): void {
    const statusColor =
        e.status >= 500
            ? "\x1b[31m" // red
            : e.status >= 400
              ? "\x1b[33m" // yellow
              : e.status >= 300
                ? "\x1b[36m" // cyan
                : "\x1b[32m"; // green
    const reset = "\x1b[0m";
    const dim = "\x1b[2m";
    const bold = "\x1b[1m";

    logger.notice(
        `${dim}${e.time}${reset} ` +
            `${bold}${e.remote_addr}${reset}` +
            (e.realip_remote_addr !== e.remote_addr
                ? ` (real: ${e.realip_remote_addr})`
                : "") +
            ` ${bold}${e.method}${reset} ${e.url}` +
            ` ${statusColor}${e.status}${reset}` +
            ` ${dim}${e.bytes_sent}B${reset}` +
            (e.referer && e.referer !== "-"
                ? `\n  referer:    ${e.referer}`
                : "") +
            (e.user_agent && e.user_agent !== "-"
                ? `\n  user-agent: ${e.user_agent}`
                : "") +
            (e.x_forwarded_for && e.x_forwarded_for !== "-"
                ? `\n  x-fwd-for:  ${e.x_forwarded_for}`
                : "")
    );
}
