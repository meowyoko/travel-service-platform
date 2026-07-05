import { randomUUID } from "node:crypto";

import type {
  ConvertIntentToOrderRequest,
  CreateEmployeeRequest,
  CreateGroupRequest,
  CreateServiceProductRequest,
  GrantQuotaRequest,
  SubmitPersonalIntentRequest,
  UpdateIntentFollowUpRequest,
} from "@travel/contracts";
import type { PublicEmployee, PublicOperatorAccount } from "@travel/contracts";
import type { OrderProductSnapshot } from "@travel/domain";
import { and, count, eq, inArray } from "drizzle-orm";

import { hashPassword } from "../auth/password.js";
import type { Database } from "../db/client.js";
import {
  employees,
  groups,
  operatorAccounts,
  personalIntents,
  personalOrders,
  productVisibleGroups,
  quotaAccounts,
  quotaTransactions,
  serviceProducts,
} from "../db/schema.js";
import { ApiError } from "../errors.js";

function trimOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
  if (today < departureDate) {
    return "waiting_for_service";
  }
  if (today <= returnDate) {
    return "in_service";
  }
  return "completed";
}

function assertTravelDates(
  departureDate: string,
  returnDate: string,
): void {
  if (returnDate < departureDate) {
    throw new ApiError(
      400,
      "INVALID_TRAVEL_DATES",
      "返程日期不能早于出行日期",
    );
  }
}

export async function createGroup(
  db: Database,
  input: CreateGroupRequest,
): Promise<string> {
  const name = input.name.trim();
  if (!name || !input.contactName.trim() || !input.contactPhone.trim()) {
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

  const id = randomUUID();
  await db.insert(groups).values({
    id,
    name,
    contactName: input.contactName.trim(),
    contactPhone: input.contactPhone.trim(),
    cooperationStartDate: input.cooperationStartDate,
    cooperationEndDate: input.cooperationEndDate ?? null,
    status: input.status ?? "active",
    note: trimOptional(input.note),
    createdAt: new Date(),
  });
  return id;
}

export async function createEmployee(
  db: Database,
  input: CreateEmployeeRequest,
): Promise<string> {
  if (!input.name.trim() || !input.phone.trim()) {
    throw new ApiError(
      400,
      "INVALID_EMPLOYEE",
      "员工姓名和手机号不能为空",
    );
  }
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.id, input.groupId))
    .limit(1);
  if (!group) {
    throw new ApiError(404, "GROUP_NOT_FOUND", "员工所属集团不存在");
  }

  const passwordHash = await hashPassword(input.password);
  const employeeId = randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(employees).values({
      id: employeeId,
      name: input.name.trim(),
      phone: input.phone.trim(),
      passwordHash,
      groupId: input.groupId,
      department: trimOptional(input.department),
      employeeNumber: trimOptional(input.employeeNumber),
      position: trimOptional(input.position),
      note: trimOptional(input.note),
      status: "active",
      createdAt: now,
    });
    await tx.insert(quotaAccounts).values({
      id: randomUUID(),
      employeeId,
      totalGranted: 0,
      totalDeducted: 0,
      totalRefunded: 0,
      totalAdjusted: 0,
      availableBalance: 0,
      updatedAt: now,
    });
  });

  return employeeId;
}

export async function grantQuota(
  db: Database,
  actor: PublicOperatorAccount,
  input: GrantQuotaRequest,
): Promise<string[]> {
  const employeeIds = [...input.employeeIds].sort();
  const reason = input.reason.trim();
  if (!reason) {
    throw new ApiError(400, "INVALID_REASON", "发放原因不能为空");
  }

  return db.transaction(async (tx) => {
    const employeeRows = await tx
      .select()
      .from(employees)
      .where(inArray(employees.id, employeeIds))
      .for("update");
    if (employeeRows.length !== employeeIds.length) {
      throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "发放名单中存在无效员工");
    }
    if (employeeRows.some(({ status }) => status !== "active")) {
      throw new ApiError(409, "EMPLOYEE_DISABLED", "停用员工不能发放额度");
    }
    if (
      new Set(employeeRows.map(({ groupId }) => groupId)).size !== 1
    ) {
      throw new ApiError(
        409,
        "MULTIPLE_GROUPS",
        "批量额度管理仅支持同一集团员工",
      );
    }

    const now = new Date();
    const transactionIds: string[] = [];
    for (const employeeId of employeeIds) {
      const [account] = await tx
        .select()
        .from(quotaAccounts)
        .where(eq(quotaAccounts.employeeId, employeeId))
        .for("update");
      if (!account) {
        throw new ApiError(409, "QUOTA_ACCOUNT_MISSING", "员工缺少额度账户");
      }

      const balanceAfter = account.availableBalance + input.amount;
      await tx
        .update(quotaAccounts)
        .set({
          totalGranted: account.totalGranted + input.amount,
          availableBalance: balanceAfter,
          updatedAt: now,
        })
        .where(eq(quotaAccounts.id, account.id));

      const transactionId = randomUUID();
      transactionIds.push(transactionId);
      await tx.insert(quotaTransactions).values({
        id: transactionId,
        employeeId,
        type: "grant",
        amount: input.amount,
        balanceAfter,
        reason,
        operator: `后台运营-${actor.displayName}`,
        occurredAt: now,
      });
    }
    return transactionIds;
  });
}

