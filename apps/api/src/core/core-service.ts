import { randomUUID } from "node:crypto";

import type {
  ConvertIntentToOrderRequest,
  CreateEmployeeRequest,
  CreateGroupRequest,
  CreateServiceProductRequest,
  GrantQuotaRequest,
  SubmitOrderReviewRequest,
  SubmitPersonalIntentRequest,
  UpdateIntentFollowUpRequest,
} from "@travel/contracts";
import type { PublicEmployee, PublicOperatorAccount } from "@travel/contracts";
import type {
  HotelProductDetails,
  OrderHotelAccommodationSnapshot,
  OrderProductSnapshot,
} from "@travel/domain";
import { and, count, eq, inArray } from "drizzle-orm";

import { hashPassword } from "../auth/password.js";
import type { Database } from "../db/client.js";
import {
  employees,
  groups,
  hotelRoomDailyInventories,
  hotelRoomTypes,
  operatorAccounts,
  personalIntents,
  personalOrders,
  productLinkedHotels,
  productVisibleGroups,
  quotaAccounts,
  quotaTransactions,
  serviceReviews,
  serviceProducts,
} from "../db/schema.js";
import { ApiError } from "../errors.js";
import { normalizeProductGalleryInput } from "./product-gallery.js";

function normalizeHotelDetails(
  details: HotelProductDetails | undefined,
): HotelProductDetails | undefined {
  if (!details) return undefined;
  const { paidServices: _paidServices, ...baseDetails } = details;
  const paidServices = (details.paidServices ?? [])
    .map((service) => ({
      title: service.title.trim(),
      description: service.description.trim(),
    }))
    .filter(
      ({ title, description }) => title.length > 0 || description.length > 0,
    );
  if (
    paidServices.some(
      ({ title, description }) => !title || !description,
    )
  ) {
    throw new ApiError(
      400,
      "INVALID_HOTEL_PAID_SERVICES",
      "付费服务标题和详情说明需同时填写",
    );
  }
  const normalized: HotelProductDetails = {
    ...baseDetails,
    city: details.city.trim(),
    address: details.address.trim(),
  };
  const starRating = details.starRating?.trim();
  const facilities = details.facilities?.trim();
  const trafficInfo = details.trafficInfo?.trim();
  const checkInPolicy = details.checkInPolicy?.trim();
  if (starRating !== undefined) normalized.starRating = starRating;
  if (facilities !== undefined) normalized.facilities = facilities;
  if (trafficInfo !== undefined) normalized.trafficInfo = trafficInfo;
  if (checkInPolicy !== undefined) normalized.checkInPolicy = checkInPolicy;
  if (paidServices.length > 0) normalized.paidServices = paidServices;
  return normalized;
}

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

