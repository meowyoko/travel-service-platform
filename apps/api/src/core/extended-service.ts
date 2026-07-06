import { randomUUID } from "node:crypto";

import {
  ADMIN_PAGE_PERMISSIONS,
  type AdminPagePermission,
  type ProductVisibility,
} from "@travel/domain";
import type {
  AdjustQuotaRequest,
  AssignOrderRequest,
  CloseIntentRequest,
  CreateEmployeesBatchRequest,
  CreateOperatorAccountRequest,
  ModerateReviewRequest,
  PublicOperatorAccount,
  RefundOrderQuotaRequest,
  UpdateEmployeeRequest,
  UpdateGroupRequest,
  UpdateOperatorAccountRequest,
  UpdateOrderTravelDatesRequest,
  UpdatePendingOrderRequest,
  UpdateServiceProductRequest,
} from "@travel/contracts";
import { and, count, eq, inArray } from "drizzle-orm";

import { hashPassword } from "../auth/password.js";
import type { Database } from "../db/client.js";
import {
  employees,
  groups,
  operatorAccounts,
  operatorPagePermissions,
  personalIntents,
  personalOrders,
  productVisibleGroups,
  quotaAccounts,
  quotaTransactions,
  serviceProducts,
  serviceReviews,
  sessions,
} from "../db/schema.js";
import { ApiError } from "../errors.js";

function optionalText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizePermissions(
  role: "leader" | "staff",
  permissions: AdminPagePermission[],
): AdminPagePermission[] {
  if (role === "leader") {
    return [...ADMIN_PAGE_PERMISSIONS];
  }
  return [
    ...new Set(
      permissions.filter(
        (permission) => permission !== "operator_accounts",
      ),
    ),
  ];
}

function getShanghaiDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function getAutomaticOrderStatus(
  departureDate: string,
  returnDate: string,
  now = new Date(),
): "waiting_for_service" | "in_service" | "completed" {
  const today = getShanghaiDate(now);
  if (today < departureDate) return "waiting_for_service";
  if (today <= returnDate) return "in_service";
  return "completed";
}

function assertDateRange(departureDate: string, returnDate: string): void {
  if (returnDate < departureDate) {
    throw new ApiError(
      400,
      "INVALID_TRAVEL_DATES",
      "返程日期不能早于出行日期",
    );
  }
}

export async function updateGroup(
  db: Database,
  groupId: string,
  input: UpdateGroupRequest,
): Promise<void> {
  if (
    !input.name.trim() ||
    !input.contactName.trim() ||
    !input.contactPhone.trim()
  ) {
    throw new ApiError(400, "INVALID_GROUP", "集团基础信息不能为空");
  }
  if (
    input.cooperationEndDate &&
    input.cooperationEndDate < input.cooperationStartDate
  ) {
    throw new ApiError(
      400,
      "INVALID_COOPERATION_DATES",
      "合作结束日期不能早于开始日期",
    );
  }
  const result = await db
    .update(groups)
    .set({
      name: input.name.trim(),
      contactName: input.contactName.trim(),
      contactPhone: input.contactPhone.trim(),
      cooperationStartDate: input.cooperationStartDate,
      cooperationEndDate: input.cooperationEndDate ?? null,
      status: input.status,
      note: optionalText(input.note),
    })
    .where(eq(groups.id, groupId))
    .returning({ id: groups.id });
  if (result.length === 0) {
    throw new ApiError(404, "GROUP_NOT_FOUND", "集团不存在");
  }
}

export async function deleteGroup(
  db: Database,
  groupId: string,
): Promise<{ deletedEmployees: number; deletedOrders: number }> {
  return db.transaction(async (tx) => {
    const [group] = await tx
      .select()
      .from(groups)
      .where(eq(groups.id, groupId))
      .for("update");
    if (!group) {
      throw new ApiError(404, "GROUP_NOT_FOUND", "集团不存在");
    }
    const [employeeCount] = await tx
      .select({ value: count() })
      .from(employees)
      .where(eq(employees.groupId, groupId));
    const [orderCount] = await tx
      .select({ value: count() })
      .from(personalOrders)
      .where(eq(personalOrders.groupId, groupId));
    const affectedProducts = await tx
      .select({ productId: productVisibleGroups.productId })
      .from(productVisibleGroups)
      .where(eq(productVisibleGroups.groupId, groupId));

    await tx.delete(groups).where(eq(groups.id, groupId));

    for (const { productId } of affectedProducts) {
      const [remaining] = await tx
        .select({ value: count() })
        .from(productVisibleGroups)
        .where(eq(productVisibleGroups.productId, productId));
      if ((remaining?.value ?? 0) === 0) {
        await tx
          .update(serviceProducts)
          .set({ status: "draft", updatedAt: new Date() })
          .where(eq(serviceProducts.id, productId));
      }
    }
    return {
      deletedEmployees: employeeCount?.value ?? 0,
      deletedOrders: orderCount?.value ?? 0,
    };
  });
}