export async function createServiceProduct(
  db: Database,
  input: CreateServiceProductRequest,
): Promise<string> {
  if (
    !input.name.trim() ||
    !input.summary.trim() ||
    !input.coverImage.trim() ||
    !input.serviceDescription.trim() ||
    !input.notes.trim()
  ) {
    throw new ApiError(
      400,
      "INVALID_PRODUCT",
      "商品名称、简介、主图、服务说明和注意事项不能为空",
    );
  }
  if (input.quotaReference && input.quotaReference.min <= 0) {
    throw new ApiError(
      400,
      "INVALID_QUOTA_REFERENCE",
      "额度参考下限必须大于 0",
    );
  }
  if (
    input.quotaReference?.max !== undefined &&
    input.quotaReference.max < input.quotaReference.min
  ) {
    throw new ApiError(
      400,
      "INVALID_QUOTA_REFERENCE",
      "额度参考上限不能小于下限",
    );
  }
  if (input.type === "travel" && !input.travelDetails) {
    throw new ApiError(
      400,
      "TRAVEL_DETAILS_REQUIRED",
      "疗养旅游类商品必须填写旅游扩展信息",
    );
  }
  if (
    input.travelDetails &&
    (!input.travelDetails.destination.trim() ||
      !input.travelDetails.destinationHighlights.trim() ||
      !input.travelDetails.recommendedStayDays.trim() ||
      !input.travelDetails.serviceScope.trim())
  ) {
    throw new ApiError(
      400,
      "INVALID_TRAVEL_DETAILS",
      "旅游商品的目的地、特色、停留天数和服务范围不能为空",
    );
  }

  const groupIds =
    input.visibility.scope === "specified_groups"
      ? input.visibility.groupIds ?? []
      : [];
  if (
    input.visibility.scope === "specified_groups" &&
    groupIds.length === 0
  ) {
    throw new ApiError(
      400,
      "VISIBLE_GROUP_REQUIRED",
      "指定集团可见时至少需要选择一个集团",
    );
  }
  if (groupIds.length > 0) {
    const existingGroups = await db
      .select({ id: groups.id })
      .from(groups)
      .where(inArray(groups.id, groupIds));
    if (existingGroups.length !== groupIds.length) {
      throw new ApiError(
        404,
        "VISIBLE_GROUP_NOT_FOUND",
        "商品可见集团不存在",
      );
    }
  }

  const productId = randomUUID();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(serviceProducts).values({
      id: productId,
      name: input.name.trim(),
      type: input.type,
      summary: input.summary.trim(),
      coverImage: input.coverImage.trim(),
      gallery: input.gallery ?? null,
      quotaReference: input.quotaReference ?? null,
      serviceDescription: input.serviceDescription.trim(),
      notes: input.notes.trim(),
      visibilityScope: input.visibility.scope,
      status: "draft",
      sortOrder: input.sortOrder ?? null,
      recommended: input.recommended ?? null,
      travelDetails: input.travelDetails ?? null,
      createdAt: now,
      updatedAt: now,
    });
    if (groupIds.length > 0) {
      await tx.insert(productVisibleGroups).values(
        groupIds.map((groupId) => ({ productId, groupId })),
      );
    }
  });
  return productId;
}

