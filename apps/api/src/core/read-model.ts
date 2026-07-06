import type {
  AdminEmployeeDto,
  GroupDto,
  PersonalIntentDto,
  PersonalOrderDto,
  PublicOperatorAccount,
  QuotaAccountDto,
  QuotaTransactionDto,
  ServiceReviewDto,
  ServiceProductDto,
} from "@travel/contracts";
import { eq } from "drizzle-orm";

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
  serviceReviews,
  serviceProducts,
} from "../db/schema.js";

export async function listOperatorAccounts(
  db: Database,
): Promise<PublicOperatorAccount[]> {
  const [accounts, permissions] = await Promise.all([
    db.select().from(operatorAccounts),
    db.select().from(operatorPagePermissions),
  ]);
  const permissionsByAccount = new Map<string, typeof permissions>();
  for (const permission of permissions) {
    const rows = permissionsByAccount.get(permission.operatorAccountId) ?? [];
    rows.push(permission);
    permissionsByAccount.set(permission.operatorAccountId, rows);
  }

  return accounts
    .filter(({ status }) => status === "active")
    .map((account) => ({
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      pagePermissions: (
        permissionsByAccount.get(account.id) ?? []
      ).map(({ permission }) => permission),
    }));
}

export async function listAdminOperatorAccounts(
  db: Database,
): Promise<
  Array<
    PublicOperatorAccount & {
      status: "active" | "disabled";
      createdAt: string;
      updatedAt: string;
    }
  >
> {
  const [accounts, permissions] = await Promise.all([
    db.select().from(operatorAccounts),
    db.select().from(operatorPagePermissions),
  ]);
  const permissionsByAccount = new Map<string, typeof permissions>();
  for (const permission of permissions) {
    const rows = permissionsByAccount.get(permission.operatorAccountId) ?? [];
    rows.push(permission);
    permissionsByAccount.set(permission.operatorAccountId, rows);
  }
  return accounts.map((account) => ({
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    status: account.status,
    pagePermissions: (
      permissionsByAccount.get(account.id) ?? []
    ).map(({ permission }) => permission),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }));
}

export async function listGroups(db: Database): Promise<GroupDto[]> {
  const rows = await db.select().from(groups);
  return rows.map((group) => ({
    id: group.id,
    name: group.name,
    contactName: group.contactName,
    contactPhone: group.contactPhone,
    cooperationStartDate: group.cooperationStartDate,
    status: group.status,
    createdAt: group.createdAt.toISOString(),
    ...(group.cooperationEndDate
      ? { cooperationEndDate: group.cooperationEndDate }
      : {}),
    ...(group.note ? { note: group.note } : {}),
  }));
}

export async function listEmployees(
  db: Database,
  employeeId?: string,
): Promise<AdminEmployeeDto[]> {
  const query = db.select().from(employees);
  const rows = employeeId
    ? await query.where(eq(employees.id, employeeId))
    : await query;

  return rows.map((employee) => ({
    id: employee.id,
    name: employee.name,
    phone: employee.phone,
    groupId: employee.groupId,
    status: employee.status,
    createdAt: employee.createdAt.toISOString(),
    ...(employee.department ? { department: employee.department } : {}),
    ...(employee.employeeNumber
      ? { employeeNumber: employee.employeeNumber }
      : {}),
    ...(employee.position ? { position: employee.position } : {}),
    ...(employee.note ? { note: employee.note } : {}),
  }));
}

export async function listQuotaAccounts(
  db: Database,
  employeeId?: string,
): Promise<QuotaAccountDto[]> {
  const query = db.select().from(quotaAccounts);
  const rows = employeeId
    ? await query.where(eq(quotaAccounts.employeeId, employeeId))
    : await query;

  return rows.map((account) => ({
    ...account,
    updatedAt: account.updatedAt.toISOString(),
  }));
}

export async function listServiceProducts(
  db: Database,
): Promise<ServiceProductDto[]> {
  const [products, visibilityRows] = await Promise.all([
    db.select().from(serviceProducts),
    db.select().from(productVisibleGroups),
  ]);
  const groupIdsByProduct = new Map<string, string[]>();
  for (const row of visibilityRows) {
    const groupIds = groupIdsByProduct.get(row.productId) ?? [];
    groupIds.push(row.groupId);
    groupIdsByProduct.set(row.productId, groupIds);
  }

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    type: product.type,
    summary: product.summary,
    coverImage: product.coverImage,
    serviceDescription: product.serviceDescription,
    notes: product.notes,
    visibility:
      product.visibilityScope === "all_groups"
        ? { scope: "all_groups" }
        : {
            scope: "specified_groups",
            groupIds: groupIdsByProduct.get(product.id) ?? [],
          },
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    ...(product.gallery ? { gallery: product.gallery } : {}),
    ...(product.quotaReference
      ? { quotaReference: product.quotaReference }
      : {}),
    ...(product.sortOrder !== null ? { sortOrder: product.sortOrder } : {}),
    ...(product.recommended !== null
      ? { recommended: product.recommended }
      : {}),
    ...(product.travelDetails
      ? { travelDetails: product.travelDetails }
      : {}),
  }));
}