export async function createEmployeesBatch(
  db: Database,
  input: CreateEmployeesBatchRequest,
): Promise<string[]> {
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.id, input.groupId));
  if (!group) {
    throw new ApiError(404, "GROUP_NOT_FOUND", "员工所属集团不存在");
  }
  const normalized = input.employees.map((employee, index) => {
    const name = employee.name.trim();
    const phone = employee.phone.trim();
    if (!name || !phone) {
      throw new ApiError(
        400,
        "INVALID_EMPLOYEE",
        `第 ${index + 1} 行员工姓名和手机号不能为空`,
      );
    }
    return {
      ...employee,
      name,
      phone,
      password: employee.password ?? "123456",
    };
  });
  if (new Set(normalized.map(({ phone }) => phone)).size !== normalized.length) {
    throw new ApiError(409, "DUPLICATE_PHONE", "导入文件中存在重复手机号");
  }
  const passwordHashes = await Promise.all(
    normalized.map(({ password }) => hashPassword(password)),
  );
  const ids = normalized.map(() => randomUUID());
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(employees).values(
      normalized.map((employee, index) => ({
        id: ids[index]!,
        name: employee.name,
        phone: employee.phone,
        passwordHash: passwordHashes[index]!,
        groupId: input.groupId,
        department: optionalText(employee.department),
        employeeNumber: optionalText(employee.employeeNumber),
        status: "active" as const,
        createdAt: now,
      })),
    );
    await tx.insert(quotaAccounts).values(
      ids.map((employeeId) => ({
        id: randomUUID(),
        employeeId,
        totalGranted: 0,
        totalDeducted: 0,
        totalRefunded: 0,
        totalAdjusted: 0,
        availableBalance: 0,
        updatedAt: now,
      })),
    );
  });
  return ids;
}

export async function updateEmployee(
  db: Database,
  employeeId: string,
  input: UpdateEmployeeRequest,
): Promise<void> {
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.id, input.groupId));
  if (!group) {
    throw new ApiError(404, "GROUP_NOT_FOUND", "员工所属集团不存在");
  }
  const result = await db
    .update(employees)
    .set({
      groupId: input.groupId,
      department: optionalText(input.department),
      employeeNumber: optionalText(input.employeeNumber),
      position: optionalText(input.position),
      status: input.status,
      note: optionalText(input.note),
    })
    .where(eq(employees.id, employeeId))
    .returning({ id: employees.id });
  if (result.length === 0) {
    throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "员工不存在");
  }
}

export async function deleteEmployee(
  db: Database,
  employeeId: string,
): Promise<void> {
  const [orders] = await db
    .select({ value: count() })
    .from(personalOrders)
    .where(eq(personalOrders.employeeId, employeeId));
  if ((orders?.value ?? 0) > 0) {
    throw new ApiError(409, "EMPLOYEE_HAS_ORDERS", "该员工已有订单，一期不允许删除");
  }
  const result = await db
    .delete(employees)
    .where(eq(employees.id, employeeId))
    .returning({ id: employees.id });
  if (result.length === 0) {
    throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "员工不存在");
  }
}