export async function publishServiceProduct(
  db: Database,
  productId: string,
): Promise<void> {
  const [product] = await db
    .select({ status: serviceProducts.status })
    .from(serviceProducts)
    .where(eq(serviceProducts.id, productId))
    .limit(1);
  if (!product) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "服务商品不存在");
  }
  if (product.status !== "draft") {
    throw new ApiError(409, "PRODUCT_ALREADY_PUBLISHED", "商品已经上架");
  }
  await db
    .update(serviceProducts)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(serviceProducts.id, productId));
}

export async function submitPersonalIntent(
  db: Database,
  actor: PublicEmployee,
  input: SubmitPersonalIntentRequest,
): Promise<string> {
  if (input.expectedTravelDate < getShanghaiDate()) {
    throw new ApiError(
      400,
      "TRAVEL_DATE_IN_PAST",
      "预计出行日期不能早于今天",
    );
  }

  const intentId = randomUUID();
  await db.transaction(async (tx) => {
    const [employee] = await tx
      .select()
      .from(employees)
      .where(eq(employees.id, actor.id))
      .for("update");
    if (!employee || employee.status !== "active") {
      throw new ApiError(409, "EMPLOYEE_DISABLED", "停用员工不能提交意向");
    }

    const [account] = await tx
      .select()
      .from(quotaAccounts)
      .where(eq(quotaAccounts.employeeId, employee.id));
    if (!account || account.availableBalance <= 0) {
      throw new ApiError(
        409,
        "NO_AVAILABLE_QUOTA",
        "员工当前不具备有效额度资格",
      );
    }

    const [product] = await tx
      .select()
      .from(serviceProducts)
      .where(eq(serviceProducts.id, input.productId));
    if (!product) {
      throw new ApiError(404, "PRODUCT_NOT_FOUND", "服务商品不存在");
    }
    if (product.status !== "published") {
      throw new ApiError(409, "PRODUCT_NOT_PUBLISHED", "未上架商品不能提交意向");
    }
    if (product.visibilityScope === "specified_groups") {
      const [visibleGroup] = await tx
        .select()
        .from(productVisibleGroups)
        .where(
          and(
            eq(productVisibleGroups.productId, product.id),
            eq(productVisibleGroups.groupId, employee.groupId),
          ),
        );
      if (!visibleGroup) {
        throw new ApiError(
          403,
          "PRODUCT_NOT_VISIBLE",
          "该服务商品对员工所属集团不可见",
        );
      }
    }

    const [activeIntents] = await tx
      .select({ value: count() })
      .from(personalIntents)
      .where(
        and(
          eq(personalIntents.employeeId, employee.id),
          inArray(personalIntents.status, [
            "pending_follow_up",
            "communicating",
          ]),
        ),
      );
    if ((activeIntents?.value ?? 0) >= 2) {
      throw new ApiError(
        409,
        "ACTIVE_INTENT_LIMIT",
        "每名员工最多同时保留 2 个有效意向",
      );
    }

    const suitableMonths = product.travelDetails?.suitableTravelMonths;
    if (
      suitableMonths &&
      !suitableMonths.includes(Number(input.expectedTravelDate.slice(5, 7)))
    ) {
      throw new ApiError(
        409,
        "UNSUITABLE_TRAVEL_MONTH",
        "预计出行时间不在商品适宜出行月份内",
      );
    }

    const now = new Date();
    await tx.insert(personalIntents).values({
      id: intentId,
      employeeId: employee.id,
      productId: product.id,
      expectedTravelDate: input.expectedTravelDate,
      expectedStayDays: input.expectedStayDays,
      companionCount: input.companionCount ?? null,
      preferredTransport: trimOptional(input.preferredTransport),
      needsPickup: input.needsPickup ?? null,
      accommodationPreference: trimOptional(
        input.accommodationPreference,
      ),
      additionalNotes: trimOptional(input.additionalNotes),
      convenientContactTime: trimOptional(input.convenientContactTime),
      status: "pending_follow_up",
      createdAt: now,
      updatedAt: now,
    });
  });
  return intentId;
}

