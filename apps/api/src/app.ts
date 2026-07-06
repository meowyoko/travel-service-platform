import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { Type } from "@fastify/type-provider-typebox";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Fastify, { type FastifyServerOptions } from "fastify";
import { sql } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  createAdminSessionRoutes,
  createEmployeeSessionRoutes,
} from "./auth/session-routes.js";
import type { ApiConfig } from "./config.js";
import type { Database } from "./db/client.js";
import {
  createAdminReadRoutes,
  createEmployeeReadRoutes,
} from "./core/read-routes.js";
import {
  createAdminWriteRoutes,
  createEmployeeWriteRoutes,
} from "./core/write-routes.js";
import { createAdminExtendedRoutes } from "./core/extended-routes.js";
import { createContextRoutes } from "./core/context-routes.js";
import { createUploadRoutes } from "./core/upload-routes.js";
import { registerErrorHandler } from "./errors.js";

interface BuildAppOptions {
  db: Database;
  config: Pick<ApiConfig, "sessionCookieSecure" | "sessionTtlDays"> & {
    uploadDir?: string;
  };
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
  const uploadRoot = resolve(config.uploadDir || "./data/uploads");

  registerErrorHandler(app);
  app.register(cookie);
  app.register(multipart);
  mkdirSync(uploadRoot, { recursive: true });
  app.register(fastifyStatic, {
    root: uploadRoot,
    prefix: "/uploads/",
    decorateReply: false,
  });

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
  app.register(createAdminReadRoutes(db), {
    prefix: "/api/admin",
  });
  app.register(createEmployeeReadRoutes(db), {
    prefix: "/api/employee",
  });
  app.register(createAdminWriteRoutes(db), {
    prefix: "/api/admin",
  });
  app.register(createEmployeeWriteRoutes(db), {
    prefix: "/api/employee",
  });
  app.register(createAdminExtendedRoutes(db), {
    prefix: "/api/admin",
  });
  app.register(createContextRoutes(db), {
    prefix: "/api",
  });
  app.register(createUploadRoutes(db, uploadRoot), {
    prefix: "/api/admin/uploads",
  });

  return app;
}
