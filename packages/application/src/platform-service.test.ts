import assert from "node:assert/strict";
import test from "node:test";

import { mockData, verifyMockData } from "@travel/mock-data";

import { PlatformService } from "./platform-service.js";
import { InMemoryPlatformRepository } from "./repository.js";

function createTestContext(
  now = "2026-06-30T10:00:00+08:00",
  initialData = mockData,
) {
  let sequence = 0;
  const repository = new InMemoryPlatformRepository(initialData);
  const service = new PlatformService(repository, {
    now: () => now,
    nextId: (scope) => {
      sequence += 1;
      return `${scope}-test-${sequence}`;
    },
  });

  return { repository, service };
}

test("领导可创建页面级权限运营账号，用户名全局唯一", () => {
  const { repository, service } = createTestContext();

  const account = service.createOperatorAccount({
    actorAccountId: "operator-leader",
    username: "  SERVICE_A  ",
    password: "123456",
    displayName: "服务专员甲",
    role: "staff",
    pagePermissions: ["products", "orders", "operator_accounts"],
  });

  assert.equal(account.username, "service_a");
  assert.deepEqual(account.pagePermissions, ["products", "orders"]);
  assert.equal(verifyMockData(repository.getSnapshot()).valid, true);

  assert.throws(
    () =>
      service.createOperatorAccount({
        actorAccountId: "operator-leader",
        username: "Service_A",
        password: "123456",
        displayName: "重复账号",
        role: "staff",
        pagePermissions: ["products"],
      }),
    /用户名已存在/,
  );
});

test("普通职工不能管理运营账号", () => {
  const { repository, service } = createTestContext();
  const before = repository.getSnapshot();

  assert.throws(
    () =>
      service.createOperatorAccount({
        actorAccountId: "operator-staff",
        username: "unauthorized",
        password: "123456",
        displayName: "越权账号",
        role: "staff",
        pagePermissions: ["products"],
      }),
    /只有领导账号/,
  );
  assert.deepEqual(repository.getSnapshot(), before);
});

test("领导可更新运营账号权限，且不能停用当前账号", () => {
  const { repository, service } = createTestContext();

  const updated = service.updateOperatorAccount({
    actorAccountId: "operator-leader",
    accountId: "operator-staff",
    displayName: "林溪（更新）",
    role: "staff",
    status: "active",
    pagePermissions: ["products", "intents"],
  });
  assert.equal(updated.displayName, "林溪（更新）");
  assert.deepEqual(updated.pagePermissions, ["products", "intents"]);

  assert.throws(
    () =>
      service.updateOperatorAccount({
        actorAccountId: "operator-leader",
        accountId: "operator-leader",
        displayName: "周然",
        role: "leader",
        status: "disabled",
        pagePermissions: [],
      }),
    /不能停用自己/,
  );
  assert.equal(verifyMockData(repository.getSnapshot()).valid, true);
});

test("可创建集团和员工，并自动建立零余额额度账户", () => {
  const { repository, service } = createTestContext();

  const group = service.createGroup({
    name: "远山能源集团",
    contactName: "赵经理",
    contactPhone: "13800009901",
    cooperationStartDate: "2026-07-01",
  });
  const employee = service.createEmployee({
    name: "陈曦",
    phone: "13900009901",
    password: "123456",
    groupId: group.id,
    department: "综合管理部",
  });

  const data = repository.getSnapshot();
  const account = data.quotaAccounts.find(
    ({ employeeId }) => employeeId === employee.id,
  );

  assert.ok(account);
  assert.equal(employee.password, "123456");
  assert.equal(account.availableBalance, 0);
  assert.equal(account.totalGranted, 0);
  assert.equal(verifyMockData(data).valid, true);
});

test("员工可使用手机号密码登录，错误密码和停用账号会被拒绝", () => {
  const { service } = createTestContext();

  const employee = service.authenticateEmployee({
    phone: " 13900002001 ",
    password: "123456",
  });
  assert.equal(employee.id, "employee-zhang");

  assert.throws(
    () =>
      service.authenticateEmployee({
        phone: "13900002001",
        password: "wrong-password",
      }),
    /手机号或密码错误/,
  );

  service.updateEmployee({
    employeeId: "employee-zhang",
    groupId: "group-xingchen",
    status: "disabled",
  });
  assert.throws(
    () =>
      service.authenticateEmployee({
        phone: "13900002001",
        password: "123456",
      }),
    /账号已停用/,
  );
});

