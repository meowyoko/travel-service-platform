import {
  AdminSessionResponseSchema,
  ApiErrorSchema,
  EmployeeSessionResponseSchema,
  LoginRequestSchema,
} from "@travel/contracts";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import type { ApiConfig } from "../config.js";
import type { Database } from "../db/client.js";
import {
  createAdminSession,
  createEmployeeSession,
  deleteSessionByToken,
  resolveAdminSession,
  resolveEmployeeSession,
} from "./auth-service.js";
import {
  ADMIN_SESSION_COOKIE,
  EMPLOYEE_SESSION_COOKIE,
} from "./session.js";

interface SessionRouteDependencies {
  db: Database;
  config: Pick<ApiConfig, "sessionCookieSecure" | "sessionTtlDays">;
}

function cookieOptions(
  secure: boolean,
  path: "/api/admin" | "/api/employee",
  expires?: Date,
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path,
    ...(expires ? { expires } : {}),
  };
}

function unauthorized() {
  return {
    code: "UNAUTHORIZED",
    message: "登录信息无效或已过期",
  };
}

export function createAdminSessionRoutes({
  db,
  config,
}: SessionRouteDependencies): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.post(
      "/session",
      {
        schema: {
          body: LoginRequestSchema,
          response: {
            200: AdminSessionResponseSchema,
            401: ApiErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const session = await createAdminSession(
          db,
          config,
          request.body.identifier,
          request.body.password,
        );
        if (!session) {
          return reply.code(401).send(unauthorized());
        }

        reply.setCookie(
          ADMIN_SESSION_COOKIE,
          session.token,
          cookieOptions(
            config.sessionCookieSecure,
            "/api/admin",
            session.expiresAt,
          ),
        );
        return { account: session.account };
      },
    );

    app.get(
      "/session",
      {
        schema: {
          response: {
            200: AdminSessionResponseSchema,
            401: ApiErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const account = await resolveAdminSession(
          db,
          request.cookies[ADMIN_SESSION_COOKIE],
        );
        if (!account) {
          return reply.code(401).send(unauthorized());
        }
        return { account };
      },
    );

    app.delete("/session", async (request, reply) => {
      await deleteSessionByToken(
        db,
        request.cookies[ADMIN_SESSION_COOKIE],
      );
      reply.clearCookie(
        ADMIN_SESSION_COOKIE,
        cookieOptions(config.sessionCookieSecure, "/api/admin"),
      );
      return reply.code(204).send();
    });
  };
}

export function createEmployeeSessionRoutes({
  db,
  config,
}: SessionRouteDependencies): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.post(
      "/session",
      {
        schema: {
          body: LoginRequestSchema,
          response: {
            200: EmployeeSessionResponseSchema,
            401: ApiErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const session = await createEmployeeSession(
          db,
          config,
          request.body.identifier,
          request.body.password,
        );
        if (!session) {
          return reply.code(401).send(unauthorized());
        }

        reply.setCookie(
          EMPLOYEE_SESSION_COOKIE,
          session.token,
          cookieOptions(
            config.sessionCookieSecure,
            "/api/employee",
            session.expiresAt,
          ),
        );
        return { employee: session.account };
      },
    );

    app.get(
      "/session",
      {
        schema: {
          response: {
            200: EmployeeSessionResponseSchema,
            401: ApiErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const employee = await resolveEmployeeSession(
          db,
          request.cookies[EMPLOYEE_SESSION_COOKIE],
        );
        if (!employee) {
          return reply.code(401).send(unauthorized());
        }
        return { employee };
      },
    );

    app.delete("/session", async (request, reply) => {
      await deleteSessionByToken(
        db,
        request.cookies[EMPLOYEE_SESSION_COOKIE],
      );
      reply.clearCookie(
        EMPLOYEE_SESSION_COOKIE,
        cookieOptions(config.sessionCookieSecure, "/api/employee"),
      );
      return reply.code(204).send();
    });
  };
}
