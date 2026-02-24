import type { FastifyInstance } from "fastify";
import { Logger } from "./logger";

const logger = new Logger("Shutdown");

let instance: FastifyInstance | null = null;

export function setFastifyInstance(fastify: FastifyInstance): void {
    instance = fastify;
}

export async function shutdown(code: number): Promise<never> {
    logger.notice("Shutting down...");
    if (instance) {
        await instance
            .close()
            .catch((err) => logger.error({ err }, "Error closing Fastify"));
    }
    process.exit(code);
}
