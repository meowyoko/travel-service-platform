import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
const uploadDir = join(tmpdir(), `travel-api-test-${randomUUID()}`);
const config = {
  sessionCookieSecure: false,
  sessionTtlDays: 7,
  uploadDir,
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

async function loginAdmin(
  identifier = "leader",
  password = "123456",
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/admin/session",
    payload: { identifier, password },
  });
  assert.equal(response.statusCode, 200);
  return extractCookie(
    response.headers["set-cookie"],
    ADMIN_SESSION_COOKIE,
  );
}

async function loginEmployee(
  identifier: string,
  password = "123456",
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/employee/session",
    payload: { identifier, password },
  });
  assert.equal(response.statusCode, 200);
  return extractCookie(
    response.headers["set-cookie"],
    EMPLOYEE_SESSION_COOKIE,
  );
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
  await rm(uploadDir, { recursive: true, force: true });
});

test("健康检查确认 PostgreSQL 已连接", async () => {
  const response = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "ok",
    database: "connected",
  });
});

test("列表接口使用数据库分页并返回总数", async () => {
  const adminCookie = await loginAdmin();
  const response = await app.inject({
    method: "GET",
    url: "/api/admin/groups?page=1&pageSize=1",
    headers: { cookie: adminCookie },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().pagination.pageSize, 1);
  assert.equal(response.json().pagination.total, mockData.groups.length);
});

test("商品首图上传校验图片并可通过静态地址读取", async () => {
  const adminCookie = await loginAdmin();
  const boundary = `----travel-${randomUUID()}`;
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="cover.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    image,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const uploadResponse = await app.inject({
    method: "POST",
    url: "/api/admin/uploads/product-images",
    headers: {
      cookie: adminCookie,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });
  assert.equal(uploadResponse.statusCode, 200);
  assert.match(uploadResponse.json().url, /^\/uploads\/product-images\/.+\.png$/);

  const imageResponse = await app.inject({
    method: "GET",
    url: uploadResponse.json().url,
  });
  assert.equal(imageResponse.statusCode, 200);
  assert.deepEqual(imageResponse.rawPayload, image);
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

test("普通运营账号只能读取已授权的管理端资源", async () => {
  const cookie = await loginAdmin("operator");

  const productsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/products",
    headers: { cookie },
  });
  assert.equal(productsResponse.statusCode, 200);

  const groupsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/groups",
    headers: { cookie },
  });
  assert.equal(groupsResponse.statusCode, 403);
  assert.equal(groupsResponse.json().code, "FORBIDDEN");
});

test("双端聚合上下文按登录身份和权限裁剪数据", async () => {
  const leaderCookie = await loginAdmin();
  const username = `context-viewer-${Date.now()}`;
  const createAccountResponse = await app.inject({
    method: "POST",
    url: "/api/admin/operator-accounts",
    headers: { cookie: leaderCookie },
    payload: {
      username,
      password: "123456",
      displayName: "上下文权限测试",
      role: "staff",
      pagePermissions: [],
    },
  });
  assert.equal(createAccountResponse.statusCode, 201);

  const operatorCookie = await loginAdmin(username);
  const adminContextResponse = await app.inject({
    method: "GET",
    url: "/api/admin/context",
    headers: { cookie: operatorCookie },
  });
  assert.equal(adminContextResponse.statusCode, 200);
  const adminData = adminContextResponse.json().data;
  assert.deepEqual(adminData.groups, []);
  assert.deepEqual(adminData.employees, []);
  assert.deepEqual(adminData.serviceProducts, []);
  assert.deepEqual(adminData.personalIntents, []);
  assert.deepEqual(adminData.personalOrders, []);
  assert.deepEqual(adminData.quotaAccounts, []);
  assert.deepEqual(adminData.quotaTransactions, []);
  assert.deepEqual(adminData.serviceReviews, []);
  assert(
    adminData.operatorAccounts.every(
      (account: Record<string, unknown>) =>
        !("password" in account) && !("passwordHash" in account),
    ),
  );

  const employeeCookie = await loginEmployee("13900002001");
  const employeeContextResponse = await app.inject({
    method: "GET",
    url: "/api/employee/context",
    headers: { cookie: employeeCookie },
  });
  assert.equal(employeeContextResponse.statusCode, 200);
  const employeeData = employeeContextResponse.json();
  assert.equal(employeeData.employee.id, "employee-zhang");
  assert(
    employeeData.personalIntents.every(
      (intent: { employeeId: string }) =>
        intent.employeeId === "employee-zhang",
    ),
  );
  assert(
    employeeData.personalOrders.every(
      (order: { employeeId: string }) =>
        order.employeeId === "employee-zhang",
    ),
  );
  assert(
    employeeData.personalQuotaTransactions.every(
      (transaction: Record<string, unknown>) =>
        !("internalNote" in transaction) && !("operator" in transaction),
    ),
  );
  const visibleProductIds = new Set(
    employeeData.visibleProducts.map(({ id }: { id: string }) => id),
  );
  assert(
    employeeData.publishedReviews.every(
      (review: { productId: string; status: string }) =>
        review.status === "published" &&
        visibleProductIds.has(review.productId),
    ),
  );
});

