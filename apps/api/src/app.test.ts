import "dotenv/config";

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { mockData } from "@travel/mock-data";
import { count, eq } from "drizzle-orm";

import { buildApp } from "./app.js";
import { ADMIN_SESSION_COOKIE, EMPLOYEE_SESSION_COOKIE } from "./auth/session.js";
import { createDatabase } from "./db/client.js";
import { migrateDatabase } from "./db/migrate.js";
import {
  employees,
  groups,
  operatorAccounts,
  personalIntents,
  personalOrders,
  quotaAccounts,
  quotaTransactions,
  serviceProducts,
  serviceReviews,
  sessions,
} from "./db/schema.js";
import { seedDatabase } from "./db/seed.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assert(testDatabaseUrl, "运行 API 测试前必须配置 TEST_DATABASE_URL");

const parsedTestDatabaseUrl = new URL(testDatabaseUrl);
assert(
  parsedTestDatabaseUrl.hostname === "127.0.0.1" ||
    parsedTestDatabaseUrl.hostname === "localhost",
  "API 测试目前只允许连接本机 PostgreSQL",
);
assert(
  parsedTestDatabaseUrl.pathname.endsWith("_test"),
  "测试数据库名称必须以 _test 结尾",
);

const database = createDatabase(testDatabaseUrl);
const config = {
  sessionCookieSecure: false,
  sessionTtlDays: 7,
};
let app = buildApp({ db: database.db, config });

function extractCookie(
  setCookieHeader: string | string[] | undefined,
  cookieName: string,
): string {
  const header = Array.isArray(setCookieHeader)
    ? setCookieHeader.find((value) => value.startsWith(`${cookieName}=`))
    : setCookieHeader;
  assert(header, `响应缺少 ${cookieName} Cookie`);
  return header.split(";", 1)[0]!;
}

before(async () => {
  await database.pool.query("drop schema if exists drizzle cascade");
  await database.pool.query("drop schema public cascade");
  await database.pool.query("create schema public");
  await migrateDatabase(database.db);
  await seedDatabase(database.db);
  await app.ready();
});

after(async () => {
  await app.close();
  await database.pool.end();
});

test("健康检查确认 PostgreSQL 已连接", async () => {
  const response = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "ok",
    database: "connected",
  });
});

test("Seed 完整迁移 Mock 数据且密码不再明文保存", async () => {
  const tableCounts = await Promise.all([
    database.db.select({ value: count() }).from(operatorAccounts),
    database.db.select({ value: count() }).from(groups),
    database.db.select({ value: count() }).from(employees),
    database.db.select({ value: count() }).from(quotaAccounts),
    database.db.select({ value: count() }).from(serviceProducts),
    database.db.select({ value: count() }).from(personalIntents),
    database.db.select({ value: count() }).from(personalOrders),
    database.db.select({ value: count() }).from(serviceReviews),
    database.db.select({ value: count() }).from(quotaTransactions),
  ]);

  assert.deepEqual(
    tableCounts.map((result) => result[0]?.value),
    [
      mockData.operatorAccounts.length,
      mockData.groups.length,
      mockData.employees.length,
      mockData.quotaAccounts.length,
      mockData.serviceProducts.length,
      mockData.personalIntents.length,
      mockData.personalOrders.length,
      mockData.serviceReviews.length,
      mockData.quotaTransactions.length,
    ],
  );

  const storedPasswords = await database.db
    .select({ passwordHash: operatorAccounts.passwordHash })
    .from(operatorAccounts);
  const storedEmployeePasswords = await database.db
    .select({ passwordHash: employees.passwordHash })
    .from(employees);
  assert(
    [...storedPasswords, ...storedEmployeePasswords].every(
      ({ passwordHash }) =>
        passwordHash.startsWith("scrypt-v1$") &&
        passwordHash !== "123456",
    ),
  );
});