export async function withdrawPersonalIntent(
  db: Database,
  actor: PublicEmployee,
  intentId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [intent] = await tx
      .select()
      .from(personalIntents)
      .where(eq(personalIntents.id, intentId))
      .for("update");
    if (!intent) {
      throw new ApiError(404, "INTENT_NOT_FOUND", "个人意向不存在");
    }
    if (intent.employeeId !== actor.id) {
      throw new ApiError(403, "FORBIDDEN", "只能撤销本人的意向");
    }
    if (!["pending_follow_up", "communicating"].includes(intent.status)) {
      throw new ApiError(
        409,
        "INTENT_NOT_WITHDRAWABLE",
        "只有待跟进或沟通中的意向可以撤销",
      );
    }
    await tx
      .update(personalIntents)
      .set({ status: "withdrawn_by_employee", updatedAt: new Date() })
      .where(eq(personalIntents.id, intent.id));
  });
}

export async function updateIntentFollowUp(
  db: Database,
  intentId: string,
  input: UpdateIntentFollowUpRequest,
): Promise<void> {
  if (input.internalNote !== undefined && !input.internalNote.trim()) {
    throw new ApiError(400, "INVALID_INTERNAL_NOTE", "内部备注不能为空");
  }
  await db.transaction(async (tx) => {
    const [assignee] = await tx
      .select()
      .from(operatorAccounts)
      .where(eq(operatorAccounts.id, input.assigneeAccountId));
    if (!assignee || assignee.status !== "active") {
      throw new ApiError(
        409,
        "ASSIGNEE_UNAVAILABLE",
        "跟进人不存在或已停用",
      );
    }

    const [intent] = await tx
      .select()
      .from(personalIntents)
      .where(eq(personalIntents.id, intentId))
      .for("update");
    if (!intent) {
      throw new ApiError(404, "INTENT_NOT_FOUND", "个人意向不存在");
    }
    if (!["pending_follow_up", "communicating"].includes(intent.status)) {
      throw new ApiError(
        409,
        "INTENT_ENDED",
        "已结束或已转订单的意向不能继续跟进",
      );
    }

    await tx
      .update(personalIntents)
      .set({
        status: input.status,
        assigneeAccountId: input.assigneeAccountId,
        internalNote: trimOptional(input.internalNote),
        updatedAt: new Date(),
      })
      .where(eq(personalIntents.id, intent.id));
  });
}

