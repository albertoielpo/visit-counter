import { Controller, Get, Inject } from "@albertoielpo/ielpify";
import { FastifyReply, FastifyRequest } from "fastify";
import { RedisServiceProvider } from "../shared/service-provider/redis.service.provider";
import {
    DailyVisitsResponse,
    HourlyVisitsResponse,
    MonthlyVisitsResponse,
} from "../shared/type/response.type";
import { DateQuery, HourQuery, MonthQuery } from "../shared/type/query.type";

@Controller("visits")
export class VisitsController {
    constructor(
        @Inject(RedisServiceProvider)
        private readonly rsp: RedisServiceProvider
    ) {}

    @Get("hourly")
    async hourly(req: FastifyRequest<HourQuery>, res: FastifyReply) {
        const hour = req.query.hour ?? new Date().toISOString().slice(0, 13);
        const response: HourlyVisitsResponse = {
            hour,
            visits: await this.rsp.getHourlyVisits(hour),
        };
        return res.send(response);
    }

    @Get("daily")
    async daily(req: FastifyRequest<DateQuery>, res: FastifyReply) {
        const date = req.query.date ?? new Date().toISOString().slice(0, 10);
        const response: DailyVisitsResponse = {
            date,
            visits: await this.rsp.getDailyVisits(date),
        };
        return res.send(response);
    }

    @Get("monthly")
    async monthly(req: FastifyRequest<MonthQuery>, res: FastifyReply) {
        const month = req.query.month ?? new Date().toISOString().slice(0, 7);
        const response: MonthlyVisitsResponse = {
            month,
            visits: await this.rsp.getMonthlyVisits(month),
        };
        return res.send(response);
    }
}
