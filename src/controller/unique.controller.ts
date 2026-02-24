import { Controller, Get, Inject } from "@albertoielpo/ielpify";
import { FastifyReply, FastifyRequest } from "fastify";
import { Logger } from "../common/logger";

const logger = new Logger("UniqueController");
import { RedisServiceProvider } from "../shared/service-provider/redis.service.provider";
import {
    DateHostQuery,
    HostQuery,
    HourHostQuery,
    MonthHostQuery
} from "../shared/type/query.type";
import {
    UniqueAllTimeResponse,
    UniqueDailyResponse,
    UniqueHourlyResponse,
    UniqueMonthlyResponse
} from "../shared/type/response.type";

@Controller("unique")
export class UniqueController {
    constructor(
        @Inject(RedisServiceProvider)
        private readonly rsp: RedisServiceProvider
    ) {
        logger.notice("UniqueController init");
    }

    @Get("all-time")
    async allTime(req: FastifyRequest<HostQuery>, res: FastifyReply) {
        const { host } = req.query;
        const response: UniqueAllTimeResponse = {
            host,
            count: await this.rsp.getUniqueIps(host)
        };
        return res.send(response);
    }

    @Get("hourly")
    async hourly(req: FastifyRequest<HourHostQuery>, res: FastifyReply) {
        const { host } = req.query;
        const hour = req.query.hour ?? new Date().toISOString().slice(0, 13);
        const response: UniqueHourlyResponse = {
            hour,
            host,
            count: await this.rsp.getHourlyUniqueIps(hour, host)
        };
        return res.send(response);
    }

    @Get("daily")
    async daily(req: FastifyRequest<DateHostQuery>, res: FastifyReply) {
        const { host } = req.query;
        const date = req.query.date ?? new Date().toISOString().slice(0, 10);
        const response: UniqueDailyResponse = {
            date,
            host,
            count: await this.rsp.getDailyUniqueIps(date, host)
        };
        return res.send(response);
    }

    @Get("monthly")
    async monthly(req: FastifyRequest<MonthHostQuery>, res: FastifyReply) {
        const { host } = req.query;
        const month = req.query.month ?? new Date().toISOString().slice(0, 7);
        const response: UniqueMonthlyResponse = {
            month,
            host,
            count: await this.rsp.getMonthlyUniqueIps(month, host)
        };
        return res.send(response);
    }
}