test("发放额度同时更新账户并生成发放流水", () => {
  const { repository, service } = createTestContext();
  const beforeAccount = repository
    .getSnapshot()
    .quotaAccounts.find(({ employeeId }) => employeeId === "employee-li")!;

  const transaction = service.grantQuota({
    employeeId: "employee-li",
    amount: 1000,
    reason: "追加疗养额度",
    operator: "测试管理员",
  });

  const data = repository.getSnapshot();
  const account = data.quotaAccounts.find(
    ({ employeeId }) => employeeId === "employee-li",
  );

  assert.ok(account);
  assert.equal(account.availableBalance, beforeAccount.availableBalance + 1000);
  assert.equal(account.totalGranted, beforeAccount.totalGranted + 1000);
  assert.equal(transaction.type, "grant");
  assert.equal(
    transaction.balanceAfter,
    beforeAccount.availableBalance + 1000,
  );
  assert.equal(verifyMockData(data).valid, true);
});

test("意向先转为待确认订单，此时不扣减额度", () => {
  const { repository, service } = createTestContext();
  const before = repository.getSnapshot();

  const order = service.convertIntentToPendingOrder({
    intentId: "intent-li-moganshan",
    assigneeAccountId: "operator-staff",
    plannedQuotaDeduction: 2800,
    servicePlan: "4天住宿、接送站及当地交通协调。",
    departureDate: "2026-08-10",
    returnDate: "2026-08-13",
    transport: "高铁",
    pickupService: "高铁站接送",
  });

  const data = repository.getSnapshot();
  const account = data.quotaAccounts.find(
    ({ employeeId }) => employeeId === "employee-li",
  );
  const intent = data.personalIntents.find(
    ({ id }) => id === "intent-li-moganshan",
  );

  assert.equal(order.status, "pending_confirmation");
  assert.equal(order.deductedQuota, 0);
  assert.equal(
    account?.availableBalance,
    before.quotaAccounts.find(
      ({ employeeId }) => employeeId === "employee-li",
    )?.availableBalance,
  );
  assert.equal(
    data.quotaTransactions.length,
    before.quotaTransactions.length,
  );
  assert.equal(intent?.status, "converted_to_order");
  assert.equal(verifyMockData(data).valid, true);
});

test("确认订单后扣减额度，并生成关联订单的扣减流水", () => {
  const { repository, service } = createTestContext();
  const beforeBalance = repository
    .getSnapshot()
    .quotaAccounts.find(
      ({ employeeId }) => employeeId === "employee-li",
    )!.availableBalance;

  const pendingOrder = service.convertIntentToPendingOrder({
    intentId: "intent-li-moganshan",
    assigneeAccountId: "operator-staff",
    plannedQuotaDeduction: 2800,
    servicePlan: "4天住宿、接送站及当地交通协调。",
    departureDate: "2026-08-10",
    returnDate: "2026-08-13",
  });
  const confirmedOrder = service.confirmPersonalOrder({
    orderId: pendingOrder.id,
    operator: "测试管理员",
  });

  const data = repository.getSnapshot();
  const account = data.quotaAccounts.find(
    ({ employeeId }) => employeeId === "employee-li",
  );
  const transaction = data.quotaTransactions.find(
    ({ relatedOrderId }) => relatedOrderId === pendingOrder.id,
  );

  assert.equal(confirmedOrder.status, "waiting_for_service");
  assert.equal(confirmedOrder.deductedQuota, 2800);
  assert.equal(confirmedOrder.finalConsumedQuota, 2800);
  assert.equal(account?.availableBalance, beforeBalance - 2800);
  assert.equal(transaction?.type, "deduction");
  assert.equal(transaction?.amount, -2800);
  assert.equal(transaction?.balanceAfter, beforeBalance - 2800);
  assert.equal(verifyMockData(data).valid, true);
});

test("缺少完整行程日期的待确认订单不能确认", () => {
  const { repository, service } = createTestContext();
  const pendingOrder = service.convertIntentToPendingOrder({
    intentId: "intent-li-moganshan",
    assigneeAccountId: "operator-staff",
    plannedQuotaDeduction: 2800,
    servicePlan: "日期尚未确认的测试订单。",
  });
  const before = repository.getSnapshot();

  assert.throws(
    () =>
      service.confirmPersonalOrder({
        orderId: pendingOrder.id,
        operator: "测试管理员",
      }),
    /必须填写出行日期和返程日期/,
  );
  assert.deepEqual(repository.getSnapshot(), before);
});

