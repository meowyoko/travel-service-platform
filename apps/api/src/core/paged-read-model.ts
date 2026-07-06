import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import type { OrderStatus } from "@travel/domain";

import type { Database } from "../db/client.js";
import {
  employees,
  groups,
  personalIntents,
  personalOrders,
  productVisibleGroups,
  quotaTransactions,
  serviceProducts,
  serviceReviews,
} from "../db/schema.js";
import { paginated } from "./pagination.js";
import {
  listEmployees,
  listGroups,
  listPersonalIntents,
  listPersonalOrders,
  listQuotaTransactions,
  listServiceProducts,
  listServiceReviews,
} from "./read-model.js";

interface PageOptions {
  page: number;
  pageSize: number;
  offset: number;
  query?: string;
  status?: string;
  groupId?: string;
  department?: string;
  type?: string;
  employeeId?: string;
  visibleGroupId?: string;
  publishedOnly?: boolean;
}

function sortByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const order = new Map(ids.map((id, index) => [id, index]));
  return items.sort(
    (left, right) =>
      (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

export async function pageGroups(db: Database, options: PageOptions) {
  const condition = and(
    options.query ? ilike(groups.name, `%${options.query}%`) : undefined,
    options.status
      ? eq(groups.status, options.status as "active" | "paused" | "ended")
      : undefined,
  );
  const rows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(condition)
    .orderBy(desc(groups.createdAt), desc(groups.id))
    .limit(options.pageSize)
    .offset(options.offset);
  const ids = rows.map(({ id }) => id);
  const items = sortByIds(await listGroups(db, ids), ids);
  const totalRows = await db
    .select({ value: count() })
    .from(groups)
    .where(condition);
  const total = Number(totalRows[0]?.value ?? 0);
  return paginated(items, options.page, options.pageSize, total);
}

export async function pageEmployees(db: Database, options: PageOptions) {
  const condition = and(
    options.query
      ? or(
          ilike(employees.name, `%${options.query}%`),
          ilike(employees.phone, `%${options.query}%`),
          ilike(employees.employeeNumber, `%${options.query}%`),
        )
      : undefined,
    options.groupId ? eq(employees.groupId, options.groupId) : undefined,
    options.department
      ? eq(employees.department, options.department)
      : undefined,
    options.status
      ? eq(employees.status, options.status as "active" | "disabled")
      : undefined,
  );
  const rows = await db
    .select({ id: employees.id })
    .from(employees)
    .where(condition)
    .orderBy(desc(employees.createdAt), desc(employees.id))
    .limit(options.pageSize)
    .offset(options.offset);
  const ids = rows.map(({ id }) => id);
  const items = sortByIds(await listEmployees(db, undefined, ids), ids);
  const totalRows = await db
    .select({ value: count() })
    .from(employees)
    .where(condition);
  const total = Number(totalRows[0]?.value ?? 0);
  return paginated(items, options.page, options.pageSize, total);
}

export async function pageProducts(db: Database, options: PageOptions) {
  const condition = and(
    options.query
      ? ilike(serviceProducts.name, `%${options.query}%`)
      : undefined,
    options.status
      ? eq(
          serviceProducts.status,
          options.status as "draft" | "published",
        )
      : undefined,
    options.type
      ? eq(
          serviceProducts.type,
          options.type as
            | "travel"
            | "insurance"
            | "medical"
            | "health_management"
            | "other",
        )
      : undefined,
    options.publishedOnly
      ? eq(serviceProducts.status, "published")
      : undefined,
    options.visibleGroupId
      ? or(
          eq(serviceProducts.visibilityScope, "all_groups"),
          sql`exists (
            select 1 from ${productVisibleGroups}
            where ${productVisibleGroups.productId} = ${serviceProducts.id}
              and ${productVisibleGroups.groupId} = ${options.visibleGroupId}
          )`,
        )
      : undefined,
  );
  const rows = await db
    .select({ id: serviceProducts.id })
    .from(serviceProducts)
    .where(condition)
    .orderBy(
      desc(serviceProducts.sortOrder),
      desc(serviceProducts.createdAt),
      desc(serviceProducts.id),
    )
    .limit(options.pageSize)
    .offset(options.offset);
  const ids = rows.map(({ id }) => id);
  const items = sortByIds(await listServiceProducts(db, ids), ids);
  const totalRows = await db
    .select({ value: count() })
    .from(serviceProducts)
    .where(condition);
  const total = Number(totalRows[0]?.value ?? 0);
  return paginated(items, options.page, options.pageSize, total);
}

export async function pageIntents(db: Database, options: PageOptions) {
  const condition = and(
    options.employeeId
      ? eq(personalIntents.employeeId, options.employeeId)
      : undefined,
    options.status
      ? eq(
          personalIntents.status,
          options.status as
            | "pending_follow_up"
            | "communicating"
            | "converted_to_order"
            | "withdrawn_by_employee"
            | "closed",
        )
      : undefined,
    options.query
      ? or(
          ilike(employees.name, `%${options.query}%`),
          ilike(serviceProducts.name, `%${options.query}%`),
        )
      : undefined,
  );
  const base = db
    .select({ id: personalIntents.id })
    .from(personalIntents)
    .innerJoin(employees, eq(personalIntents.employeeId, employees.id))
    .innerJoin(
      serviceProducts,
      eq(personalIntents.productId, serviceProducts.id),
    )
    .where(condition);
  const rows = await base
    .orderBy(desc(personalIntents.createdAt), desc(personalIntents.id))
    .limit(options.pageSize)
    .offset(options.offset);
  const totalRows = await db
    .select({ value: count() })
    .from(personalIntents)
    .innerJoin(employees, eq(personalIntents.employeeId, employees.id))
    .innerJoin(
      serviceProducts,
      eq(personalIntents.productId, serviceProducts.id),
    )
    .where(condition);
  const ids = rows.map(({ id }) => id);
  const items = sortByIds(
    await listPersonalIntents(db, options.employeeId, ids),
    ids,
  );
  return paginated(
    items,
    options.page,
    options.pageSize,
    Number(totalRows[0]?.value ?? 0),
  );
}

export async function pageOrders(db: Database, options: PageOptions) {
  const condition = and(
    options.employeeId
      ? eq(personalOrders.employeeId, options.employeeId)
      : undefined,
    options.groupId ? eq(personalOrders.groupId, options.groupId) : undefined,
    options.status === "upcoming"
      ? inArray(personalOrders.status, [
          "pending_confirmation",
          "confirmed",
          "waiting_for_service",
        ])
      : options.status
      ? eq(personalOrders.status, options.status as OrderStatus)
      : undefined,
    options.query
      ? or(
          ilike(personalOrders.orderNumber, `%${options.query}%`),
          ilike(employees.name, `%${options.query}%`),
          sql`${personalOrders.productSnapshot}->>'name' ilike ${`%${options.query}%`}`,
        )
      : undefined,
  );
  const rows = await db
    .select({ id: personalOrders.id })
    .from(personalOrders)
    .innerJoin(employees, eq(personalOrders.employeeId, employees.id))
    .where(condition)
    .orderBy(desc(personalOrders.createdAt), desc(personalOrders.id))
    .limit(options.pageSize)
    .offset(options.offset);
  const totalRows = await db
    .select({ value: count() })
    .from(personalOrders)
    .innerJoin(employees, eq(personalOrders.employeeId, employees.id))
    .where(condition);
  const ids = rows.map(({ id }) => id);
  const items = sortByIds(
    await listPersonalOrders(db, options.employeeId, ids),
    ids,
  );
  return paginated(
    items,
    options.page,
    options.pageSize,
    Number(totalRows[0]?.value ?? 0),
  );
}

export async function pageReviews(db: Database, options: PageOptions) {
  const condition = and(
    options.employeeId
      ? eq(serviceReviews.employeeId, options.employeeId)
      : undefined,
    options.status
      ? eq(
          serviceReviews.status,
          options.status as "pending_review" | "published" | "hidden",
        )
      : undefined,
    options.query
      ? or(
          ilike(employees.name, `%${options.query}%`),
          ilike(serviceReviews.content, `%${options.query}%`),
        )
      : undefined,
  );
  const rows = await db
    .select({ id: serviceReviews.id })
    .from(serviceReviews)
    .innerJoin(employees, eq(serviceReviews.employeeId, employees.id))
    .where(condition)
    .orderBy(desc(serviceReviews.submittedAt), desc(serviceReviews.id))
    .limit(options.pageSize)
    .offset(options.offset);
  const totalRows = await db
    .select({ value: count() })
    .from(serviceReviews)
    .innerJoin(employees, eq(serviceReviews.employeeId, employees.id))
    .where(condition);
  const ids = rows.map(({ id }) => id);
  const items = sortByIds(
    await listServiceReviews(db, options.employeeId, ids),
    ids,
  );
  return paginated(
    items,
    options.page,
    options.pageSize,
    Number(totalRows[0]?.value ?? 0),
  );
}

export async function pageTransactions(db: Database, options: PageOptions) {
  const condition = and(
    options.employeeId
      ? eq(quotaTransactions.employeeId, options.employeeId)
      : undefined,
    options.groupId ? eq(employees.groupId, options.groupId) : undefined,
    options.type
      ? eq(
          quotaTransactions.type,
          options.type as "grant" | "deduction" | "refund" | "adjustment",
        )
      : undefined,
    options.query
      ? or(
          ilike(employees.name, `%${options.query}%`),
          ilike(quotaTransactions.reason, `%${options.query}%`),
        )
      : undefined,
  );
  const rows = await db
    .select({ id: quotaTransactions.id })
    .from(quotaTransactions)
    .innerJoin(employees, eq(quotaTransactions.employeeId, employees.id))
    .where(condition)
    .orderBy(
      desc(quotaTransactions.occurredAt),
      desc(quotaTransactions.id),
    )
    .limit(options.pageSize)
    .offset(options.offset);
  const totalRows = await db
    .select({ value: count() })
    .from(quotaTransactions)
    .innerJoin(employees, eq(quotaTransactions.employeeId, employees.id))
    .where(condition);
  const ids = rows.map(({ id }) => id);
  const items = sortByIds(
    await listQuotaTransactions(db, options.employeeId, ids),
    ids,
  );
  return paginated(
    items,
    options.page,
    options.pageSize,
    Number(totalRows[0]?.value ?? 0),
  );
}
