import { Controller, Get, Inject } from "@albertoielpo/ielpify";
import { FastifyReply, FastifyRequest } from "fastify";
import { Logger } from "../common/logger";

const logger = new Logger("ErrorsController");
import { RedisServiceProvider } from "../shared/service-provider/redis.service.provider";
import {
    DateQuery,
    HostQuery,
    HourQuery,
    MonthQuery
} from "../shared/type/query.type";
import {
    DailyErrorsResponse,
    ErrorsByStatusResponse,
    HourlyErrorsResponse,
    MonthlyErrorsResponse
} from "../shared/type/response.type";

@Controller("errors")
export class ErrorsController {
    constructor(
        @Inject(RedisServiceProvider)
        private readonly rsp: RedisServiceProvider
    ) {
        logger.notice("ErrorsController init");
    }

    @Get("hourly")
    async hourly(req: FastifyRequest<HourQuery>, res: FastifyReply) {
        const hour = req.query.hour ?? new Date().toISOString().slice(0, 13);
        const response: HourlyErrorsResponse = {
            hour,
            errors: await this.rsp.getHourlyErrors(hour)
        };
        return res.send(response);
    }

    @Get("daily")
    async daily(req: FastifyRequest<DateQuery>, res: FastifyReply) {
        const date = req.query.date ?? new Date().toISOString().slice(0, 10);
        const response: DailyErrorsResponse = {
            date,
            errors: await this.rsp.getDailyErrors(date)
        };
        return res.send(response);
    }

    @Get("monthly")
    async monthly(req: FastifyRequest<MonthQuery>, res: FastifyReply) {
        const month = req.query.month ?? new Date().toISOString().slice(0, 7);
        const response: MonthlyErrorsResponse = {
            month,
            errors: await this.rsp.getMonthlyErrors(month)
        };
        return res.send(response);
    }

    @Get("by-status")
    async byStatus(req: FastifyRequest<HostQuery>, res: FastifyReply) {
        const { host } = req.query;
        const response: ErrorsByStatusResponse = {
            host,
            errors: await this.rsp.getErrorsByStatus(host)
        };
        return res.send(response);
    }
}