test("额度不足时订单确认失败，仓储数据保持不变", () => {
  const { repository, service } = createTestContext();

  const pendingOrder = service.convertIntentToPendingOrder({
    intentId: "intent-li-moganshan",
    assigneeAccountId: "operator-staff",
    plannedQuotaDeduction: 7000,
    servicePlan: "超出员工额度的测试订单。",
    departureDate: "2026-08-10",
    returnDate: "2026-08-13",
  });
  const before = repository.getSnapshot();

  assert.throws(
    () =>
      service.confirmPersonalOrder({
        orderId: pendingOrder.id,
        operator: "测试管理员",
      }),
    /可用额度不足/,
  );

  assert.deepEqual(repository.getSnapshot(), before);
});

test("后台可指派意向、进入沟通中并记录内部备注", () => {
  const { repository, service } = createTestContext();

  const intent = service.updateIntentFollowUp({
    intentId: "intent-li-moganshan",
    status: "communicating",
    assigneeAccountId: "operator-staff",
    internalNote: "已电话联系，员工希望确认高铁班次。",
  });

  assert.equal(intent.status, "communicating");
  assert.equal(intent.assigneeAccountId, "operator-staff");
  assert.equal(intent.internalNote, "已电话联系，员工希望确认高铁班次。");
  assert.equal(verifyMockData(repository.getSnapshot()).valid, true);
});

test("后台可关闭有效意向，已转订单意向不能再次跟进", () => {
  const closeContext = createTestContext();
  const closed = closeContext.service.closePersonalIntent({
    intentId: "intent-li-moganshan",
    assigneeAccountId: "operator-staff",
    internalNote: "员工暂不考虑出行。",
  });

  assert.equal(closed.status, "closed");

  const terminalContext = createTestContext();
  const before = terminalContext.repository.getSnapshot();

  assert.throws(
    () =>
      terminalContext.service.updateIntentFollowUp({
        intentId: "intent-zhang-sanya",
        status: "communicating",
        assigneeAccountId: "operator-staff",
      }),
    /不能继续跟进/,
  );
  assert.deepEqual(terminalContext.repository.getSnapshot(), before);
});

test("待确认订单可调整专属方案和计划额度，确认时按新额度扣减", () => {
  const { repository, service } = createTestContext();
  const beforeBalance = repository
    .getSnapshot()
    .quotaAccounts.find(
      ({ employeeId }) => employeeId === "employee-li",
    )!.availableBalance;

  const pendingOrder = service.convertIntentToPendingOrder({
    intentId: "intent-li-moganshan",
    assigneeAccountId: "operator-staff",
    plannedQuotaDeduction: 2800,
    servicePlan: "初步服务方案。",
  });
  const updatedOrder = service.updatePendingPersonalOrder({
    orderId: pendingOrder.id,
    plannedQuotaDeduction: 3000,
    servicePlan: "4天住宿、高铁站接送及当地交通协调。",
    departureDate: "2026-08-12",
    returnDate: "2026-08-15",
    transport: "高铁",
    accommodation: "莫干山合作度假酒店",
  });

  assert.equal(updatedOrder.plannedQuotaDeduction, 3000);
  assert.equal(updatedOrder.deductedQuota, 0);
  assert.equal(updatedOrder.status, "pending_confirmation");

  const confirmedOrder = service.confirmPersonalOrder({
    orderId: pendingOrder.id,
    operator: "测试管理员",
  });
  const account = repository
    .getSnapshot()
    .quotaAccounts.find(({ employeeId }) => employeeId === "employee-li");

  assert.equal(confirmedOrder.deductedQuota, 3000);
  assert.equal(account?.availableBalance, beforeBalance - 3000);
  assert.equal(verifyMockData(repository.getSnapshot()).valid, true);
});

test("已确认订单不能再按待确认订单方式调整", () => {
  const { repository, service } = createTestContext();
  const before = repository.getSnapshot();

  assert.throws(
    () =>
      service.updatePendingPersonalOrder({
        orderId: "order-zhang-sanya",
        plannedQuotaDeduction: 2000,
      }),
    /只有待确认订单可以调整/,
  );
  assert.deepEqual(repository.getSnapshot(), before);
});

