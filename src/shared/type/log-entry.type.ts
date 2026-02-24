export type LogEntry = {
    remote_addr: string;
    realip_remote_addr: string;
    time: string;
    method: string;
    url: string;
    protocol: string;
    status: number;
    bytes_sent: number;
    referer: string;
    user_agent: string;
    x_forwarded_for: string;
};