test("管理端可登录、恢复 Session，响应不泄露密码", async () => {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/admin/session",
    payload: { identifier: "leader", password: "123456" },
  });
  assert.equal(loginResponse.statusCode, 200);
  assert.equal(loginResponse.json().account.username, "leader");
  assert.equal("password" in loginResponse.json().account, false);
  assert.equal("passwordHash" in loginResponse.json().account, false);

  const cookie = extractCookie(
    loginResponse.headers["set-cookie"],
    ADMIN_SESSION_COOKIE,
  );
  const setCookieHeader = String(loginResponse.headers["set-cookie"]);
  assert.match(setCookieHeader, /HttpOnly/i);
  assert.match(setCookieHeader, /SameSite=Lax/i);
  assert.match(setCookieHeader, /Path=\/api\/admin/i);
  const sessionResponse = await app.inject({
    method: "GET",
    url: "/api/admin/session",
    headers: { cookie },
  });
  assert.equal(sessionResponse.statusCode, 200);
  assert.equal(sessionResponse.json().account.id, "operator-leader");
});

test("员工可登录，管理端与员工 Session 不能混用", async () => {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/employee/session",
    payload: { identifier: "13900002001", password: "123456" },
  });
  assert.equal(loginResponse.statusCode, 200);
  assert.equal(loginResponse.json().employee.id, "employee-zhang");
  assert.equal("note" in loginResponse.json().employee, false);

  const employeeCookie = extractCookie(
    loginResponse.headers["set-cookie"],
    EMPLOYEE_SESSION_COOKIE,
  );
  const wrongAudienceResponse = await app.inject({
    method: "GET",
    url: "/api/admin/session",
    headers: { cookie: employeeCookie },
  });
  assert.equal(wrongAudienceResponse.statusCode, 401);

  const adminLoginResponse = await app.inject({
    method: "POST",
    url: "/api/admin/session",
    payload: { identifier: "leader", password: "123456" },
  });
  const adminCookie = extractCookie(
    adminLoginResponse.headers["set-cookie"],
    ADMIN_SESSION_COOKIE,
  );
  const employeeAudienceResponse = await app.inject({
    method: "GET",
    url: "/api/employee/session",
    headers: { cookie: adminCookie },
  });
  assert.equal(employeeAudienceResponse.statusCode, 401);
});

test("错误密码和停用账号不能登录", async () => {
  const wrongPasswordResponse = await app.inject({
    method: "POST",
    url: "/api/admin/session",
    payload: { identifier: "leader", password: "wrong" },
  });
  assert.equal(wrongPasswordResponse.statusCode, 401);

  await database.db
    .update(employees)
    .set({ status: "disabled" })
    .where(eq(employees.id, "employee-zhang"));
  try {
    const disabledResponse = await app.inject({
      method: "POST",
      url: "/api/employee/session",
      payload: { identifier: "13900002001", password: "123456" },
    });
    assert.equal(disabledResponse.statusCode, 401);
  } finally {
    await database.db
      .update(employees)
      .set({ status: "active" })
      .where(eq(employees.id, "employee-zhang"));
  }
});

test("退出后 Session 立即失效", async () => {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/admin/session",
    payload: { identifier: "operator", password: "123456" },
  });
  const cookie = extractCookie(
    loginResponse.headers["set-cookie"],
    ADMIN_SESSION_COOKIE,
  );

  const logoutResponse = await app.inject({
    method: "DELETE",
    url: "/api/admin/session",
    headers: { cookie },
  });
  assert.equal(logoutResponse.statusCode, 204);

  const sessionResponse = await app.inject({
    method: "GET",
    url: "/api/admin/session",
    headers: { cookie },
  });
  assert.equal(sessionResponse.statusCode, 401);
});

test("Session 持久化到 PostgreSQL，可跨 API 实例恢复", async () => {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/employee/session",
    payload: { identifier: "13900002001", password: "123456" },
  });
  const cookie = extractCookie(
    loginResponse.headers["set-cookie"],
    EMPLOYEE_SESSION_COOKIE,
  );

  await app.close();
  app = buildApp({ db: database.db, config });
  await app.ready();

  const restoredResponse = await app.inject({
    method: "GET",
    url: "/api/employee/session",
    headers: { cookie },
  });
  assert.equal(restoredResponse.statusCode, 200);
  assert.equal(restoredResponse.json().employee.id, "employee-zhang");

  const sessionCountRows = await database.db
    .select({ value: count() })
    .from(sessions);
  const persistedSessions = sessionCountRows[0]?.value ?? 0;
  assert(persistedSessions > 0);
});

test("Seed 拒绝重复初始化已有数据的数据库", async () => {
  await assert.rejects(
    () => seedDatabase(database.db),
    /数据库已有运营账号，拒绝重复执行 Seed/,
  );
});
