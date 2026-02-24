import { registerController, registerService } from "@albertoielpo/ielpify";
import fastifyStatic from "@fastify/static";
import fastifyView from "@fastify/view";
import Fastify from "fastify";
import Handlebars from "handlebars";
import { APP_VERSION as version } from "./common/config";
import { Logger } from "./common/logger";
import { setFastifyInstance, shutdown } from "./common/shutdown";
import { ErrorsController } from "./controller/errors.controller";
import { StatsController } from "./controller/stats.controller";
import { UniqueController } from "./controller/unique.controller";
import { VisitsController } from "./controller/visits.controller";
import { AccessTailJob } from "./job/access-tail.job";
import { DashboardRender } from "./render/dashboard.render";

const fastify = Fastify({ logger: Logger.config });
fastify.log.level = process.env.LOG_LEVEL || "notice";
setFastifyInstance(fastify);

// static assets (css, js, images, …)
fastify.register(fastifyStatic, {
    root: `${process.cwd()}/resources/assets`,
    prefix: "/assets/"
});

// SSR view engine — Handlebars
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper(
    "gt",
    (a: unknown, b: unknown) => Number(a) > Number(b)
);
fastify.register(fastifyView, {
    engine: { handlebars: Handlebars },
    root: `${process.cwd()}/resources/views`
});

// Redirect to dashboard
fastify.get("/", (_, res) => res.redirect("/dashboard"));

// Singletons
registerController(fastify, DashboardRender);
registerController(fastify, VisitsController);
registerController(fastify, ErrorsController);
registerController(fastify, StatsController);
registerController(fastify, UniqueController);
registerService(AccessTailJob);

// Run the server!
fastify.listen({ port: 3000, host: "0.0.0.0" }, (err, addr) => {
    if (err) {
        shutdown(1);
    }
    fastify.log.notice(`Server listening at ${addr}. Version ${version}`);
});
