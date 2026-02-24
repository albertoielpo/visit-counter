import pino from "pino";

declare module "fastify" {
    interface FastifyBaseLogger {
        notice: pino.LogFn;
    }
}

export class Logger {
    static readonly config = {
        customLevels: { notice: 35 },
        base: { context: "App" },
        transport: {
            target: "pino-pretty",
            options: {
                customLevels: "trace:10,debug:20,info:30,notice:35,warn:40,error:50,fatal:60",
                colorize: [undefined, "local", "docker"].includes(
                    process.env.APP_ENV
                ), // colorize only in local
                singleLine: true,
                levelFirst: false,
                translateTime: "yyyy-mm-dd'T'HH:MM:ss.l'Z'",
                // customize https://github.com/pinojs/pino-pretty
                messageFormat: "[{context}] {msg}",
                ignore: "pid,hostname,context,req,res,responseTime,reqId",
                errorLikeObjectKeys: ["err", "error"]
            },
            level: process.env.LOG_LEVEL || "notice"
        }
    };

    private static readonly root: pino.Logger<"notice"> = pino(Logger.config);

    readonly notice: pino.LogFn;
    readonly error: pino.LogFn;
    readonly warn: pino.LogFn;
    readonly info: pino.LogFn;
    readonly debug: pino.LogFn;

    constructor(context: string) {
        const child = Logger.root.child({ context });
        this.notice = child.notice.bind(child);
        this.error  = child.error.bind(child);
        this.warn   = child.warn.bind(child);
        this.info   = child.info.bind(child);
        this.debug  = child.debug.bind(child);
    }
}