export async function listPersonalIntents(
  db: Database,
  employeeId?: string,
): Promise<PersonalIntentDto[]> {
  const query = db.select().from(personalIntents);
  const rows = employeeId
    ? await query.where(eq(personalIntents.employeeId, employeeId))
    : await query;

  return rows.map((intent) => ({
    id: intent.id,
    employeeId: intent.employeeId,
    productId: intent.productId,
    expectedTravelDate: intent.expectedTravelDate,
    expectedStayDays: intent.expectedStayDays,
    status: intent.status,
    createdAt: intent.createdAt.toISOString(),
    updatedAt: intent.updatedAt.toISOString(),
    ...(intent.companionCount !== null
      ? { companionCount: intent.companionCount }
      : {}),
    ...(intent.preferredTransport
      ? { preferredTransport: intent.preferredTransport }
      : {}),
    ...(intent.needsPickup !== null
      ? { needsPickup: intent.needsPickup }
      : {}),
    ...(intent.accommodationPreference
      ? { accommodationPreference: intent.accommodationPreference }
      : {}),
    ...(intent.additionalNotes
      ? { additionalNotes: intent.additionalNotes }
      : {}),
    ...(intent.convenientContactTime
      ? { convenientContactTime: intent.convenientContactTime }
      : {}),
    ...(intent.assigneeAccountId
      ? { assigneeAccountId: intent.assigneeAccountId }
      : {}),
    ...(intent.internalNote ? { internalNote: intent.internalNote } : {}),
  }));
}

export async function listPersonalOrders(
  db: Database,
  employeeId?: string,
): Promise<PersonalOrderDto[]> {
  const query = db.select().from(personalOrders);
  const rows = employeeId
    ? await query.where(eq(personalOrders.employeeId, employeeId))
    : await query;

  return rows.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    sourceProductId: order.sourceProductId,
    employeeId: order.employeeId,
    groupId: order.groupId,
    productSnapshot: order.productSnapshot,
    servicePlan: order.servicePlan,
    plannedQuotaDeduction: order.plannedQuotaDeduction,
    deductedQuota: order.deductedQuota,
    refundedQuota: order.refundedQuota,
    finalConsumedQuota: order.finalConsumedQuota,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    ...(order.sourceIntentId ? { sourceIntentId: order.sourceIntentId } : {}),
    ...(order.departureDate ? { departureDate: order.departureDate } : {}),
    ...(order.returnDate ? { returnDate: order.returnDate } : {}),
    ...(order.transport ? { transport: order.transport } : {}),
    ...(order.accommodation ? { accommodation: order.accommodation } : {}),
    ...(order.pickupService ? { pickupService: order.pickupService } : {}),
    ...(order.assigneeAccountId
      ? { assigneeAccountId: order.assigneeAccountId }
      : {}),
    ...(order.internalNote ? { internalNote: order.internalNote } : {}),
    ...(order.confirmedAt
      ? { confirmedAt: order.confirmedAt.toISOString() }
      : {}),
  }));
}

export async function listQuotaTransactions(
  db: Database,
  employeeId?: string,
): Promise<QuotaTransactionDto[]> {
  const query = db.select().from(quotaTransactions);
  const rows = employeeId
    ? await query.where(eq(quotaTransactions.employeeId, employeeId))
    : await query;

  return rows.map((transaction) => ({
    id: transaction.id,
    employeeId: transaction.employeeId,
    type: transaction.type,
    amount: transaction.amount,
    balanceAfter: transaction.balanceAfter,
    reason: transaction.reason,
    operator: transaction.operator,
    occurredAt: transaction.occurredAt.toISOString(),
    ...(transaction.relatedOrderId
      ? { relatedOrderId: transaction.relatedOrderId }
      : {}),
    ...(transaction.internalNote
      ? { internalNote: transaction.internalNote }
      : {}),
  }));
}

export async function listServiceReviews(
  db: Database,
  employeeId?: string,
): Promise<ServiceReviewDto[]> {
  const query = db.select().from(serviceReviews);
  const rows = employeeId
    ? await query.where(eq(serviceReviews.employeeId, employeeId))
    : await query;
  return rows.map((review) => ({
    id: review.id,
    orderId: review.orderId,
    employeeId: review.employeeId,
    productId: review.productId,
    rating: review.rating,
    content: review.content,
    status: review.status,
    submittedAt: review.submittedAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    ...(review.moderatedByAccountId
      ? { moderatedByAccountId: review.moderatedByAccountId }
      : {}),
    ...(review.moderatedAt
      ? { moderatedAt: review.moderatedAt.toISOString() }
      : {}),
  }));
}