test("订单负责人只能选择启用中的运营账号", () => {
  const { repository, service } = createTestContext();

  const assigned = service.assignPersonalOrder({
    orderId: "order-zhang-sanya",
    assigneeAccountId: "operator-staff",
  });
  assert.equal(assigned.assigneeAccountId, "operator-staff");

  service.updateOperatorAccount({
    actorAccountId: "operator-leader",
    accountId: "operator-staff",
    displayName: "林溪",
    role: "staff",
    status: "disabled",
    pagePermissions: ["products", "intents", "orders"],
  });

  assert.throws(
    () =>
      service.assignPersonalOrder({
        orderId: "order-zhang-sanya",
        assigneeAccountId: "operator-staff",
      }),
    /停用的运营账号/,
  );
  assert.equal(verifyMockData(repository.getSnapshot()).valid, true);
});

test("个人订单按北京时间在出行与返程边界自动流转", () => {
  const departureContext = createTestContext("2026-07-14T16:00:00Z");
  assert.equal(departureContext.service.syncPersonalOrderStatuses(), 1);
  assert.equal(
    departureContext.repository
      .getSnapshot()
      .personalOrders.find(({ id }) => id === "order-zhang-sanya")?.status,
    "in_service",
  );

  const returnDayContext = createTestContext("2026-07-19T15:59:59Z");
  returnDayContext.service.syncPersonalOrderStatuses();
  assert.equal(
    returnDayContext.repository
      .getSnapshot()
      .personalOrders.find(({ id }) => id === "order-zhang-sanya")?.status,
    "in_service",
  );

  const completedContext = createTestContext("2026-07-19T16:00:00Z");
  completedContext.service.syncPersonalOrderStatuses();
  assert.equal(
    completedContext.repository
      .getSnapshot()
      .personalOrders.find(({ id }) => id === "order-zhang-sanya")?.status,
    "completed",
  );
  assert.equal(
    completedContext.repository
      .getSnapshot()
      .personalOrders.find(({ id }) => id === "order-wang-moganshan")?.status,
    "cancelled",
  );
  assert.equal(
    verifyMockData(completedContext.repository.getSnapshot()).valid,
    true,
  );
});

test("调整待出行订单日期后立即重新计算状态", () => {
  const { service } = createTestContext("2026-07-16T08:00:00+08:00");

  const updated = service.updatePersonalOrderTravelDates({
    orderId: "order-zhang-sanya",
    departureDate: "2026-07-16",
    returnDate: "2026-07-20",
  });
  assert.equal(updated.status, "in_service");

  assert.throws(
    () =>
      service.updatePersonalOrderTravelDates({
        orderId: "order-wang-moganshan",
        departureDate: "2026-07-20",
        returnDate: "2026-07-19",
      }),
    /返程日期不能早于出行日期/,
  );
});

test("取消已扣减订单只变更状态，不自动退回额度", () => {
  const { repository, service } = createTestContext();
  const before = repository.getSnapshot();
  const beforeAccount = before.quotaAccounts.find(
    ({ employeeId }) => employeeId === "employee-zhang",
  );
  const beforeTransactionCount = before.quotaTransactions.length;

  const cancelledOrder = service.updatePersonalOrderStatus({
    orderId: "order-zhang-sanya",
    status: "cancelled",
  });
  const after = repository.getSnapshot();
  const afterAccount = after.quotaAccounts.find(
    ({ employeeId }) => employeeId === "employee-zhang",
  );

  assert.equal(cancelledOrder.status, "cancelled");
  assert.equal(cancelledOrder.refundedQuota, 0);
  assert.equal(cancelledOrder.finalConsumedQuota, 3200);
  assert.equal(
    afterAccount?.availableBalance,
    beforeAccount?.availableBalance,
  );
  assert.equal(after.quotaTransactions.length, beforeTransactionCount);
  assert.equal(verifyMockData(after).valid, true);
});

test("已完成订单可提交一次评价并进入待审核", () => {
  const initialData = structuredClone(mockData);
  initialData.serviceReviews = [];
  const { repository, service } = createTestContext(
    "2026-06-30T10:00:00+08:00",
    initialData,
  );

  const review = service.submitPersonalOrderReview({
    orderId: "order-li-moganshan-completed",
    employeeId: "employee-li",
    rating: 5,
    content: "  行程安排顺利，住宿环境安静。  ",
  });

  assert.equal(review.status, "pending_review");
  assert.equal(review.content, "行程安排顺利，住宿环境安静。");
  assert.equal(repository.getSnapshot().serviceReviews.length, 1);
  assert.equal(verifyMockData(repository.getSnapshot()).valid, true);

  assert.throws(
    () =>
      service.submitPersonalOrderReview({
        orderId: "order-li-moganshan-completed",
        employeeId: "employee-li",
        rating: 4,
        content: "再次评价",
      }),
    /已经提交过评价/,
  );
});