export async function adjustQuota(
  db: Database,
  actor: PublicOperatorAccount,
  employeeId: string,
  input: AdjustQuotaRequest,
): Promise<string> {
  if (input.amount === 0 || !input.reason.trim()) {
    throw new ApiError(400, "INVALID_ADJUSTMENT", "调整额度和原因无效");
  }
  return db.transaction(async (tx) => {
    const [employee] = await tx
      .select()
      .from(employees)
      .where(eq(employees.id, employeeId))
      .for("update");
    if (!employee) throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "员工不存在");
    if (employee.status !== "active") {
      throw new ApiError(409, "EMPLOYEE_DISABLED", "停用员工不能调整额度");
    }
    const [account] = await tx
      .select()
      .from(quotaAccounts)
      .where(eq(quotaAccounts.employeeId, employeeId))
      .for("update");
    if (!account) {
      throw new ApiError(409, "QUOTA_ACCOUNT_MISSING", "员工缺少额度账户");
    }
    const balanceAfter = account.availableBalance + input.amount;
    if (balanceAfter < 0) {
      throw new ApiError(409, "INSUFFICIENT_QUOTA", "调减后可用额度不能小于 0");
    }
    const now = new Date();
    await tx
      .update(quotaAccounts)
      .set({
        totalAdjusted: account.totalAdjusted + input.amount,
        availableBalance: balanceAfter,
        updatedAt: now,
      })
      .where(eq(quotaAccounts.id, account.id));
    const id = randomUUID();
    await tx.insert(quotaTransactions).values({
      id,
      employeeId,
      type: "adjustment",
      amount: input.amount,
      balanceAfter,
      reason: input.reason.trim(),
      operator: `后台运营-${actor.displayName}`,
      occurredAt: now,
    });
    return id;
  });
}

export async function refundOrderQuota(
  db: Database,
  actor: PublicOperatorAccount,
  orderId: string,
  input: RefundOrderQuotaRequest,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(personalOrders)
      .where(eq(personalOrders.id, orderId))
      .for("update");
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "个人订单不存在");
    const refundable = order.deductedQuota - order.refundedQuota;
    if (refundable <= 0 || input.amount > refundable) {
      throw new ApiError(409, "INVALID_REFUND", "退回额度超过订单剩余可退额度");
    }
    const [account] = await tx
      .select()
      .from(quotaAccounts)
      .where(eq(quotaAccounts.employeeId, order.employeeId))
      .for("update");
    if (!account) {
      throw new ApiError(409, "QUOTA_ACCOUNT_MISSING", "员工缺少额度账户");
    }
    const now = new Date();
    const balanceAfter = account.availableBalance + input.amount;
    await tx
      .update(quotaAccounts)
      .set({
        totalRefunded: account.totalRefunded + input.amount,
        availableBalance: balanceAfter,
        updatedAt: now,
      })
      .where(eq(quotaAccounts.id, account.id));
    await tx
      .update(personalOrders)
      .set({
        refundedQuota: order.refundedQuota + input.amount,
        finalConsumedQuota:
          order.deductedQuota - order.refundedQuota - input.amount,
        updatedAt: now,
      })
      .where(eq(personalOrders.id, order.id));
    const id = randomUUID();
    await tx.insert(quotaTransactions).values({
      id,
      employeeId: order.employeeId,
      type: "refund",
      amount: input.amount,
      balanceAfter,
      relatedOrderId: order.id,
      reason: input.reason.trim(),
      internalNote: optionalText(input.internalNote),
      operator: `后台运营-${actor.displayName}`,
      occurredAt: now,
    });
    return id;
  });
}

function sameVisibility(
  left: ProductVisibility,
  right: ProductVisibility,
): boolean {
  if (left.scope !== right.scope) return false;
  if (left.scope === "all_groups" || right.scope === "all_groups") return true;
  return (
    [...left.groupIds].sort().join("|") ===
    [...right.groupIds].sort().join("|")
  );
}

