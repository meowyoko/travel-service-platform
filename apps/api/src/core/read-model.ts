import { normalizeProductGallery } from "@travel/domain";
import type {
  AdminEmployeeDto,
  GroupDto,
  HotelRoomDailyInventoryDto,
  HotelRoomTypeDto,
  PersonalIntentDto,
  PersonalOrderDto,
  PublicOperatorAccount,
  QuotaAccountDto,
  QuotaTransactionDto,
  ServiceReviewDto,
  ServiceProductDto,
} from "@travel/contracts";
import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../db/client.js";
import {
  employees,
  groups,
  hotelRoomDailyInventories,
  hotelRoomTypes,
  operatorAccounts,
  operatorPagePermissions,
  personalIntents,
  personalOrders,
  productLinkedHotels,
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

export async function listGroups(
  db: Database,
  ids?: string[],
): Promise<GroupDto[]> {
  if (ids?.length === 0) return [];
  const rows = ids?.length
    ? await db.select().from(groups).where(inArray(groups.id, ids))
    : await db.select().from(groups);
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
  ids?: string[],
): Promise<AdminEmployeeDto[]> {
  if (ids?.length === 0) return [];
  const query = db.select().from(employees);
  const condition = and(
    employeeId ? eq(employees.id, employeeId) : undefined,
    ids?.length ? inArray(employees.id, ids) : undefined,
  );
  const rows = condition
    ? await query.where(condition)
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
  ids?: string[],
): Promise<QuotaAccountDto[]> {
  if (ids?.length === 0) return [];
  const query = db.select().from(quotaAccounts);
  const condition = and(
    employeeId ? eq(quotaAccounts.employeeId, employeeId) : undefined,
    ids?.length ? inArray(quotaAccounts.id, ids) : undefined,
  );
  const rows = condition
    ? await query.where(condition)
    : await query;

  return rows.map((account) => ({
    ...account,
    updatedAt: account.updatedAt.toISOString(),
  }));
}

export async function listServiceProducts(
  db: Database,
  ids?: string[],
): Promise<ServiceProductDto[]> {
  if (ids?.length === 0) return [];
  const [products, visibilityRows] = await Promise.all([
    ids?.length
      ? db
          .select()
          .from(serviceProducts)
          .where(inArray(serviceProducts.id, ids))
      : db.select().from(serviceProducts),
    ids?.length
      ? db
          .select()
          .from(productVisibleGroups)
          .where(inArray(productVisibleGroups.productId, ids))
      : db.select().from(productVisibleGroups),
  ]);
  const linkedHotelRows = ids?.length
    ? await db
        .select()
        .from(productLinkedHotels)
        .where(inArray(productLinkedHotels.productId, ids))
    : await db.select().from(productLinkedHotels);
  const groupIdsByProduct = new Map<string, string[]>();
  for (const row of visibilityRows) {
    const groupIds = groupIdsByProduct.get(row.productId) ?? [];
    groupIds.push(row.groupId);
    groupIdsByProduct.set(row.productId, groupIds);
  }
  const hotelIdsByProduct = new Map<string, string[]>();
  for (const row of linkedHotelRows) {
    const hotelIds = hotelIdsByProduct.get(row.productId) ?? [];
    hotelIds.push(row.hotelProductId);
    hotelIdsByProduct.set(row.productId, hotelIds);
  }

  return products.map((product) => {
    const gallery = normalizeProductGallery(product.gallery);
    return ({
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
    ...(gallery ? { gallery } : {}),
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
    ...(product.hotelDetails
      ? { hotelDetails: product.hotelDetails }
      : {}),
    ...(hotelIdsByProduct.has(product.id)
      ? { linkedHotelProductIds: hotelIdsByProduct.get(product.id) ?? [] }
      : {}),
    });
  });
}

export async function listHotelRoomTypes(
  db: Database,
  hotelProductId?: string,
  ids?: string[],
): Promise<HotelRoomTypeDto[]> {
  if (ids?.length === 0) return [];
  const condition = and(
    hotelProductId ? eq(hotelRoomTypes.hotelProductId, hotelProductId) : undefined,
    ids?.length ? inArray(hotelRoomTypes.id, ids) : undefined,
  );
  const query = db.select().from(hotelRoomTypes);
  const rows = condition ? await query.where(condition) : await query;
  return rows.map((roomType) => ({
    id: roomType.id,
    hotelProductId: roomType.hotelProductId,
    name: roomType.name,
    capacity: roomType.capacity,
    status: roomType.status,
    createdAt: roomType.createdAt.toISOString(),
    updatedAt: roomType.updatedAt.toISOString(),
    ...(roomType.imageUrl ? { imageUrl: roomType.imageUrl } : {}),
    ...(roomType.bedType ? { bedType: roomType.bedType } : {}),
    ...(roomType.breakfast ? { breakfast: roomType.breakfast } : {}),
    ...(roomType.area ? { area: roomType.area } : {}),
    ...(roomType.description ? { description: roomType.description } : {}),
  }));
}

export async function listHotelRoomDailyInventories(
  db: Database,
  roomTypeId?: string,
): Promise<HotelRoomDailyInventoryDto[]> {
  const rows = roomTypeId
    ? await db
        .select()
        .from(hotelRoomDailyInventories)
        .where(eq(hotelRoomDailyInventories.roomTypeId, roomTypeId))
    : await db.select().from(hotelRoomDailyInventories);
  return rows.map((inventory) => ({
    id: inventory.id,
    roomTypeId: inventory.roomTypeId,
    date: inventory.date,
    quotaPrice: inventory.quotaPrice,
    totalInventory: inventory.totalInventory,
    usedInventory: inventory.usedInventory,
    isAvailable: inventory.isAvailable,
    updatedAt: inventory.updatedAt.toISOString(),
  }));
}

export async function listPersonalIntents(
  db: Database,
  employeeId?: string,
  ids?: string[],
): Promise<PersonalIntentDto[]> {
  if (ids?.length === 0) return [];
  const query = db.select().from(personalIntents);
  const condition = and(
    employeeId ? eq(personalIntents.employeeId, employeeId) : undefined,
    ids?.length ? inArray(personalIntents.id, ids) : undefined,
  );
  const rows = condition
    ? await query.where(condition)
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
    ...(intent.preferredHotelProductId
      ? { preferredHotelProductId: intent.preferredHotelProductId }
      : {}),
    ...(intent.preferredHotelRoomTypeId
      ? { preferredHotelRoomTypeId: intent.preferredHotelRoomTypeId }
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
  ids?: string[],
): Promise<PersonalOrderDto[]> {
  if (ids?.length === 0) return [];
  const query = db.select().from(personalOrders);
  const condition = and(
    employeeId ? eq(personalOrders.employeeId, employeeId) : undefined,
    ids?.length ? inArray(personalOrders.id, ids) : undefined,
  );
  const rows = condition
    ? await query.where(condition)
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
    ...(order.hotelAccommodation
      ? { hotelAccommodation: order.hotelAccommodation }
      : {}),
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
  ids?: string[],
): Promise<QuotaTransactionDto[]> {
  if (ids?.length === 0) return [];
  const query = db.select().from(quotaTransactions);
  const condition = and(
    employeeId ? eq(quotaTransactions.employeeId, employeeId) : undefined,
    ids?.length ? inArray(quotaTransactions.id, ids) : undefined,
  );
  const rows = condition
    ? await query.where(condition)
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
  ids?: string[],
): Promise<ServiceReviewDto[]> {
  if (ids?.length === 0) return [];
  const query = db.select().from(serviceReviews);
  const condition = and(
    employeeId ? eq(serviceReviews.employeeId, employeeId) : undefined,
    ids?.length ? inArray(serviceReviews.id, ids) : undefined,
  );
  const rows = condition
    ? await query.where(condition)
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