test("未完成订单或非本人订单不能提交评价", () => {
  const { service } = createTestContext();

  assert.throws(
    () =>
      service.submitPersonalOrderReview({
        orderId: "order-zhang-sanya",
        employeeId: "employee-zhang",
        rating: 5,
        content: "提前评价",
      }),
    /只有已完成订单可以评价/,
  );
  assert.throws(
    () =>
      service.submitPersonalOrderReview({
        orderId: "order-li-moganshan-completed",
        employeeId: "employee-zhang",
        rating: 5,
        content: "评价他人订单",
      }),
    /只能评价本人的订单/,
  );
});

test("有评价管理权限的运营账号可展示或隐藏评价", () => {
  const { repository, service } = createTestContext();

  assert.throws(
    () =>
      service.moderateServiceReview({
        reviewId: "review-li-moganshan",
        actorAccountId: "operator-staff",
        status: "published",
      }),
    /没有评价管理权限/,
  );

  const published = service.moderateServiceReview({
    reviewId: "review-li-moganshan",
    actorAccountId: "operator-leader",
    status: "published",
  });
  assert.equal(published.status, "published");
  assert.equal(published.moderatedByAccountId, "operator-leader");

  const hidden = service.moderateServiceReview({
    reviewId: "review-li-moganshan",
    actorAccountId: "operator-leader",
    status: "hidden",
  });
  assert.equal(hidden.status, "hidden");
  assert.equal(verifyMockData(repository.getSnapshot()).valid, true);
});

test("创建服务商品后保持未上架，并可显式上架", () => {
  const { repository, service } = createTestContext();

  const draft = service.createServiceProduct({
    name: "安吉竹海静养服务",
    type: "travel",
    summary: "适合短期放松的山林静养服务。",
    coverImage: "/mock-images/anji-cover.jpg",
    quotaReference: { min: 1800, max: 3000 },
    serviceDescription: "提供住宿、接送站和基础服务协调。",
    notes: "最终安排以线下沟通为准。",
    visibility: {
      scope: "specified_groups",
      groupIds: ["group-xingchen"],
    },
    travelDetails: {
      destination: "浙江·安吉",
      destinationHighlights: "竹海环境安静，适合短期休养。",
      suitableTravelMonths: [4, 5, 6, 7, 8, 9, 10],
      recommendedStayDays: "3-4天",
      serviceScope: "包含住宿和基础协调服务。",
    },
  });

  assert.equal(draft.status, "draft");

  const published = service.publishServiceProduct(draft.id);
  const data = repository.getSnapshot();

  assert.equal(published.status, "published");
  assert.equal(
    data.serviceProducts.find(({ id }) => id === draft.id)?.status,
    "published",
  );
  assert.equal(verifyMockData(data).valid, true);
});

test("商品存在意向时仍允许下架", () => {
  const { repository, service } = createTestContext();

  const product = service.unpublishServiceProduct("product-moganshan");

  assert.equal(product.status, "draft");
  assert.equal(
    repository
      .getSnapshot()
      .serviceProducts.find(({ id }) => id === product.id)?.status,
    "draft",
  );
});

test("员工提交意向不扣额度、不生成流水", () => {
  const { repository, service } = createTestContext();
  const before = repository.getSnapshot();

  const intent = service.submitPersonalIntent({
    employeeId: "employee-li",
    productId: "product-sanya",
    expectedTravelDate: "2027-01-15",
    expectedStayDays: 5,
    companionCount: 1,
    preferredTransport: "飞机",
    needsPickup: true,
  });

  const after = repository.getSnapshot();
  const account = after.quotaAccounts.find(
    ({ employeeId }) => employeeId === "employee-li",
  );

  assert.equal(intent.status, "pending_follow_up");
  assert.equal(
    account?.availableBalance,
    before.quotaAccounts.find(
      ({ employeeId }) => employeeId === "employee-li",
    )?.availableBalance,
  );
  assert.equal(
    after.quotaTransactions.length,
    before.quotaTransactions.length,
  );
  assert.equal(verifyMockData(after).valid, true);
});

