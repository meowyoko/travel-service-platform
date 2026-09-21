import {
  ADMIN_PAGE_PERMISSIONS,
  EMPLOYEE_STATUSES,
  GROUP_STATUSES,
  INTENT_STATUSES,
  OPERATOR_ACCOUNT_STATUSES,
  OPERATOR_ROLES,
  ORDER_STATUSES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  QUOTA_TRANSACTION_TYPES,
  REVIEW_STATUSES,
  type HotelProductDetails,
  type OrderHotelAccommodationSnapshot,
  type OrderProductSnapshot,
  type ProductVisibility,
  type TravelProductDetails,
} from "@travel/domain";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const groupStatusEnum = pgEnum("group_status", GROUP_STATUSES);
export const employeeStatusEnum = pgEnum(
  "employee_status",
  EMPLOYEE_STATUSES,
);
export const operatorAccountStatusEnum = pgEnum(
  "operator_account_status",
  OPERATOR_ACCOUNT_STATUSES,
);
export const operatorRoleEnum = pgEnum("operator_role", OPERATOR_ROLES);
export const adminPagePermissionEnum = pgEnum(
  "admin_page_permission",
  ADMIN_PAGE_PERMISSIONS,
);
export const productTypeEnum = pgEnum("product_type", PRODUCT_TYPES);
export const productStatusEnum = pgEnum("product_status", PRODUCT_STATUSES);
export const intentStatusEnum = pgEnum("intent_status", INTENT_STATUSES);
export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);
export const reviewStatusEnum = pgEnum("review_status", REVIEW_STATUSES);
export const quotaTransactionTypeEnum = pgEnum(
  "quota_transaction_type",
  QUOTA_TRANSACTION_TYPES,
);
export const productVisibilityScopeEnum = pgEnum(
  "product_visibility_scope",
  ["all_groups", "specified_groups"],
);

const createdAt = timestamp("created_at", {
  withTimezone: true,
  mode: "date",
})
  .notNull()
  .defaultNow();

const updatedAt = timestamp("updated_at", {
  withTimezone: true,
  mode: "date",
})
  .notNull()
  .defaultNow();

export const operatorAccounts = pgTable(
  "operator_accounts",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: operatorRoleEnum("role").notNull(),
    status: operatorAccountStatusEnum("status").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("operator_accounts_username_unique").on(
      sql`lower(${table.username})`,
    ),
  ],
);

export const operatorPagePermissions = pgTable(
  "operator_page_permissions",
  {
    operatorAccountId: text("operator_account_id")
      .notNull()
      .references(() => operatorAccounts.id, { onDelete: "cascade" }),
    permission: adminPagePermissionEnum("permission").notNull(),
  },
  (table) => [
    primaryKey({
      name: "operator_page_permissions_pk",
      columns: [table.operatorAccountId, table.permission],
    }),
  ],
);

export const groups = pgTable(
  "groups",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    cooperationStartDate: date("cooperation_start_date", {
      mode: "string",
    }).notNull(),
    cooperationEndDate: date("cooperation_end_date", { mode: "string" }),
    status: groupStatusEnum("status").notNull(),
    note: text("note"),
    createdAt,
  },
  (table) => [
    uniqueIndex("groups_name_unique").on(sql`lower(${table.name})`),
    index("groups_status_created_index").on(table.status, table.createdAt),
  ],
);