export async function updateServiceProduct(
  db: Database,
  productId: string,
  input: UpdateServiceProductRequest,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [product] = await tx
      .select()
      .from(serviceProducts)
      .where(eq(serviceProducts.id, productId))
      .for("update");
    if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "服务商品不存在");
    if (product.status !== "draft") {
      throw new ApiError(409, "PRODUCT_PUBLISHED", "已上架商品不能编辑，请先下架");
    }
    const currentGroups = await tx
      .select({ groupId: productVisibleGroups.groupId })
      .from(productVisibleGroups)
      .where(eq(productVisibleGroups.productId, productId));
    const currentVisibility: ProductVisibility =
      product.visibilityScope === "all_groups"
        ? { scope: "all_groups" }
        : {
            scope: "specified_groups",
            groupIds: currentGroups.map(({ groupId }) => groupId),
          };
    const nextGroupIds =
      input.visibility.scope === "specified_groups"
        ? input.visibility.groupIds ?? []
        : [];
    if (
      input.visibility.scope === "specified_groups" &&
      nextGroupIds.length === 0
    ) {
      throw new ApiError(400, "VISIBLE_GROUP_REQUIRED", "请至少选择一个可见集团");
    }
    const nextVisibility: ProductVisibility =
      input.visibility.scope === "all_groups"
        ? { scope: "all_groups" }
        : { scope: "specified_groups", groupIds: nextGroupIds };
    const [intentUsage, orderUsage] = await Promise.all([
      tx
        .select({ value: count() })
        .from(personalIntents)
        .where(eq(personalIntents.productId, productId)),
      tx
        .select({ value: count() })
        .from(personalOrders)
        .where(eq(personalOrders.sourceProductId, productId)),
    ]);
    const hasBusiness =
      (intentUsage[0]?.value ?? 0) > 0 || (orderUsage[0]?.value ?? 0) > 0;
    if (hasBusiness) {
      if (
        product.name !== input.name.trim() ||
        product.type !== input.type ||
        JSON.stringify(product.quotaReference) !==
          JSON.stringify(input.quotaReference) ||
        !sameVisibility(currentVisibility, nextVisibility) ||
        product.travelDetails?.destination !==
          input.travelDetails?.destination ||
        product.travelDetails?.recommendedStayDays !==
          input.travelDetails?.recommendedStayDays ||
        JSON.stringify(product.travelDetails?.suitableTravelMonths) !==
          JSON.stringify(input.travelDetails?.suitableTravelMonths) ||
        JSON.stringify(product.gallery) !== JSON.stringify(input.gallery) ||
        product.sortOrder !== (input.sortOrder ?? null) ||
        product.recommended !== (input.recommended ?? null)
      ) {
        throw new ApiError(
          409,
          "PRODUCT_FIELDS_LOCKED",
          "该商品已有业务记录，当前修改包含不可变字段",
        );
      }
      const descriptionsChanged =
        product.serviceDescription !== input.serviceDescription.trim() ||
        product.notes !== input.notes.trim() ||
        product.travelDetails?.serviceScope !==
          input.travelDetails?.serviceScope;
      if (descriptionsChanged && !input.confirmDescriptionChanges) {
        throw new ApiError(
          409,
          "DESCRIPTION_CONFIRMATION_REQUIRED",
          "说明类字段发生变化，需要二次确认",
        );
      }
    }
    await tx
      .update(serviceProducts)
      .set({
        name: input.name.trim(),
        type: input.type,
        summary: input.summary.trim(),
        coverImage: input.coverImage.trim(),
        gallery: input.gallery ?? null,
        quotaReference: input.quotaReference ?? null,
        serviceDescription: input.serviceDescription.trim(),
        notes: input.notes.trim(),
        visibilityScope: input.visibility.scope,
        sortOrder: input.sortOrder ?? null,
        recommended: input.recommended ?? null,
        travelDetails: input.travelDetails ?? null,
        updatedAt: new Date(),
      })
      .where(eq(serviceProducts.id, product.id));
    await tx
      .delete(productVisibleGroups)
      .where(eq(productVisibleGroups.productId, product.id));
    if (nextGroupIds.length > 0) {
      await tx.insert(productVisibleGroups).values(
        nextGroupIds.map((groupId) => ({ productId, groupId })),
      );
    }
  });
}

export async function unpublishServiceProduct(
  db: Database,
  productId: string,
): Promise<void> {
  const result = await db
    .update(serviceProducts)
    .set({ status: "draft", updatedAt: new Date() })
    .where(
      and(
        eq(serviceProducts.id, productId),
        eq(serviceProducts.status, "published"),
      ),
    )
    .returning({ id: serviceProducts.id });
  if (result.length === 0) {
    throw new ApiError(409, "PRODUCT_NOT_PUBLISHED", "商品不存在或尚未上架");
  }
}

export async function deleteServiceProduct(
  db: Database,
  productId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [product] = await tx
      .select()
      .from(serviceProducts)
      .where(eq(serviceProducts.id, productId))
      .for("update");
    if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "服务商品不存在");
    if (product.status !== "draft") {
      throw new ApiError(409, "PRODUCT_PUBLISHED", "已上架商品不能删除，请先下架");
    }
    const [intentCount, orderCount] = await Promise.all([
      tx
        .select({ value: count() })
        .from(personalIntents)
        .where(eq(personalIntents.productId, productId)),
      tx
        .select({ value: count() })
        .from(personalOrders)
        .where(eq(personalOrders.sourceProductId, productId)),
    ]);
    if (
      (intentCount[0]?.value ?? 0) > 0 ||
      (orderCount[0]?.value ?? 0) > 0
    ) {
      throw new ApiError(409, "PRODUCT_IN_USE", "商品已有业务记录，只能下架");
    }
    await tx.delete(serviceProducts).where(eq(serviceProducts.id, productId));
  });
}