test("提交意向受适宜月份和最多两个有效意向限制", () => {
  const monthContext = createTestContext();

  assert.throws(
    () =>
      monthContext.service.submitPersonalIntent({
        employeeId: "employee-wang",
        productId: "product-moganshan",
        expectedTravelDate: "2027-01-10",
        expectedStayDays: 3,
      }),
    /不在商品适宜出行月份内/,
  );

  const countContext = createTestContext();
  countContext.service.submitPersonalIntent({
    employeeId: "employee-li",
    productId: "product-sanya",
    expectedTravelDate: "2027-01-15",
    expectedStayDays: 5,
  });

  assert.throws(
    () =>
      countContext.service.submitPersonalIntent({
        employeeId: "employee-li",
        productId: "product-sanya",
        expectedTravelDate: "2027-02-15",
        expectedStayDays: 4,
      }),
    /最多同时保留 2 个有效意向/,
  );
});

test("提交意向的预计出行日期不能早于上海当前日期", () => {
  const { service } = createTestContext("2026-06-30T00:30:00+08:00");

  assert.throws(
    () =>
      service.submitPersonalIntent({
        employeeId: "employee-li",
        productId: "product-sanya",
        expectedTravelDate: "2026-06-29",
        expectedStayDays: 5,
      }),
    /不能早于今天/,
  );
});

test("员工可撤销自己的有效意向，且不会改变额度或生成流水", () => {
  const { repository, service } = createTestContext();
  const before = repository.getSnapshot();
  const withdrawn = service.withdrawPersonalIntent({
    employeeId: "employee-zhang",
    intentId: "intent-zhang-moganshan",
  });
  const after = repository.getSnapshot();

  assert.equal(withdrawn.status, "withdrawn_by_employee");
  assert.deepEqual(after.quotaAccounts, before.quotaAccounts);
  assert.deepEqual(after.quotaTransactions, before.quotaTransactions);
  assert.equal(verifyMockData(after).valid, true);
});

test("员工不能撤销他人意向或已转订单意向", () => {
  const { service } = createTestContext();

  assert.throws(
    () =>
      service.withdrawPersonalIntent({
        employeeId: "employee-li",
        intentId: "intent-zhang-moganshan",
      }),
    /只能撤销本人的意向/,
  );
  assert.throws(
    () =>
      service.withdrawPersonalIntent({
        employeeId: "employee-zhang",
        intentId: "intent-zhang-sanya",
      }),
    /只有待跟进或沟通中的意向可以撤销/,
  );
});

test("集团可编辑，删除时级联清理员工业务数据和商品可见权限", () => {
  const { repository, service } = createTestContext();

  const updated = service.updateGroup({
    groupId: "group-xingchen",
    name: "星辰科技集团（更新）",
    contactName: "新联系人",
    contactPhone: "13800009999",
    cooperationStartDate: "2026-01-01",
    status: "active",
  });

  assert.equal(updated.name, "星辰科技集团（更新）");

  const result = service.deleteGroup("group-xingchen");
  const data = repository.getSnapshot();

  assert.equal(result.deletedEmployees, 2);
  assert.equal(result.deletedOrders, 2);
  assert.equal(
    data.employees.some(({ groupId }) => groupId === "group-xingchen"),
    false,
  );
  assert.equal(
    data.personalOrders.some(({ groupId }) => groupId === "group-xingchen"),
    false,
  );
  assert.equal(
    data.serviceProducts
      .filter(({ visibility }) => visibility.scope === "specified_groups")
      .some(({ visibility }) =>
        visibility.scope === "specified_groups"
          ? visibility.groupIds.includes("group-xingchen")
          : false,
      ),
    false,
  );
  assert.equal(verifyMockData(data).valid, true);
});

test("批量创建员工后可编辑非登录字段，无订单员工可删除", () => {
  const { repository, service } = createTestContext();

  const employees = service.createEmployeesBatch({
    groupId: "group-lvzhou",
    employees: [
      {
        name: "批量员工甲",
        phone: "13900008801",
        department: "工程部",
      },
      {
        name: "批量员工乙",
        phone: "13900008802",
        employeeNumber: "LZ-8802",
      },
    ],
  });

  const edited = service.updateEmployee({
    employeeId: employees[0]!.id,
    groupId: "group-lvzhou",
    department: "综合管理部",
    status: "active",
  });
  assert.equal(edited.name, "批量员工甲");
  assert.equal(edited.phone, "13900008801");
  assert.equal(employees[0]?.password, "123456");
  assert.equal(edited.department, "综合管理部");

  service.deleteEmployee(employees[1]!.id);
  assert.equal(
    repository
      .getSnapshot()
      .employees.some(({ id }) => id === employees[1]!.id),
    false,
  );
  assert.equal(verifyMockData(repository.getSnapshot()).valid, true);
});

