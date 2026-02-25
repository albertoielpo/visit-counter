/**
 * Parse a custom access log in order to provide statistics
 * @author Alberto Ielpo <alberto.ielpo@gmail.com>
 * @license MIT
 */
import { Inject, Injectable } from "@albertoielpo/ielpify";
import { createReadStream, PathLike, watch } from "fs";
import { stat } from "fs/promises";
import { createInterface } from "readline";
import { Logger } from "../common/logger";
import { shutdown } from "../common/shutdown";
import { RedisServiceProvider } from "../shared/service-provider/redis.service.provider";
import { parseLine, printEntry } from "./parser";

const logger = new Logger("AccessTailJob");

@Injectable()
export class AccessTailJob {
    private readonly logFile: string;
    private readonly startTimeRaw: string | undefined;
    private readonly tailOff: boolean;
    private readonly printEntries: boolean;
    private isProcessingChange = false;
    private hasPendingChange = false;

    constructor(
        @Inject(RedisServiceProvider)
        private redisServiceProvider: RedisServiceProvider
    ) {
        this.logFile =
            process.env.TAIL_LOG_FILE || `${process.cwd()}/tmp/access.log`;
        this.startTimeRaw = process.env.TAIL_START_TIME;
        this.tailOff = process.env.TAIL_OFF === "true";
        this.printEntries = process.env.TAIL_PRINT_ENTRIES === "true";

        logger.notice(`Log file: ${this.logFile}`);
        logger.notice(`Print: ${this.printEntries}`);
        if (this.startTimeRaw) {
            logger.notice(`Start time: ${this.startTimeRaw}`);
        }
        if (this.tailOff) {
            logger.notice("Tail off");
        }

        this.start().catch((err) => logger.error(err));
    }

    /**
     * Reads the whole file from the beginning and processes every entry
     * whose timestamp is >= fromTime. Resolves when the file is fully consumed.
     */
    private async replayFile(
        filePath: PathLike,
        fromTime: Date
    ): Promise<void> {
        logger.notice(
            `Replaying ${filePath} from ${fromTime.toISOString()} ...`
        );

        let lines = 0;
        const rl = createInterface({
            input: createReadStream(filePath),
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            if (!line.trim()) continue;
            const entry = parseLine(line);
            if (entry && new Date(entry.time) >= fromTime) {
                if (this.printEntries) printEntry(entry);
                lines++;
                await this.redisServiceProvider
                    .persistEntry(entry)
                    .catch((err: Error) =>
                        logger.error(`Redis persist error: ${err.message}`)
                    );
            }
        }

        logger.notice(`Replay complete (${lines}), switching to tail mode.`);
    }

    private handleChange(
        filePath: PathLike,
        state: { fileSize: number; buffer: string }
    ): void {
        if (this.isProcessingChange) {
            this.hasPendingChange = true;
            return;
        }
        this.isProcessingChange = true;
        this.doHandleChange(filePath, state)
            .catch((err: Error) =>
                logger.error(`Watcher handler error: ${err.message}`)
            )
            .finally(() => {
                this.isProcessingChange = false;
                if (this.hasPendingChange) {
                    this.hasPendingChange = false;
                    this.handleChange(filePath, state);
                }
            });
    }

    private async doHandleChange(
        filePath: PathLike,
        state: { fileSize: number; buffer: string }
    ): Promise<void> {
        const fileStat = await stat(filePath);

        if (fileStat.size < state.fileSize) {
            // file was rotated/truncated
            state.fileSize = 0;
            state.buffer = "";
        }

        if (fileStat.size === state.fileSize) return;

        const stream = createReadStream(filePath, {
            start: state.fileSize,
            end: fileStat.size - 1
        });
        state.fileSize = fileStat.size;

        await new Promise<void>((resolve, reject) => {
            stream.on("error", reject);
            stream.on("data", (chunk) => {
                state.buffer += chunk.toString();
                const lines = state.buffer.split("\n");
                state.buffer = lines.pop() as string; // keep incomplete last line
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const entry = parseLine(line);
                    if (entry) {
                        if (this.printEntries) printEntry(entry);
                        this.redisServiceProvider
                            .persistEntry(entry)
                            .catch((err: Error) =>
                                logger.error(
                                    `Redis persist error: ${err.message}`
                                )
                            );
                    } else {
                        logger.warn(`[unparsed] ${line}`);
                    }
                }
            });
            stream.on("end", resolve);
        });
    }

    private async tailFile(filePath: PathLike): Promise<void> {
        let fileSize = 0;

        try {
            fileSize = (await stat(filePath)).size;
        } catch (err) {
            logger.error(`Cannot stat file: ${filePath}`);
            shutdown(1);
        }

        logger.notice(`Tailing ${filePath} (pressing Ctrl+C to stop)`);

        const state = { fileSize, buffer: "" };

        const watcher = watch(filePath, (event: string) => {
            if (event !== "change") return;
            this.handleChange(filePath, state);
        });

        watcher.on("error", (err) => {
            logger.error({ err }, "Watcher error");
            shutdown(1);
        });
    }

    async start() {
        await this.redisServiceProvider.connect();

        if (this.startTimeRaw) {
            const startTime = new Date(this.startTimeRaw);
            if (isNaN(startTime.getTime())) {
                logger.error(
                    `Invalid TAIL_START_TIME value: "${this.startTimeRaw}"`
                );
                shutdown(1);
            }
            await this.replayFile(this.logFile, startTime);
        }

        if (this.tailOff) {
            logger.notice("End due to tail off mode");
            return;
        }

        await this.tailFile(this.logFile);
    }
}