function enumerateNights(checkInDate: string, checkOutDate: string): string[] {
  if (checkOutDate <= checkInDate) {
    throw new ApiError(400, "INVALID_STAY_DATES", "离店日期必须晚于入住日期");
  }
  const nights: string[] = [];
  const cursor = new Date(`${checkInDate}T00:00:00.000Z`);
  const end = new Date(`${checkOutDate}T00:00:00.000Z`);
  while (cursor < end) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

async function buildHotelAccommodationSnapshot(
  tx: any,
  input:
    | {
        hotelProductId: string;
        roomTypeId?: string;
        checkInDate: string;
        checkOutDate: string;
        note?: string;
      }
    | undefined,
): Promise<OrderHotelAccommodationSnapshot | null> {
  if (!input) return null;
  const nights = enumerateNights(input.checkInDate, input.checkOutDate);
  const [hotel] = await tx
    .select()
    .from(serviceProducts)
    .where(eq(serviceProducts.id, input.hotelProductId));
  if (!hotel || hotel.type !== "hotel") {
    throw new ApiError(404, "HOTEL_NOT_FOUND", "选择的酒店商品不存在");
  }
  if (hotel.status !== "published") {
    throw new ApiError(409, "HOTEL_NOT_PUBLISHED", "未上架酒店不能用于订单");
  }

  let roomTypeName: string | undefined;
  let quotaPricePerNight: number | undefined;
  let totalQuota: number | undefined;
  if (input.roomTypeId) {
    const [roomType] = await tx
      .select()
      .from(hotelRoomTypes)
      .where(eq(hotelRoomTypes.id, input.roomTypeId));
    if (!roomType || roomType.hotelProductId !== hotel.id) {
      throw new ApiError(404, "ROOM_TYPE_NOT_FOUND", "选择的房型不存在");
    }
    if (roomType.status !== "published") {
      throw new ApiError(409, "ROOM_TYPE_NOT_AVAILABLE", "未启用房型不能用于订单");
    }
    const inventories = await tx
      .select()
      .from(hotelRoomDailyInventories)
      .where(
        and(
          eq(hotelRoomDailyInventories.roomTypeId, roomType.id),
          inArray(hotelRoomDailyInventories.date, nights),
        ),
      );
    if (inventories.length !== nights.length) {
      throw new ApiError(409, "ROOM_INVENTORY_MISSING", "所选日期缺少房态库存");
    }
    if (
      inventories.some(
        (item: { isAvailable: boolean; usedInventory: number; totalInventory: number }) =>
          !item.isAvailable || item.usedInventory >= item.totalInventory,
      )
    ) {
      throw new ApiError(409, "ROOM_INVENTORY_UNAVAILABLE", "所选日期房态库存不足");
    }
    roomTypeName = roomType.name;
    totalQuota = inventories.reduce(
      (sum: number, item: { quotaPrice: number }) => sum + item.quotaPrice,
      0,
    );
    quotaPricePerNight =
      inventories.length === 1
        ? inventories[0]!.quotaPrice
        : Math.round((totalQuota ?? 0) / inventories.length);
  }

  return {
    hotelProductId: hotel.id,
    hotelName: hotel.name,
    ...(input.roomTypeId ? { roomTypeId: input.roomTypeId } : {}),
    ...(roomTypeName ? { roomTypeName } : {}),
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    nights: nights.length,
    ...(quotaPricePerNight !== undefined ? { quotaPricePerNight } : {}),
    ...(totalQuota !== undefined ? { totalQuota } : {}),
    ...(hotel.hotelDetails?.address ? { address: hotel.hotelDetails.address } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
}

async function assertHotelSelectableForProduct(
  tx: any,
  product: { id: string; type: string },
  hotelProductId: string,
): Promise<void> {
  if (product.type === "hotel") {
    if (hotelProductId !== product.id) {
      throw new ApiError(
        409,
        "HOTEL_NOT_MATCH_PRODUCT",
        "酒店商品订单只能选择当前酒店",
      );
    }
    return;
  }
  if (product.type !== "travel") {
    throw new ApiError(
      409,
      "HOTEL_NOT_SUPPORTED",
      "当前商品类型不支持选择酒店住宿",
    );
  }
  const [linkedHotel] = await tx
    .select()
    .from(productLinkedHotels)
    .where(
      and(
        eq(productLinkedHotels.productId, product.id),
        eq(productLinkedHotels.hotelProductId, hotelProductId),
      ),
    );
  if (!linkedHotel) {
    throw new ApiError(
      409,
      "HOTEL_NOT_LINKED",
      "所选酒店不在当前疗养产品可选范围内",
    );
  }
}

async function occupyHotelInventory(
  tx: any,
  accommodation: OrderHotelAccommodationSnapshot | null,
): Promise<void> {
  if (!accommodation?.roomTypeId) return;
  const nights = enumerateNights(
    accommodation.checkInDate,
    accommodation.checkOutDate,
  );
  const inventories = await tx
    .select()
    .from(hotelRoomDailyInventories)
    .where(
      and(
        eq(hotelRoomDailyInventories.roomTypeId, accommodation.roomTypeId),
        inArray(hotelRoomDailyInventories.date, nights),
      ),
    )
    .for("update");
  if (inventories.length !== nights.length) {
    throw new ApiError(409, "ROOM_INVENTORY_MISSING", "所选日期缺少房态库存");
  }
  for (const inventory of inventories) {
    if (
      !inventory.isAvailable ||
      inventory.usedInventory >= inventory.totalInventory
    ) {
      throw new ApiError(409, "ROOM_INVENTORY_UNAVAILABLE", "所选日期房态库存不足");
    }
    await tx
      .update(hotelRoomDailyInventories)
      .set({
        usedInventory: inventory.usedInventory + 1,
        updatedAt: new Date(),
      })
      .where(eq(hotelRoomDailyInventories.id, inventory.id));
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
  const hotelDetails = normalizeHotelDetails(input.hotelDetails);
  const gallery = normalizeProductGalleryInput(input.gallery);
  if (input.type === "travel" && !input.travelDetails) {
    throw new ApiError(
      400,
      "TRAVEL_DETAILS_REQUIRED",
      "疗养旅游类商品必须填写旅游扩展信息",
    );
  }
  if (input.type === "hotel" && !hotelDetails) {
    throw new ApiError(
      400,
      "HOTEL_DETAILS_REQUIRED",
      "酒店类商品必须填写酒店扩展信息",
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
  if (
    hotelDetails &&
    (!hotelDetails.city || !hotelDetails.address)
  ) {
    throw new ApiError(
      400,
      "INVALID_HOTEL_DETAILS",
      "酒店商品的城市和地址不能为空",
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
  const linkedHotelProductIds = input.linkedHotelProductIds ?? [];
  if (linkedHotelProductIds.length > 0) {
    const linkedHotels = await db
      .select({ id: serviceProducts.id, type: serviceProducts.type })
      .from(serviceProducts)
      .where(inArray(serviceProducts.id, linkedHotelProductIds));
    if (
      linkedHotels.length !== linkedHotelProductIds.length ||
      linkedHotels.some(({ type }) => type !== "hotel")
    ) {
      throw new ApiError(
        400,
        "INVALID_LINKED_HOTELS",
        "疗养产品只能绑定已存在的酒店商品",
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
      gallery: gallery ?? null,
      quotaReference: input.quotaReference ?? null,
      serviceDescription: input.serviceDescription.trim(),
      notes: input.notes.trim(),
      visibilityScope: input.visibility.scope,
      status: "draft",
      sortOrder: input.sortOrder ?? null,
      recommended: input.recommended ?? null,
      travelDetails: input.travelDetails ?? null,
      hotelDetails: hotelDetails ?? null,
      createdAt: now,
      updatedAt: now,
    });
    if (groupIds.length > 0) {
      await tx.insert(productVisibleGroups).values(
        groupIds.map((groupId) => ({ productId, groupId })),
      );
    }
    if (linkedHotelProductIds.length > 0) {
      await tx.insert(productLinkedHotels).values(
        linkedHotelProductIds.map((hotelProductId) => ({
          productId,
          hotelProductId,
        })),
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
    if (input.preferredHotelProductId) {
      const [hotel] = await tx
        .select({ id: serviceProducts.id, type: serviceProducts.type })
        .from(serviceProducts)
        .where(eq(serviceProducts.id, input.preferredHotelProductId));
      if (!hotel || hotel.type !== "hotel") {
        throw new ApiError(404, "HOTEL_NOT_FOUND", "选择的酒店不存在");
      }
      if (product.type === "travel") {
        const [linkedHotel] = await tx
          .select()
          .from(productLinkedHotels)
          .where(
            and(
              eq(productLinkedHotels.productId, product.id),
              eq(
                productLinkedHotels.hotelProductId,
                input.preferredHotelProductId,
              ),
            ),
          );
        if (!linkedHotel) {
          throw new ApiError(
            409,
            "HOTEL_NOT_LINKED",
            "所选酒店不在当前疗养产品可选范围内",
          );
        }
      } else if (product.type === "hotel" && hotel.id !== product.id) {
        throw new ApiError(
          409,
          "HOTEL_NOT_MATCH_PRODUCT",
          "酒店商品意向只能选择当前酒店",
        );
      }
      if (input.preferredHotelRoomTypeId) {
        const [roomType] = await tx
          .select()
          .from(hotelRoomTypes)
          .where(eq(hotelRoomTypes.id, input.preferredHotelRoomTypeId));
        if (!roomType || roomType.hotelProductId !== hotel.id) {
          throw new ApiError(404, "ROOM_TYPE_NOT_FOUND", "选择的房型不存在");
        }
      }
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
      preferredHotelProductId: input.preferredHotelProductId ?? null,
      preferredHotelRoomTypeId: input.preferredHotelRoomTypeId ?? null,
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

export async function submitOrderReview(
  db: Database,
  actor: PublicEmployee,
  orderId: string,
  input: SubmitOrderReviewRequest,
): Promise<string> {
  const content = input.content.trim();
  if (!content) {
    throw new ApiError(400, "INVALID_REVIEW", "评价内容不能为空");
  }
  const reviewId = randomUUID();
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(personalOrders)
      .where(eq(personalOrders.id, orderId))
      .for("update");
    if (!order) {
      throw new ApiError(404, "ORDER_NOT_FOUND", "个人订单不存在");
    }
    if (order.employeeId !== actor.id) {
      throw new ApiError(403, "FORBIDDEN", "只能评价本人的订单");
    }
    if (order.status !== "completed") {
      throw new ApiError(409, "ORDER_NOT_COMPLETED", "只有已完成订单可以评价");
    }
    const [existingReview] = await tx
      .select({ id: serviceReviews.id })
      .from(serviceReviews)
      .where(eq(serviceReviews.orderId, order.id));
    if (existingReview) {
      throw new ApiError(409, "REVIEW_EXISTS", "该订单已经提交过评价");
    }
    const now = new Date();
    await tx.insert(serviceReviews).values({
      id: reviewId,
      orderId: order.id,
      employeeId: actor.id,
      productId: order.sourceProductId,
      rating: input.rating,
      content,
      status: "pending_review",
      submittedAt: now,
      updatedAt: now,
    });
  });
  return reviewId;
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
      ...(product.hotelDetails
        ? { hotelDetails: product.hotelDetails }
        : {}),
    };
    if (input.hotelAccommodation) {
      await assertHotelSelectableForProduct(
        tx,
        product,
        input.hotelAccommodation.hotelProductId,
      );
    }
    const hotelAccommodation = await buildHotelAccommodationSnapshot(
      tx,
      input.hotelAccommodation,
    );
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
      hotelAccommodation,
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
    await occupyHotelInventory(tx, order.hotelAccommodation ?? null);
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