test("已有订单的员工禁止删除", () => {
  const { repository, service } = createTestContext();
  const before = repository.getSnapshot();

  assert.throws(
    () => service.deleteEmployee("employee-zhang"),
    /已有订单/,
  );
  assert.deepEqual(repository.getSnapshot(), before);
});

test("同一集团员工可批量发放额度并分别生成流水", () => {
  const { repository, service } = createTestContext();
  const before = repository.getSnapshot();

  const transactions = service.grantQuotaBatch({
    employeeIds: ["employee-zhang", "employee-li"],
    amount: 500,
    reason: "集团批量追加额度",
    operator: "测试管理员",
  });
  const data = repository.getSnapshot();

  assert.equal(transactions.length, 2);
  assert.equal(
    data.quotaAccounts.find(
      ({ employeeId }) => employeeId === "employee-zhang",
    )?.availableBalance,
    before.quotaAccounts.find(
      ({ employeeId }) => employeeId === "employee-zhang",
    )!.availableBalance + 500,
  );
  assert.equal(
    data.quotaAccounts.find(
      ({ employeeId }) => employeeId === "employee-li",
    )?.availableBalance,
    before.quotaAccounts.find(
      ({ employeeId }) => employeeId === "employee-li",
    )!.availableBalance + 500,
  );
  assert.equal(verifyMockData(data).valid, true);
});

test("后台可增加或调减员工额度并生成调整流水", () => {
  const { repository, service } = createTestContext();
  const beforeBalance = repository
    .getSnapshot()
    .quotaAccounts.find(
      ({ employeeId }) => employeeId === "employee-li",
    )!.availableBalance;

  const increase = service.adjustQuota({
    employeeId: "employee-li",
    amount: 500,
    reason: "人工补正额度",
    operator: "测试管理员",
  });
  const decrease = service.adjustQuota({
    employeeId: "employee-li",
    amount: -200,
    reason: "修正重复发放",
    operator: "测试管理员",
  });
  const account = repository
    .getSnapshot()
    .quotaAccounts.find(({ employeeId }) => employeeId === "employee-li");

  assert.equal(increase.type, "adjustment");
  assert.equal(increase.balanceAfter, beforeBalance + 500);
  assert.equal(decrease.amount, -200);
  assert.equal(account?.totalAdjusted, 300);
  assert.equal(account?.availableBalance, beforeBalance + 300);
  assert.equal(verifyMockData(repository.getSnapshot()).valid, true);
});

test("额度调减不能使员工可用余额小于零", () => {
  const { repository, service } = createTestContext();
  const before = repository.getSnapshot();

  assert.throws(
    () =>
      service.adjustQuota({
        employeeId: "employee-li",
        amount: -7000,
        reason: "错误调减",
        operator: "测试管理员",
      }),
    /不能小于 0/,
  );
  assert.deepEqual(repository.getSnapshot(), before);
});

test("订单额度支持多次部分退回并同步订单、账户和流水", () => {
  const { repository, service } = createTestContext();

  const firstRefund = service.refundPersonalOrderQuota({
    orderId: "order-zhang-sanya",
    amount: 1000,
    reason: "部分服务取消",
    internalNote: "已与员工和集团确认",
    operator: "测试管理员",
  });
  service.refundPersonalOrderQuota({
    orderId: "order-zhang-sanya",
    amount: 800,
    reason: "住宿标准调整",
    operator: "测试管理员",
  });

  const data = repository.getSnapshot();
  const order = data.personalOrders.find(
    ({ id }) => id === "order-zhang-sanya",
  );
  const account = data.quotaAccounts.find(
    ({ employeeId }) => employeeId === "employee-zhang",
  );
  const refunds = data.quotaTransactions.filter(
    ({ relatedOrderId, type }) =>
      relatedOrderId === "order-zhang-sanya" && type === "refund",
  );

  assert.equal(firstRefund.internalNote, "已与员工和集团确认");
  assert.equal(order?.refundedQuota, 1800);
  assert.equal(order?.finalConsumedQuota, 1400);
  assert.equal(account?.totalRefunded, 1800);
  assert.equal(account?.availableBalance, 3600);
  assert.equal(refunds.length, 2);
  assert.equal(verifyMockData(data).valid, true);
});