export async function closeIntent(
  db: Database,
  intentId: string,
  input: CloseIntentRequest,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [assignee] = await tx
      .select()
      .from(operatorAccounts)
      .where(eq(operatorAccounts.id, input.assigneeAccountId));
    if (!assignee || assignee.status !== "active") {
      throw new ApiError(409, "ASSIGNEE_UNAVAILABLE", "跟进人不存在或已停用");
    }
    const [intent] = await tx
      .select()
      .from(personalIntents)
      .where(eq(personalIntents.id, intentId))
      .for("update");
    if (!intent) throw new ApiError(404, "INTENT_NOT_FOUND", "个人意向不存在");
    if (!["pending_follow_up", "communicating"].includes(intent.status)) {
      throw new ApiError(409, "INTENT_ENDED", "只有有效意向可以关闭");
    }
    await tx
      .update(personalIntents)
      .set({
        status: "closed",
        assigneeAccountId: input.assigneeAccountId,
        internalNote: optionalText(input.internalNote),
        updatedAt: new Date(),
      })
      .where(eq(personalIntents.id, intent.id));
  });
}

export async function updatePendingOrder(
  db: Database,
  orderId: string,
  input: UpdatePendingOrderRequest,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(personalOrders)
      .where(eq(personalOrders.id, orderId))
      .for("update");
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "个人订单不存在");
    if (order.status !== "pending_confirmation") {
      throw new ApiError(409, "ORDER_NOT_PENDING", "只有待确认订单可以调整内容");
    }
    const departureDate = input.departureDate ?? order.departureDate;
    const returnDate = input.returnDate ?? order.returnDate;
    if (
      input.departureDate !== undefined ||
      input.returnDate !== undefined
    ) {
      if (!departureDate || !returnDate) {
        throw new ApiError(400, "TRAVEL_DATES_REQUIRED", "出行和返程日期必须同时填写");
      }
      assertDateRange(departureDate, returnDate);
    }
    await tx
      .update(personalOrders)
      .set({
        ...(input.plannedQuotaDeduction !== undefined
          ? { plannedQuotaDeduction: input.plannedQuotaDeduction }
          : {}),
        ...(input.servicePlan !== undefined
          ? { servicePlan: input.servicePlan.trim() }
          : {}),
        ...(departureDate ? { departureDate } : {}),
        ...(returnDate ? { returnDate } : {}),
        ...(input.transport !== undefined
          ? { transport: optionalText(input.transport) }
          : {}),
        ...(input.accommodation !== undefined
          ? { accommodation: optionalText(input.accommodation) }
          : {}),
        ...(input.pickupService !== undefined
          ? { pickupService: optionalText(input.pickupService) }
          : {}),
        ...(input.internalNote !== undefined
          ? { internalNote: optionalText(input.internalNote) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(personalOrders.id, order.id));
  });
}

export async function assignOrder(
  db: Database,
  orderId: string,
  input: AssignOrderRequest,
): Promise<void> {
  const [assignee] = await db
    .select()
    .from(operatorAccounts)
    .where(eq(operatorAccounts.id, input.assigneeAccountId));
  if (!assignee || assignee.status !== "active") {
    throw new ApiError(409, "ASSIGNEE_UNAVAILABLE", "订单负责人不存在或已停用");
  }
  const result = await db
    .update(personalOrders)
    .set({ assigneeAccountId: assignee.id, updatedAt: new Date() })
    .where(eq(personalOrders.id, orderId))
    .returning({ id: personalOrders.id });
  if (result.length === 0) {
    throw new ApiError(404, "ORDER_NOT_FOUND", "个人订单不存在");
  }
}

