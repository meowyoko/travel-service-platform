import type {
  AdminPagePermission,
} from "@travel/domain";
import type { FastifyRequest } from "fastify";

import type { Database } from "../db/client.js";
import { ApiError } from "../errors.js";
import {
  resolveAdminSession,
  resolveEmployeeSession,
} from "./auth-service.js";
import {
  ADMIN_SESSION_COOKIE,
  EMPLOYEE_SESSION_COOKIE,
} from "./session.js";

export async function requireAdmin(
  db: Database,
  request: FastifyRequest,
  permission?: AdminPagePermission,
) {
  const account = await resolveAdminSession(
    db,
    request.cookies[ADMIN_SESSION_COOKIE],
  );
  if (!account) {
    throw new ApiError(401, "UNAUTHORIZED", "登录信息无效或已过期");
  }

  if (
    permission &&
    account.role !== "leader" &&
    !account.pagePermissions.includes(permission)
  ) {
    throw new ApiError(403, "FORBIDDEN", "当前账号没有该页面权限");
  }

  return account;
}

export async function requireEmployee(
  db: Database,
  request: FastifyRequest,
) {
  const employee = await resolveEmployeeSession(
    db,
    request.cookies[EMPLOYEE_SESSION_COOKIE],
  );
  if (!employee) {
    throw new ApiError(401, "UNAUTHORIZED", "登录信息无效或已过期");
  }
  return employee;
}
