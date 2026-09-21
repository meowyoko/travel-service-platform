import type {
  PlatformData,
  QuotaTransaction,
  ServiceProduct,
} from "@travel/domain";

export interface MockDataVerificationReport {
  valid: true;
  counts: {
    groups: number;
    operatorAccounts: number;
    employees: number;
    quotaAccounts: number;
    serviceProducts: number;
    hotelRoomTypes: number;
    hotelRoomDailyInventories: number;
    personalIntents: number;
    personalOrders: number;
    serviceReviews: number;
    quotaTransactions: number;
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Mock 数据校验失败：${message}`);
  }
}

function assertUniqueIds(items: { id: string }[], label: string): void {
  const ids = items.map(({ id }) => id);
  assert(new Set(ids).size === ids.length, `${label}存在重复 ID`);
}

function isProductVisibleToGroup(
  product: ServiceProduct,
  groupId: string,
): boolean {
  return (
    product.visibility.scope === "all_groups" ||
    product.visibility.groupIds.includes(groupId)
  );
}

function sumTransactions(
  transactions: QuotaTransaction[],
  type: QuotaTransaction["type"],
): number {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function verifyMockData(
  data: PlatformData,
): MockDataVerificationReport {
  assertUniqueIds(data.operatorAccounts, "运营账号");
  assertUniqueIds(data.groups, "集团");
  assertUniqueIds(data.employees, "员工");
  assertUniqueIds(data.quotaAccounts, "额度账户");
  assertUniqueIds(data.serviceProducts, "服务商品");
  assertUniqueIds(data.hotelRoomTypes, "酒店房型");
  assertUniqueIds(data.hotelRoomDailyInventories, "酒店日期库存");
  assertUniqueIds(data.personalIntents, "个人意向");
  assertUniqueIds(data.personalOrders, "个人订单");
  assertUniqueIds(data.serviceReviews, "服务评价");
  assertUniqueIds(data.quotaTransactions, "额度流水");
  assert(
    new Set(data.serviceReviews.map(({ orderId }) => orderId)).size ===
      data.serviceReviews.length,
    "同一订单存在重复评价",
  );
  assert(
    new Set(data.operatorAccounts.map(({ username }) => username)).size ===
      data.operatorAccounts.length,
    "运营账号用户名存在重复",
  );
  assert(
    new Set(data.employees.map(({ phone }) => phone)).size ===
      data.employees.length,
    "员工手机号存在重复",
  );

  const operatorAccounts = new Map(
    data.operatorAccounts.map((account) => [account.id, account]),
  );
  const groups = new Map(data.groups.map((group) => [group.id, group]));
  const employees = new Map(
    data.employees.map((employee) => [employee.id, employee]),
  );
  const products = new Map(
    data.serviceProducts.map((product) => [product.id, product]),
  );
  const roomTypes = new Map(
    data.hotelRoomTypes.map((roomType) => [roomType.id, roomType]),
  );
  const intents = new Map(
    data.personalIntents.map((intent) => [intent.id, intent]),
  );
  const orders = new Map(
    data.personalOrders.map((order) => [order.id, order]),
  );

  for (const employee of data.employees) {
    assert(groups.has(employee.groupId), `员工 ${employee.id} 所属集团不存在`);
    assert(employee.password.length >= 6, `员工 ${employee.id} 的密码不足 6 位`);
  }

  for (const intent of data.personalIntents) {
    assert(
      !intent.assigneeAccountId ||
        operatorAccounts.has(intent.assigneeAccountId),
      `意向 ${intent.id} 的跟进账号不存在`,
    );
  }

  for (const product of data.serviceProducts) {
    if (product.visibility.scope === "specified_groups") {
      for (const groupId of product.visibility.groupIds) {
        assert(groups.has(groupId), `商品 ${product.id} 的可见集团不存在`);
      }
    }

    assert(
      product.type !== "travel" || product.travelDetails,
      `旅游类商品 ${product.id} 缺少旅游扩展信息`,
    );
    assert(
      product.type !== "hotel" || product.hotelDetails,
      `酒店类商品 ${product.id} 缺少酒店扩展信息`,
    );
    for (const hotelProductId of product.linkedHotelProductIds ?? []) {
      const hotel = products.get(hotelProductId);
      assert(hotel?.type === "hotel", `商品 ${product.id} 绑定了无效酒店`);
    }
  }

  for (const roomType of data.hotelRoomTypes) {
    const hotel = products.get(roomType.hotelProductId);
    assert(hotel?.type === "hotel", `房型 ${roomType.id} 关联的酒店商品无效`);
  }

  for (const inventory of data.hotelRoomDailyInventories) {
    assert(roomTypes.has(inventory.roomTypeId), `库存 ${inventory.id} 的房型不存在`);
    assert(
      inventory.usedInventory <= inventory.totalInventory,
      `库存 ${inventory.id} 已使用数量超过总库存`,
    );
  }

  for (const intent of data.personalIntents) {
    const employee = employees.get(intent.employeeId);
    const product = products.get(intent.productId);

    assert(employee, `意向 ${intent.id} 的员工不存在`);
    assert(product, `意向 ${intent.id} 的商品不存在`);
    assert(
      product.status === "published",
      `意向 ${intent.id} 不能关联未上架商品`,
    );
    assert(
      isProductVisibleToGroup(product, employee.groupId),
      `意向 ${intent.id} 的商品对员工集团不可见`,
    );
    if (intent.preferredHotelProductId) {
      const hotel = products.get(intent.preferredHotelProductId);
      assert(hotel?.type === "hotel", `意向 ${intent.id} 选择的酒店无效`);
    }
    if (intent.preferredHotelRoomTypeId) {
      const roomType = roomTypes.get(intent.preferredHotelRoomTypeId);
      assert(roomType, `意向 ${intent.id} 选择的房型无效`);
    }

    if (intent.status === "converted_to_order") {
      assert(
        data.personalOrders.some(
          (order) => order.sourceIntentId === intent.id,
        ),
        `已转订单的意向 ${intent.id} 缺少对应订单`,
      );
    }
  }

  for (const order of data.personalOrders) {
    assert(
      !order.assigneeAccountId ||
        operatorAccounts.has(order.assigneeAccountId),
      `订单 ${order.id} 的负责人账号不存在`,
    );
    const employee = employees.get(order.employeeId);
    assert(employee, `订单 ${order.id} 的员工不存在`);
    assert(groups.has(order.groupId), `订单 ${order.id} 的集团不存在`);
    assert(
      employee.groupId === order.groupId,
      `订单 ${order.id} 的集团与员工归属不一致`,
    );
    assert(
      products.has(order.sourceProductId),
      `订单 ${order.id} 的来源商品不存在`,
    );
    assert(
      order.productSnapshot.productId === order.sourceProductId,
      `订单 ${order.id} 的商品快照来源不一致`,
    );
    if (order.hotelAccommodation) {
      const hotel = products.get(order.hotelAccommodation.hotelProductId);
      assert(hotel?.type === "hotel", `订单 ${order.id} 的住宿酒店无效`);
      if (order.hotelAccommodation.roomTypeId) {
        assert(
          roomTypes.has(order.hotelAccommodation.roomTypeId),
          `订单 ${order.id} 的住宿房型无效`,
        );
      }
    }
    assert(
      order.finalConsumedQuota ===
        order.deductedQuota - order.refundedQuota,
      `订单 ${order.id} 的最终消耗额度计算错误`,
    );
    assert(
      Boolean(order.departureDate) === Boolean(order.returnDate),
      `订单 ${order.id} 的出行和返程日期必须同时存在`,
    );
    if (order.departureDate && order.returnDate) {
      assert(
        /^\d{4}-\d{2}-\d{2}$/.test(order.departureDate) &&
          /^\d{4}-\d{2}-\d{2}$/.test(order.returnDate),
        `订单 ${order.id} 的行程日期格式错误`,
      );
      assert(
        order.returnDate >= order.departureDate,
        `订单 ${order.id} 的返程日期早于出行日期`,
      );
    }

    if (order.sourceIntentId) {
      const intent = intents.get(order.sourceIntentId);
      assert(intent, `订单 ${order.id} 的来源意向不存在`);
      assert(
        intent.employeeId === order.employeeId &&
          intent.productId === order.sourceProductId,
        `订单 ${order.id} 与来源意向信息不一致`,
      );
    }

    const relatedTransactions = data.quotaTransactions.filter(
      (transaction) => transaction.relatedOrderId === order.id,
    );
    const deducted = -sumTransactions(relatedTransactions, "deduction");
    const refunded = sumTransactions(relatedTransactions, "refund");

    assert(
      deducted === order.deductedQuota,
      `订单 ${order.id} 的扣减流水与订单记录不一致`,
    );
    assert(
      refunded === order.refundedQuota,
      `订单 ${order.id} 的退回流水与订单记录不一致`,
    );
  }

  for (const review of data.serviceReviews) {
    const order = orders.get(review.orderId);
    assert(order, `评价 ${review.id} 的订单不存在`);
    assert(
      order.status === "completed",
      `评价 ${review.id} 只能关联已完成订单`,
    );
    assert(
      review.employeeId === order.employeeId,
      `评价 ${review.id} 的员工与订单不一致`,
    );
    assert(
      review.productId === order.sourceProductId,
      `评价 ${review.id} 的商品与订单不一致`,
    );
    assert(
      Number.isInteger(review.rating) &&
        review.rating >= 1 &&
        review.rating <= 5,
      `评价 ${review.id} 的星级无效`,
    );
    assert(review.content.trim(), `评价 ${review.id} 的内容为空`);
    assert(
      !review.moderatedByAccountId ||
        operatorAccounts.has(review.moderatedByAccountId),
      `评价 ${review.id} 的审核账号不存在`,
    );
  }

  assert(
    data.quotaAccounts.length === data.employees.length,
    "每名员工应且仅应拥有一个额度账户",
  );

  for (const employee of data.employees) {
    const accounts = data.quotaAccounts.filter(
      (account) => account.employeeId === employee.id,
    );
    assert(accounts.length === 1, `员工 ${employee.id} 的额度账户数量异常`);

    const account = accounts[0];
    assert(account, `员工 ${employee.id} 缺少额度账户`);

    const transactions = data.quotaTransactions
      .filter((transaction) => transaction.employeeId === employee.id)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

    let balance = 0;
    for (const transaction of transactions) {
      assert(
        transaction.type !== "deduction" || transaction.amount < 0,
        `扣减流水 ${transaction.id} 必须为负数`,
      );
      assert(
        !["grant", "refund"].includes(transaction.type) ||
          transaction.amount > 0,
        `发放或退回流水 ${transaction.id} 必须为正数`,
      );
      assert(
        !transaction.relatedOrderId ||
          orders.has(transaction.relatedOrderId),
        `流水 ${transaction.id} 关联的订单不存在`,
      );

      balance += transaction.amount;
      assert(
        balance === transaction.balanceAfter,
        `流水 ${transaction.id} 的变动后余额错误`,
      );
    }

    assert(
      account.totalGranted === sumTransactions(transactions, "grant"),
      `员工 ${employee.id} 的累计发放额度错误`,
    );
    assert(
      account.totalDeducted === -sumTransactions(transactions, "deduction"),
      `员工 ${employee.id} 的累计扣减额度错误`,
    );
    assert(
      account.totalRefunded === sumTransactions(transactions, "refund"),
      `员工 ${employee.id} 的累计退回额度错误`,
    );
    assert(
      account.totalAdjusted === sumTransactions(transactions, "adjustment"),
      `员工 ${employee.id} 的累计调整额度错误`,
    );
    assert(
      account.availableBalance === balance,
      `员工 ${employee.id} 的可用余额与流水不一致`,
    );
  }

  return {
    valid: true,
    counts: {
      operatorAccounts: data.operatorAccounts.length,
      groups: data.groups.length,
      employees: data.employees.length,
      quotaAccounts: data.quotaAccounts.length,
      serviceProducts: data.serviceProducts.length,
      hotelRoomTypes: data.hotelRoomTypes.length,
      hotelRoomDailyInventories: data.hotelRoomDailyInventories.length,
      personalIntents: data.personalIntents.length,
      personalOrders: data.personalOrders.length,
      serviceReviews: data.serviceReviews.length,
      quotaTransactions: data.quotaTransactions.length,
    },
  };
}