test("订单退回不能超过剩余可退额度", () => {
  const { repository, service } = createTestContext();
  const before = repository.getSnapshot();

  assert.throws(
    () =>
      service.refundPersonalOrderQuota({
        orderId: "order-zhang-sanya",
        amount: 3201,
        reason: "错误退回",
        operator: "测试管理员",
      }),
    /不能超过订单剩余可退额度/,
  );
  assert.deepEqual(repository.getSnapshot(), before);
});

test("意向关闭和转订单均要求填写跟进人", () => {
  const { service } = createTestContext();

  assert.throws(
    () =>
      service.closePersonalIntent({
        intentId: "intent-li-moganshan",
        assigneeAccountId: "",
      }),
    /跟进人不能为空/,
  );
  assert.throws(
    () =>
      service.convertIntentToPendingOrder({
        intentId: "intent-li-moganshan",
        assigneeAccountId: "",
        plannedQuotaDeduction: 1000,
        servicePlan: "测试方案",
      }),
    /跟进人不能为空/,
  );
});

test("已有业务记录的商品仅允许修改展示字段，说明类字段需要确认", () => {
  const { repository, service } = createTestContext();
  service.unpublishServiceProduct("product-moganshan");
  const original = repository
    .getSnapshot()
    .serviceProducts.find(({ id }) => id === "product-moganshan")!;

  assert.throws(
    () =>
      service.updateServiceProduct({
        ...original,
        productId: original.id,
        name: "尝试修改商品名称",
      }),
    /商品名称不可修改/,
  );
  assert.throws(
    () =>
      service.updateServiceProduct({
        ...original,
        productId: original.id,
        serviceDescription: "新的服务说明",
      }),
    /需要二次确认/,
  );

  const updated = service.updateServiceProduct({
    ...original,
    productId: original.id,
    summary: "更新后的商品简介",
    coverImage: "/mock-images/moganshan-new-cover.jpg",
    serviceDescription: "新的服务说明",
    travelDetails: {
      ...original.travelDetails!,
      destinationHighlights: "更新后的目的地特色。",
      serviceScope: "更新后的服务范围说明。",
    },
    confirmDescriptionChanges: true,
  });

  assert.equal(updated.summary, "更新后的商品简介");
  assert.equal(updated.travelDetails?.destination, "浙江·莫干山");
  assert.equal(updated.serviceDescription, "新的服务说明");
});

test("订单商品快照不会被后续商品修改影响", () => {
  const { repository, service } = createTestContext();
  service.unpublishServiceProduct("product-moganshan");
  const before = repository.getSnapshot();
  const product = before.serviceProducts.find(
    ({ id }) => id === "product-moganshan",
  )!;
  const historicalOrder = before.personalOrders.find(
    ({ sourceProductId }) => sourceProductId === product.id,
  )!;
  const historicalSnapshot = structuredClone(
    historicalOrder.productSnapshot,
  );

  service.updateServiceProduct({
    ...product,
    productId: product.id,
    summary: "仅用于后续展示的新简介",
    coverImage: "/mock-images/moganshan-new-cover.jpg",
  });

  const afterOrder = repository
    .getSnapshot()
    .personalOrders.find(({ id }) => id === historicalOrder.id)!;
  assert.deepEqual(afterOrder.productSnapshot, historicalSnapshot);
  assert.equal(
    afterOrder.productSnapshot.coverImage,
    historicalSnapshot.coverImage,
  );
});

test("商品仅在未上架且无业务记录时允许删除", () => {
  const { repository, service } = createTestContext();

  assert.throws(
    () => service.deleteServiceProduct("product-sanya"),
    /已上架商品不能删除/,
  );

  service.unpublishServiceProduct("product-sanya");
  assert.throws(
    () => service.deleteServiceProduct("product-sanya"),
    /意向记录/,
  );

  service.deleteServiceProduct("product-dali-draft");
  assert.equal(
    repository
      .getSnapshot()
      .serviceProducts.some(({ id }) => id === "product-dali-draft"),
    false,
  );
});

test("已上架商品必须先下架才能编辑", () => {
  const { repository, service } = createTestContext();
  const product = repository
    .getSnapshot()
    .serviceProducts.find(({ id }) => id === "product-moganshan")!;

  assert.throws(
    () =>
      service.updateServiceProduct({
        ...product,
        productId: product.id,
        summary: "尝试直接修改已上架商品",
      }),
    /请先下架/,
  );
});