export async function convertIntentToOrder(
  db: Database,
  intentId: string,
  input: ConvertIntentToOrderRequest,
): Promise<string> {
  assertTravelDates(input.departureDate, input.returnDate);
  if (!input.servicePlan.trim()) {
    throw new ApiError(400, "INVALID_SERVICE_PLAN", "订单专属方案不能为空");
  }
  const orderId = randomUUID();

  await db.transaction(async (tx) => {
    const [assignee] = await tx
      .select()
      .from(operatorAccounts)
      .where(eq(operatorAccounts.id, input.assigneeAccountId));
    if (!assignee || assignee.status !== "active") {
      throw new ApiError(
        409,
        "ASSIGNEE_UNAVAILABLE",
        "跟进人不存在或已停用",
      );
    }

    const [intent] = await tx
      .select()
      .from(personalIntents)
      .where(eq(personalIntents.id, intentId))
      .for("update");
    if (!intent) {
      throw new ApiError(404, "INTENT_NOT_FOUND", "个人意向不存在");
    }
    if (!["pending_follow_up", "communicating"].includes(intent.status)) {
      throw new ApiError(
        409,
        "INTENT_NOT_CONVERTIBLE",
        "只有待跟进或沟通中的意向可以转订单",
      );
    }

    const [employee] = await tx
      .select()
      .from(employees)
      .where(eq(employees.id, intent.employeeId));
    if (!employee || employee.status !== "active") {
      throw new ApiError(
        409,
        "EMPLOYEE_DISABLED",
        "停用员工的意向不能转订单",
      );
    }

    const [product] = await tx
      .select()
      .from(serviceProducts)
      .where(eq(serviceProducts.id, intent.productId));
    if (!product) {
      throw new ApiError(404, "PRODUCT_NOT_FOUND", "意向关联商品不存在");
    }
    if (product.status !== "published") {
      throw new ApiError(409, "PRODUCT_NOT_PUBLISHED", "未上架商品不能转订单");
    }

    if (product.visibilityScope === "specified_groups") {
      const [visibleGroup] = await tx
        .select()
        .from(productVisibleGroups)
        .where(
          and(
            eq(productVisibleGroups.productId, product.id),
            eq(productVisibleGroups.groupId, employee.groupId),
          ),
        );
      if (!visibleGroup) {
        throw new ApiError(
          409,
          "PRODUCT_NOT_VISIBLE",
          "该商品对员工所属集团不可见",
        );
      }
    }

    const productSnapshot: OrderProductSnapshot = {
      productId: product.id,
      name: product.name,
      type: product.type,
      summary: product.summary,
      coverImage: product.coverImage,
      serviceDescription: product.serviceDescription,
      notes: product.notes,
      ...(product.gallery ? { gallery: product.gallery } : {}),
      ...(product.quotaReference
        ? { quotaReference: product.quotaReference }
        : {}),
      ...(product.travelDetails
        ? { travelDetails: product.travelDetails }
        : {}),
    };
    const now = new Date();
    const orderNumber = `PO-${now
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;

    await tx.insert(personalOrders).values({
      id: orderId,
      orderNumber,
      sourceIntentId: intent.id,
      sourceProductId: product.id,
      employeeId: employee.id,
      groupId: employee.groupId,
      productSnapshot,
      departureDate: input.departureDate,
      returnDate: input.returnDate,
      transport: trimOptional(input.transport),
      accommodation: trimOptional(input.accommodation),
      pickupService: trimOptional(input.pickupService),
      servicePlan: input.servicePlan.trim(),
      plannedQuotaDeduction: input.plannedQuotaDeduction,
      deductedQuota: 0,
      refundedQuota: 0,
      finalConsumedQuota: 0,
      status: "pending_confirmation",
      assigneeAccountId: input.assigneeAccountId,
      internalNote: trimOptional(input.internalNote),
      createdAt: now,
      updatedAt: now,
    });
    await tx
      .update(personalIntents)
      .set({
        status: "converted_to_order",
        assigneeAccountId: input.assigneeAccountId,
        updatedAt: now,
      })
      .where(eq(personalIntents.id, intent.id));
  });

  return orderId;
}

export async function confirmPersonalOrder(
  db: Database,
  actor: PublicOperatorAccount,
  orderId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(personalOrders)
      .where(eq(personalOrders.id, orderId))
      .for("update");
    if (!order) {
      throw new ApiError(404, "ORDER_NOT_FOUND", "个人订单不存在");
    }
    if (order.status !== "pending_confirmation") {
      throw new ApiError(409, "ORDER_ALREADY_PROCESSED", "只有待确认订单可以确认");
    }
    if (!order.departureDate || !order.returnDate) {
      throw new ApiError(
        409,
        "TRAVEL_DATES_REQUIRED",
        "确认订单前必须填写出行日期和返程日期",
      );
    }
    assertTravelDates(order.departureDate, order.returnDate);

    const [employee] = await tx
      .select()
      .from(employees)
      .where(eq(employees.id, order.employeeId));
    if (!employee || employee.status !== "active") {
      throw new ApiError(409, "EMPLOYEE_DISABLED", "停用员工的订单不能确认");
    }

    const [account] = await tx
      .select()
      .from(quotaAccounts)
      .where(eq(quotaAccounts.employeeId, employee.id))
      .for("update");
    if (!account) {
      throw new ApiError(409, "QUOTA_ACCOUNT_MISSING", "员工缺少额度账户");
    }
    if (account.availableBalance < order.plannedQuotaDeduction) {
      throw new ApiError(409, "INSUFFICIENT_QUOTA", "员工可用额度不足，不能确认订单");
    }

    const now = new Date();
    const amount = order.plannedQuotaDeduction;
    const balanceAfter = account.availableBalance - amount;
    await tx
      .update(quotaAccounts)
      .set({
        totalDeducted: account.totalDeducted + amount,
        availableBalance: balanceAfter,
        updatedAt: now,
      })
      .where(eq(quotaAccounts.id, account.id));
    await tx
      .update(personalOrders)
      .set({
        deductedQuota: amount,
        finalConsumedQuota: amount,
        status: getAutomaticOrderStatus(
          order.departureDate,
          order.returnDate,
          now,
        ),
        confirmedAt: now,
        updatedAt: now,
      })
      .where(eq(personalOrders.id, order.id));
    await tx.insert(quotaTransactions).values({
      id: randomUUID(),
      employeeId: employee.id,
      type: "deduction",
      amount: -amount,
      balanceAfter,
      relatedOrderId: order.id,
      reason: "个人订单确认扣减",
      operator: `后台运营-${actor.displayName}`,
      occurredAt: now,
    });
  });
}
