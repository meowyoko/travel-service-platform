import assert from "node:assert/strict";
import test from "node:test";

import { mockData } from "./mock-data.js";
import { verifyMockData } from "./verify.js";

test("固定 Mock 数据满足核心业务约束", () => {
  const report = verifyMockData(mockData);

  assert.equal(report.valid, true);
  assert.deepEqual(report.counts, {
    operatorAccounts: 2,
    groups: 2,
    employees: 3,
    quotaAccounts: 3,
    serviceProducts: 8,
    hotelRoomTypes: 2,
    hotelRoomDailyInventories: 7,
    personalIntents: 4,
    personalOrders: 3,
    serviceReviews: 1,
    quotaTransactions: 7,
  });
});

test("待跟进意向不会产生额度流水", () => {
  const intent = mockData.personalIntents.find(
    ({ status }) => status === "pending_follow_up",
  );

  if (!intent) {
    assert.fail("缺少待跟进意向测试数据");
  }

  assert.equal(
    mockData.quotaTransactions.some(
      ({ employeeId, occurredAt }) =>
        employeeId === intent.employeeId && occurredAt === intent.createdAt,
    ),
    false,
  );
});

test("订单最终消耗等于扣减减去退回", () => {
  for (const order of mockData.personalOrders) {
    assert.equal(
      order.finalConsumedQuota,
      order.deductedQuota - order.refundedQuota,
    );
  }
});