test("PostgreSQL API 跑通完整闭环且并发确认只扣减一次", async () => {
  const adminCookie = await loginAdmin();
  const suffix = String(Date.now());
  const startDate = new Date().toISOString().slice(0, 10);
  const departure = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const returnDate = new Date(departure.getTime() + 3 * 24 * 60 * 60 * 1000);
  const departureDate = departure.toISOString().slice(0, 10);
  const returnDateText = returnDate.toISOString().slice(0, 10);
  const suitableMonth = Number(departureDate.slice(5, 7));

  const groupResponse = await app.inject({
    method: "POST",
    url: "/api/admin/groups",
    headers: { cookie: adminCookie },
    payload: {
      name: `闭环测试集团-${suffix}`,
      contactName: "测试联系人",
      contactPhone: "13800009999",
      cooperationStartDate: startDate,
    },
  });
  assert.equal(groupResponse.statusCode, 201);
  const groupId = groupResponse.json().group.id as string;

  const employeePhone = `139${suffix.slice(-8)}`;
  const employeeResponse = await app.inject({
    method: "POST",
    url: "/api/admin/employees",
    headers: { cookie: adminCookie },
    payload: {
      name: "闭环测试员工",
      phone: employeePhone,
      password: "123456",
      groupId,
      department: "测试部",
    },
  });
  assert.equal(employeeResponse.statusCode, 201);
  const employeeId = employeeResponse.json().employee.id as string;

  const grantResponse = await app.inject({
    method: "POST",
    url: "/api/admin/quota-grants",
    headers: { cookie: adminCookie },
    payload: {
      employeeIds: [employeeId],
      amount: 5000,
      reason: "闭环测试额度发放",
    },
  });
  assert.equal(grantResponse.statusCode, 201);
  assert.equal(grantResponse.json().quotaTransactions[0].balanceAfter, 5000);

  const productResponse = await app.inject({
    method: "POST",
    url: "/api/admin/products",
    headers: { cookie: adminCookie },
    payload: {
      name: `闭环测试商品-${suffix}`,
      type: "travel",
      summary: "用于验证 PostgreSQL 双端闭环。",
      coverImage: "/images/products/mountain-retreat.png",
      quotaReference: { min: 1200, max: 1800 },
      serviceDescription: "提供住宿与基础交通协调。",
      notes: "测试商品。",
      visibility: {
        scope: "specified_groups",
        groupIds: [groupId],
      },
      travelDetails: {
        destination: "测试目的地",
        destinationHighlights: "环境安静。",
        suitableTravelMonths: [suitableMonth],
        recommendedStayDays: "4天",
        serviceScope: "住宿与基础交通协调。",
      },
    },
  });
  assert.equal(productResponse.statusCode, 201, productResponse.body);
  const productId = productResponse.json().product.id as string;

  const publishResponse = await app.inject({
    method: "POST",
    url: `/api/admin/products/${productId}/publish`,
    headers: { cookie: adminCookie },
  });
  assert.equal(publishResponse.statusCode, 200);

  const employeeCookie = await loginEmployee(employeePhone);
  const visibleProductsResponse = await app.inject({
    method: "GET",
    url: "/api/employee/products",
    headers: { cookie: employeeCookie },
  });
  assert.equal(visibleProductsResponse.statusCode, 200);
  assert(
    visibleProductsResponse
      .json()
      .serviceProducts.some(
        (product: { id: string }) => product.id === productId,
      ),
  );

  const intentResponse = await app.inject({
    method: "POST",
    url: "/api/employee/intents",
    headers: { cookie: employeeCookie },
    payload: {
      productId,
      expectedTravelDate: departureDate,
      expectedStayDays: 4,
      companionCount: 0,
      preferredTransport: "高铁",
      needsPickup: true,
    },
  });
  assert.equal(intentResponse.statusCode, 201);
  const intentId = intentResponse.json().intent.id as string;
  assert.equal(intentResponse.json().intent.status, "pending_follow_up");

  const adminIntentsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/intents",
    headers: { cookie: adminCookie },
  });
  assert.equal(adminIntentsResponse.statusCode, 200);
  assert(
    adminIntentsResponse
      .json()
      .personalIntents.some(
        (intent: { id: string }) => intent.id === intentId,
      ),
  );

  const followUpResponse = await app.inject({
    method: "PATCH",
    url: `/api/admin/intents/${intentId}/follow-up`,
    headers: { cookie: adminCookie },
    payload: {
      status: "communicating",
      assigneeAccountId: "operator-leader",
      internalNote: "闭环测试跟进。",
    },
  });
  assert.equal(followUpResponse.statusCode, 200);

  const convertResponse = await app.inject({
    method: "POST",
    url: `/api/admin/intents/${intentId}/orders`,
    headers: { cookie: adminCookie },
    payload: {
      assigneeAccountId: "operator-leader",
      plannedQuotaDeduction: 1200,
      servicePlan: "4天住宿与高铁站接送。",
      departureDate,
      returnDate: returnDateText,
      transport: "高铁",
      accommodation: "测试合作酒店",
      pickupService: "高铁站接送",
    },
  });
  assert.equal(convertResponse.statusCode, 201);
  const orderId = convertResponse.json().order.id as string;
  assert.equal(convertResponse.json().order.status, "pending_confirmation");

  const confirmResponses = await Promise.all([
    app.inject({
      method: "POST",
      url: `/api/admin/orders/${orderId}/confirm`,
      headers: { cookie: adminCookie },
    }),
    app.inject({
      method: "POST",
      url: `/api/admin/orders/${orderId}/confirm`,
      headers: { cookie: adminCookie },
    }),
  ]);
  assert.deepEqual(
    confirmResponses.map(({ statusCode }) => statusCode).sort(),
    [200, 409],
  );

  const employeeOrdersResponse = await app.inject({
    method: "GET",
    url: "/api/employee/orders",
    headers: { cookie: employeeCookie },
  });
  const confirmedOrder = employeeOrdersResponse
    .json()
    .personalOrders.find((order: { id: string }) => order.id === orderId);
  assert(confirmedOrder);
  assert.equal(confirmedOrder.deductedQuota, 1200);
  assert.equal(confirmedOrder.finalConsumedQuota, 1200);

  const employeeQuotaResponse = await app.inject({
    method: "GET",
    url: "/api/employee/quota",
    headers: { cookie: employeeCookie },
  });
  assert.equal(employeeQuotaResponse.statusCode, 200);
  assert.equal(employeeQuotaResponse.json().quotaAccount.availableBalance, 3800);
  const deductions = employeeQuotaResponse
    .json()
    .quotaTransactions.filter(
      (transaction: { relatedOrderId?: string }) =>
        transaction.relatedOrderId === orderId,
    );
  assert.equal(deductions.length, 1);
  assert.equal(deductions[0].amount, -1200);
  assert.equal("operator" in deductions[0], false);
  assert.equal("internalNote" in deductions[0], false);

  const ownIntentsResponse = await app.inject({
    method: "GET",
    url: "/api/employee/intents",
    headers: { cookie: employeeCookie },
  });
  assert.deepEqual(
    ownIntentsResponse
      .json()
      .personalIntents.map((intent: { employeeId: string }) => intent.employeeId),
    [employeeId],
  );
});

test("Seed 拒绝重复初始化已有数据的数据库", async () => {
  await assert.rejects(
    () => seedDatabase(database.db),
    /数据库已有运营账号，拒绝重复执行 Seed/,
  );
});