export async function updateOrderTravelDates(
  db: Database,
  orderId: string,
  input: UpdateOrderTravelDatesRequest,
): Promise<void> {
  assertDateRange(input.departureDate, input.returnDate);
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(personalOrders)
      .where(eq(personalOrders.id, orderId))
      .for("update");
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "个人订单不存在");
    if (
      !["pending_confirmation", "confirmed", "waiting_for_service"].includes(
        order.status,
      )
    ) {
      throw new ApiError(409, "ORDER_DATES_LOCKED", "当前订单不能调整出行日期");
    }
    await tx
      .update(personalOrders)
      .set({
        departureDate: input.departureDate,
        returnDate: input.returnDate,
        ...(order.status !== "pending_confirmation"
          ? {
              status: getAutomaticOrderStatus(
                input.departureDate,
                input.returnDate,
              ),
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(personalOrders.id, order.id));
  });
}

export async function cancelOrder(
  db: Database,
  orderId: string,
): Promise<void> {
  const result = await db
    .update(personalOrders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(personalOrders.id, orderId),
        inArray(personalOrders.status, [
          "pending_confirmation",
          "confirmed",
          "waiting_for_service",
          "in_service",
        ]),
      ),
    )
    .returning({ id: personalOrders.id });
  if (result.length === 0) {
    throw new ApiError(409, "ORDER_NOT_CANCELLABLE", "当前订单状态不允许取消");
  }
}

export async function syncOrderStatuses(db: Database): Promise<number> {
  const orders = await db
    .select()
    .from(personalOrders)
    .where(
      inArray(personalOrders.status, [
        "confirmed",
        "waiting_for_service",
        "in_service",
      ]),
    );
  let updated = 0;
  for (const order of orders) {
    if (!order.departureDate || !order.returnDate) continue;
    const status = getAutomaticOrderStatus(
      order.departureDate,
      order.returnDate,
    );
    if (status !== order.status) {
      await db
        .update(personalOrders)
        .set({ status, updatedAt: new Date() })
        .where(eq(personalOrders.id, order.id));
      updated += 1;
    }
  }
  return updated;
}

export async function moderateReview(
  db: Database,
  actor: PublicOperatorAccount,
  reviewId: string,
  input: ModerateReviewRequest,
): Promise<void> {
  const result = await db
    .update(serviceReviews)
    .set({
      status: input.status,
      moderatedByAccountId: actor.id,
      moderatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(serviceReviews.id, reviewId))
    .returning({ id: serviceReviews.id });
  if (result.length === 0) {
    throw new ApiError(404, "REVIEW_NOT_FOUND", "评价不存在");
  }
}

export async function createOperatorAccount(
  db: Database,
  input: CreateOperatorAccountRequest,
): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  const permissions = normalizePermissions(input.role, input.pagePermissions);
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await tx.insert(operatorAccounts).values({
      id,
      username: input.username.trim(),
      passwordHash,
      displayName: input.displayName.trim(),
      role: input.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    if (permissions.length > 0) {
      await tx.insert(operatorPagePermissions).values(
        permissions.map((permission) => ({
          operatorAccountId: id,
          permission,
        })),
      );
    }
  });
  return id;
}

export async function updateOperatorAccount(
  db: Database,
  actor: PublicOperatorAccount,
  accountId: string,
  input: UpdateOperatorAccountRequest,
): Promise<void> {
  if (actor.id === accountId && input.status === "disabled") {
    throw new ApiError(409, "CANNOT_DISABLE_SELF", "不能停用当前登录账号");
  }
  const permissions = normalizePermissions(input.role, input.pagePermissions);
  const newPasswordHash = input.newPassword
    ? await hashPassword(input.newPassword)
    : undefined;
  await db.transaction(async (tx) => {
    const result = await tx
      .update(operatorAccounts)
      .set({
        displayName: input.displayName.trim(),
        role: input.role,
        status: input.status,
        ...(newPasswordHash ? { passwordHash: newPasswordHash } : {}),
        updatedAt: new Date(),
      })
      .where(eq(operatorAccounts.id, accountId))
      .returning({ id: operatorAccounts.id });
    if (result.length === 0) {
      throw new ApiError(404, "OPERATOR_NOT_FOUND", "运营账号不存在");
    }
    await tx
      .delete(operatorPagePermissions)
      .where(eq(operatorPagePermissions.operatorAccountId, accountId));
    if (permissions.length > 0) {
      await tx.insert(operatorPagePermissions).values(
        permissions.map((permission) => ({
          operatorAccountId: accountId,
          permission,
        })),
      );
    }
    if (input.status === "disabled") {
      await tx
        .delete(sessions)
        .where(eq(sessions.operatorAccountId, accountId));
    }
  });
}
