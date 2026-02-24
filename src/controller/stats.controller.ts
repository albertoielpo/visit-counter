import { Controller, Get, Inject } from "@albertoielpo/ielpify";
import { FastifyReply, FastifyRequest } from "fastify";
import { Logger } from "../common/logger";

const logger = new Logger("StatsController");
import { RedisServiceProvider } from "../shared/service-provider/redis.service.provider";
import { HostQuery } from "../shared/type/query.type";
import {
    MethodsResponse,
    StatusByHostResponse,
    TopPathsResponse,
    TotalRequestsResponse
} from "../shared/type/response.type";

@Controller("stats")
export class StatsController {
    constructor(
        @Inject(RedisServiceProvider)
        private readonly rsp: RedisServiceProvider
    ) {
        logger.notice("StatsController init");
    }

    @Get("total-requests")
    async totalRequests(_req: FastifyRequest, res: FastifyReply) {
        const response: TotalRequestsResponse = {
            totals: await this.rsp.getTotalRequests()
        };
        return res.send(response);
    }

    @Get("methods")
    async methods(_req: FastifyRequest, res: FastifyReply) {
        const response: MethodsResponse = {
            methods: await this.rsp.getMethods()
        };
        return res.send(response);
    }

    @Get("status")
    async status(req: FastifyRequest<HostQuery>, res: FastifyReply) {
        const { host } = req.query;
        const response: StatusByHostResponse = {
            host,
            status: await this.rsp.getStatusByHost(host)
        };
        return res.send(response);
    }

    @Get("top-paths")
    async topPaths(req: FastifyRequest<HostQuery>, res: FastifyReply) {
        const { host } = req.query;
        const response: TopPathsResponse = {
            host,
            paths: await this.rsp.getTopPaths(host)
        };
        return res.send(response);
    }
}