export const employees = pgTable(
  "employees",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    passwordHash: text("password_hash").notNull(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    department: text("department"),
    employeeNumber: text("employee_number"),
    position: text("position"),
    status: employeeStatusEnum("status").notNull(),
    note: text("note"),
    createdAt,
  },
  (table) => [
    uniqueIndex("employees_phone_unique").on(table.phone),
    index("employees_group_id_index").on(table.groupId),
    index("employees_group_status_created_index").on(
      table.groupId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const quotaAccounts = pgTable(
  "quota_accounts",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    totalGranted: integer("total_granted").notNull().default(0),
    totalDeducted: integer("total_deducted").notNull().default(0),
    totalRefunded: integer("total_refunded").notNull().default(0),
    totalAdjusted: integer("total_adjusted").notNull().default(0),
    availableBalance: integer("available_balance").notNull().default(0),
    updatedAt,
  },
  (table) => [
    uniqueIndex("quota_accounts_employee_unique").on(table.employeeId),
    check("quota_accounts_available_nonnegative", sql`${table.availableBalance} >= 0`),
  ],
);

export const serviceProducts = pgTable(
  "service_products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: productTypeEnum("type").notNull(),
    summary: text("summary").notNull(),
    coverImage: text("cover_image").notNull(),
    gallery: jsonb("gallery").$type<
      Array<{ imageUrl: string; description: string }>
    >(),
    quotaReference: jsonb("quota_reference").$type<{
      min: number;
      max?: number;
    }>(),
    serviceDescription: text("service_description").notNull(),
    notes: text("notes").notNull(),
    visibilityScope: productVisibilityScopeEnum(
      "visibility_scope",
    ).notNull(),
    status: productStatusEnum("status").notNull(),
    sortOrder: integer("sort_order"),
    recommended: boolean("recommended"),
    travelDetails: jsonb("travel_details").$type<TravelProductDetails>(),
    hotelDetails: jsonb("hotel_details").$type<HotelProductDetails>(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("service_products_name_unique").on(
      sql`lower(${table.name})`,
    ),
    index("service_products_status_created_index").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const productVisibleGroups = pgTable(
  "product_visible_groups",
  {
    productId: text("product_id")
      .notNull()
      .references(() => serviceProducts.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      name: "product_visible_groups_pk",
      columns: [table.productId, table.groupId],
    }),
  ],
);

export const productLinkedHotels = pgTable(
  "product_linked_hotels",
  {
    productId: text("product_id")
      .notNull()
      .references(() => serviceProducts.id, { onDelete: "cascade" }),
    hotelProductId: text("hotel_product_id")
      .notNull()
      .references(() => serviceProducts.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      name: "product_linked_hotels_pk",
      columns: [table.productId, table.hotelProductId],
    }),
  ],
);

export const hotelRoomTypes = pgTable(
  "hotel_room_types",
  {
    id: text("id").primaryKey(),
    hotelProductId: text("hotel_product_id")
      .notNull()
      .references(() => serviceProducts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    bedType: text("bed_type"),
    capacity: integer("capacity").notNull(),
    breakfast: text("breakfast"),
    area: text("area"),
    description: text("description"),
    status: productStatusEnum("status").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("hotel_room_types_hotel_index").on(table.hotelProductId),
  ],
);

export const hotelRoomDailyInventories = pgTable(
  "hotel_room_daily_inventories",
  {
    id: text("id").primaryKey(),
    roomTypeId: text("room_type_id")
      .notNull()
      .references(() => hotelRoomTypes.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    quotaPrice: integer("quota_price").notNull(),
    totalInventory: integer("total_inventory").notNull(),
    usedInventory: integer("used_inventory").notNull().default(0),
    isAvailable: boolean("is_available").notNull().default(true),
    updatedAt,
  },
  (table) => [
    uniqueIndex("hotel_room_daily_inventory_unique").on(
      table.roomTypeId,
      table.date,
    ),
    check("hotel_room_inventory_nonnegative", sql`${table.totalInventory} >= 0`),
    check("hotel_room_used_nonnegative", sql`${table.usedInventory} >= 0`),
    check(
      "hotel_room_used_not_above_total",
      sql`${table.usedInventory} <= ${table.totalInventory}`,
    ),
  ],
);

export const personalIntents = pgTable(
  "personal_intents",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => serviceProducts.id),
    expectedTravelDate: date("expected_travel_date", {
      mode: "string",
    }).notNull(),
    expectedStayDays: integer("expected_stay_days").notNull(),
    companionCount: integer("companion_count"),
    preferredTransport: text("preferred_transport"),
    needsPickup: boolean("needs_pickup"),
    accommodationPreference: text("accommodation_preference"),
    preferredHotelProductId: text("preferred_hotel_product_id").references(
      () => serviceProducts.id,
      { onDelete: "set null" },
    ),
    preferredHotelRoomTypeId: text("preferred_hotel_room_type_id").references(
      () => hotelRoomTypes.id,
      { onDelete: "set null" },
    ),
    additionalNotes: text("additional_notes"),
    convenientContactTime: text("convenient_contact_time"),
    status: intentStatusEnum("status").notNull(),
    assigneeAccountId: text("assignee_account_id").references(
      () => operatorAccounts.id,
      { onDelete: "set null" },
    ),
    internalNote: text("internal_note"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("personal_intents_employee_index").on(table.employeeId),
    index("personal_intents_product_index").on(table.productId),
    index("personal_intents_status_created_index").on(
      table.status,
      table.createdAt,
    ),
    index("personal_intents_created_index").on(table.createdAt),
  ],
);

export const personalOrders = pgTable(
  "personal_orders",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    sourceIntentId: text("source_intent_id").references(
      () => personalIntents.id,
      { onDelete: "set null" },
    ),
    sourceProductId: text("source_product_id")
      .notNull()
      .references(() => serviceProducts.id),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    productSnapshot: jsonb("product_snapshot")
      .$type<OrderProductSnapshot>()
      .notNull(),
    departureDate: date("departure_date", { mode: "string" }),
    returnDate: date("return_date", { mode: "string" }),
    transport: text("transport"),
    accommodation: text("accommodation"),
    hotelAccommodation:
      jsonb("hotel_accommodation").$type<OrderHotelAccommodationSnapshot>(),
    pickupService: text("pickup_service"),
    servicePlan: text("service_plan").notNull(),
    plannedQuotaDeduction: integer("planned_quota_deduction")
      .notNull()
      .default(0),
    deductedQuota: integer("deducted_quota").notNull().default(0),
    refundedQuota: integer("refunded_quota").notNull().default(0),
    finalConsumedQuota: integer("final_consumed_quota").notNull().default(0),
    status: orderStatusEnum("status").notNull(),
    assigneeAccountId: text("assignee_account_id").references(
      () => operatorAccounts.id,
      { onDelete: "set null" },
    ),
    internalNote: text("internal_note"),
    confirmedAt: timestamp("confirmed_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("personal_orders_order_number_unique").on(table.orderNumber),
    index("personal_orders_employee_index").on(table.employeeId),
    index("personal_orders_group_index").on(table.groupId),
    index("personal_orders_status_created_index").on(
      table.status,
      table.createdAt,
    ),
    index("personal_orders_confirmed_index").on(table.confirmedAt),
    uniqueIndex("personal_orders_source_intent_unique")
      .on(table.sourceIntentId)
      .where(sql`${table.sourceIntentId} is not null`),
    check(
      "personal_orders_refund_not_above_deduction",
      sql`${table.refundedQuota} <= ${table.deductedQuota}`,
    ),
    check(
      "personal_orders_final_consumed_formula",
      sql`${table.finalConsumedQuota} = ${table.deductedQuota} - ${table.refundedQuota}`,
    ),
  ],
);

export const quotaTransactions = pgTable(
  "quota_transactions",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    type: quotaTransactionTypeEnum("type").notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    relatedOrderId: text("related_order_id").references(
      () => personalOrders.id,
      { onDelete: "cascade" },
    ),
    reason: text("reason").notNull(),
    internalNote: text("internal_note"),
    operator: text("operator").notNull(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("quota_transactions_employee_index").on(table.employeeId),
    index("quota_transactions_order_index").on(table.relatedOrderId),
    index("quota_transactions_occurred_index").on(table.occurredAt),
  ],
);

export const serviceReviews = pgTable(
  "service_reviews",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => personalOrders.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => serviceProducts.id),
    rating: integer("rating").notNull(),
    content: text("content").notNull(),
    status: reviewStatusEnum("status").notNull(),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt,
    moderatedByAccountId: text("moderated_by_account_id").references(
      () => operatorAccounts.id,
      { onDelete: "set null" },
    ),
    moderatedAt: timestamp("moderated_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("service_reviews_status_submitted_index").on(
      table.status,
      table.submittedAt,
    ),
    uniqueIndex("service_reviews_order_unique").on(table.orderId),
    check(
      "service_reviews_rating_range",
      sql`${table.rating} between 1 and 5`,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    operatorAccountId: text("operator_account_id").references(
      () => operatorAccounts.id,
      { onDelete: "cascade" },
    ),
    employeeId: text("employee_id").references(() => employees.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_operator_account_index").on(table.operatorAccountId),
    index("sessions_employee_index").on(table.employeeId),
    index("sessions_expires_at_index").on(table.expiresAt),
    check(
      "sessions_exactly_one_subject",
      sql`num_nonnulls(${table.operatorAccountId}, ${table.employeeId}) = 1`,
    ),
  ],
);

export type StoredProductVisibility = ProductVisibility;
