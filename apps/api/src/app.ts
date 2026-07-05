import cookie from "@fastify/cookie";
import { Type } from "@fastify/type-provider-typebox";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Fastify, { type FastifyServerOptions } from "fastify";
import { sql } from "drizzle-orm";

import {
  createAdminSessionRoutes,
  createEmployeeSessionRoutes,
} from "./auth/session-routes.js";
import type { ApiConfig } from "./config.js";
import type { Database } from "./db/client.js";

interface BuildAppOptions {
  db: Database;
  config: Pick<ApiConfig, "sessionCookieSecure" | "sessionTtlDays">;
  logger?: FastifyServerOptions["logger"];
}

const HealthResponseSchema = Type.Object(
  {
    status: Type.Literal("ok"),
    database: Type.Literal("connected"),
  },
  { additionalProperties: false },
);

const HealthErrorResponseSchema = Type.Object(
  {
    status: Type.Literal("error"),
    database: Type.Literal("unavailable"),
  },
  { additionalProperties: false },
);

export function buildApp({
  db,
  config,
  logger = false,
}: BuildAppOptions) {
  const app = Fastify({ logger }).withTypeProvider<TypeBoxTypeProvider>();

  app.register(cookie);

  app.get(
    "/api/health",
    {
      schema: {
        response: {
          200: HealthResponseSchema,
          503: HealthErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        await db.execute(sql`select 1`);
        return { status: "ok" as const, database: "connected" as const };
      } catch {
        return reply.code(503).send({
          status: "error",
          database: "unavailable",
        });
      }
    },
  );

  app.register(createAdminSessionRoutes({ db, config }), {
    prefix: "/api/admin",
  });
  app.register(createEmployeeSessionRoutes({ db, config }), {
    prefix: "/api/employee",
  });

  return app;
}
