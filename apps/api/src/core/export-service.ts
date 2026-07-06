import {
  and,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import * as XLSX from "xlsx";

import type { Database } from "../db/client.js";
import {
  employees,
  groups,
  operatorAccounts,
  personalIntents,
  personalOrders,
  quotaTransactions,
  serviceProducts,
} from "../db/schema.js";
import { ApiError } from "../errors.js";

const MAX_EXPORT_ROWS = 50_000;

export interface ExportQuery {
  groupId?: string;
  status?: string;
  type?: string;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
}

const intentStatusLabels = {
  pending_follow_up: "待跟进",
  communicating: "沟通中",
  converted_to_order: "已转订单",
  withdrawn_by_employee: "用户已撤销",
  closed: "已关闭",
} as const;

const orderStatusLabels = {
  pending_confirmation: "待确认",
  confirmed: "已确认",
  waiting_for_service: "待出行",
  in_service: "服务中",
  completed: "已完成",
  cancelled: "已取消",
} as const;

const productTypeLabels = {
  travel: "疗养旅游",
  insurance: "保险服务",
  medical: "医疗服务",
  health_management: "健康管理",
  other: "其他",
} as const;

const transactionTypeLabels = {
  grant: "发放",
  deduction: "扣减",
  refund: "退回",
  adjustment: "调整",
} as const;

function startOfShanghaiDay(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000+08:00`) : undefined;
}

function endOfShanghaiDay(value?: string): Date | undefined {
  return value ? new Date(`${value}T23:59:59.999+08:00`) : undefined;
}

function ensureExportSize(rows: unknown[]): void {
  if (rows.length > MAX_EXPORT_ROWS) {
    throw new ApiError(
      409,
      "EXPORT_TOO_LARGE",
      "导出数据超过 50000 条，请缩小集团或时间范围",
    );
  }
}

function validateDateRange(query: ExportQuery): void {
  if (query.dateFrom && query.dateTo && query.dateTo < query.dateFrom) {
    throw new ApiError(400, "INVALID_DATE_RANGE", "结束日期不能早于开始日期");
  }
}

function buildWorkbook(
  sheetName: string,
  rows: Record<string, string | number>[],
  widths: number[],
  headers: string[],
): Buffer {
  const worksheet = rows.length
    ? XLSX.utils.json_to_sheet(rows, { header: headers })
    : XLSX.utils.aoa_to_sheet([headers]);
  worksheet["!cols"] = widths.map((wch) => ({ wch }));
  if (worksheet["!ref"]) {
    worksheet["!autofilter"] = { ref: worksheet["!ref"] };
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

export async function exportIntents(
  db: Database,
  query: ExportQuery,
): Promise<Buffer> {
  validateDateRange(query);
  const conditions: Array<SQL | undefined> = [
    query.groupId ? eq(employees.groupId, query.groupId) : undefined,
    query.status
      ? eq(
          personalIntents.status,
          query.status as keyof typeof intentStatusLabels,
        )
      : undefined,
    query.query
      ? or(
          ilike(employees.name, `%${query.query}%`),
          ilike(employees.phone, `%${query.query}%`),
          ilike(serviceProducts.name, `%${query.query}%`),
        )
      : undefined,
    query.dateFrom
      ? gte(personalIntents.createdAt, startOfShanghaiDay(query.dateFrom)!)
      : undefined,
    query.dateTo
      ? lte(personalIntents.createdAt, endOfShanghaiDay(query.dateTo)!)
      : undefined,
  ];
  const rows = await db
    .select({
      groupName: groups.name,
      employeeName: employees.name,
      phone: employees.phone,
      department: employees.department,
      employeeNumber: employees.employeeNumber,
      productName: serviceProducts.name,
      expectedTravelDate: personalIntents.expectedTravelDate,
      expectedStayDays: personalIntents.expectedStayDays,
      preferredTransport: personalIntents.preferredTransport,
      accommodationPreference: personalIntents.accommodationPreference,
      needsPickup: personalIntents.needsPickup,
      additionalNotes: personalIntents.additionalNotes,
      status: personalIntents.status,
      assigneeName: operatorAccounts.displayName,
      createdAt: personalIntents.createdAt,
    })
    .from(personalIntents)
    .innerJoin(employees, eq(personalIntents.employeeId, employees.id))
    .innerJoin(groups, eq(employees.groupId, groups.id))
    .innerJoin(
      serviceProducts,
      eq(personalIntents.productId, serviceProducts.id),
    )
    .leftJoin(
      operatorAccounts,
      eq(personalIntents.assigneeAccountId, operatorAccounts.id),
    )
    .where(and(...conditions))
    .orderBy(desc(personalIntents.createdAt))
    .limit(MAX_EXPORT_ROWS + 1);
  ensureExportSize(rows);
  return buildWorkbook(
    "个人意向",
    rows.map((row) => ({
      集团名称: row.groupName,
      员工姓名: row.employeeName,
      手机号: row.phone,
      部门: row.department ?? "",
      员工编号: row.employeeNumber ?? "",
      意向商品: row.productName,
      预计出行日期: row.expectedTravelDate,
      停留天数: row.expectedStayDays,
      交通偏好: row.preferredTransport ?? "",
      住宿偏好: row.accommodationPreference ?? "",
      接送需求:
        row.needsPickup === null ? "" : row.needsPickup ? "需要" : "不需要",
      员工备注: row.additionalNotes ?? "",
      意向状态: intentStatusLabels[row.status],
      跟进人: row.assigneeName ?? "未指派",
      提交时间: row.createdAt.toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
      }),
    })),
    [18, 12, 16, 16, 14, 24, 14, 10, 18, 24, 12, 28, 14, 14, 20],
    [
      "集团名称", "员工姓名", "手机号", "部门", "员工编号",
      "意向商品", "预计出行日期", "停留天数", "交通偏好", "住宿偏好",
      "接送需求", "员工备注", "意向状态", "跟进人", "提交时间",
    ],
  );
}

export async function exportOrders(
  db: Database,
  query: ExportQuery,
): Promise<Buffer> {
  validateDateRange(query);
  const rows = await db
    .select({
      groupName: groups.name,
      employeeName: employees.name,
      phone: employees.phone,
      orderNumber: personalOrders.orderNumber,
      productName: serviceProducts.name,
      productType: serviceProducts.type,
      status: personalOrders.status,
      assigneeName: operatorAccounts.displayName,
      confirmedAt: personalOrders.confirmedAt,
      departureDate: personalOrders.departureDate,
      returnDate: personalOrders.returnDate,
      deductedQuota: personalOrders.deductedQuota,
      refundedQuota: personalOrders.refundedQuota,
      finalConsumedQuota: personalOrders.finalConsumedQuota,
      internalNote: personalOrders.internalNote,
    })
    .from(personalOrders)
    .innerJoin(employees, eq(personalOrders.employeeId, employees.id))
    .innerJoin(groups, eq(personalOrders.groupId, groups.id))
    .innerJoin(
      serviceProducts,
      eq(personalOrders.sourceProductId, serviceProducts.id),
    )
    .leftJoin(
      operatorAccounts,
      eq(personalOrders.assigneeAccountId, operatorAccounts.id),
    )
    .where(
      and(
        query.groupId ? eq(personalOrders.groupId, query.groupId) : undefined,
        query.status
          ? eq(
              personalOrders.status,
              query.status as keyof typeof orderStatusLabels,
            )
          : undefined,
        query.type
          ? eq(
              serviceProducts.type,
              query.type as keyof typeof productTypeLabels,
            )
          : undefined,
        query.dateFrom
          ? gte(personalOrders.confirmedAt, startOfShanghaiDay(query.dateFrom)!)
          : undefined,
        query.dateTo
          ? lte(personalOrders.confirmedAt, endOfShanghaiDay(query.dateTo)!)
          : undefined,
      ),
    )
    .orderBy(desc(personalOrders.confirmedAt), desc(personalOrders.createdAt))
    .limit(MAX_EXPORT_ROWS + 1);
  ensureExportSize(rows);
  return buildWorkbook(
    "订单对账明细",
    rows.map((row) => ({
      集团名称: row.groupName,
      员工姓名: row.employeeName,
      手机号: row.phone,
      订单编号: row.orderNumber,
      商品名称: row.productName,
      商品类型: productTypeLabels[row.productType],
      订单状态: orderStatusLabels[row.status],
      负责人: row.assigneeName ?? "未指派",
      确认时间: row.confirmedAt
        ? row.confirmedAt.toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai",
          })
        : "",
      出发日期: row.departureDate ?? "",
      服务完成日期: row.returnDate ?? "",
      原扣减额度: row.deductedQuota,
      已退回额度: row.refundedQuota,
      最终消耗额度: row.finalConsumedQuota,
      内部备注: row.internalNote ?? "",
    })),
    [18, 12, 16, 20, 24, 14, 14, 14, 20, 14, 14, 14, 14, 14, 28],
    [
      "集团名称", "员工姓名", "手机号", "订单编号", "商品名称",
      "商品类型", "订单状态", "负责人", "确认时间", "出发日期",
      "服务完成日期", "原扣减额度", "已退回额度", "最终消耗额度",
      "内部备注",
    ],
  );
}

export async function exportTransactions(
  db: Database,
  query: ExportQuery,
): Promise<Buffer> {
  validateDateRange(query);
  const rows = await db
    .select({
      groupName: groups.name,
      employeeName: employees.name,
      phone: employees.phone,
      type: quotaTransactions.type,
      amount: quotaTransactions.amount,
      balanceAfter: quotaTransactions.balanceAfter,
      orderNumber: personalOrders.orderNumber,
      occurredAt: quotaTransactions.occurredAt,
      operator: quotaTransactions.operator,
      reason: quotaTransactions.reason,
      internalNote: quotaTransactions.internalNote,
    })
    .from(quotaTransactions)
    .innerJoin(employees, eq(quotaTransactions.employeeId, employees.id))
    .innerJoin(groups, eq(employees.groupId, groups.id))
    .leftJoin(
      personalOrders,
      eq(quotaTransactions.relatedOrderId, personalOrders.id),
    )
    .where(
      and(
        query.groupId ? eq(employees.groupId, query.groupId) : undefined,
        query.type
          ? eq(
              quotaTransactions.type,
              query.type as keyof typeof transactionTypeLabels,
            )
          : undefined,
        query.dateFrom
          ? gte(
              quotaTransactions.occurredAt,
              startOfShanghaiDay(query.dateFrom)!,
            )
          : undefined,
        query.dateTo
          ? lte(
              quotaTransactions.occurredAt,
              endOfShanghaiDay(query.dateTo)!,
            )
          : undefined,
      ),
    )
    .orderBy(desc(quotaTransactions.occurredAt))
    .limit(MAX_EXPORT_ROWS + 1);
  ensureExportSize(rows);
  return buildWorkbook(
    "额度流水",
    rows.map((row) => ({
      集团名称: row.groupName,
      员工姓名: row.employeeName,
      手机号: row.phone,
      流水类型: transactionTypeLabels[row.type],
      变动额度: row.amount,
      变动后余额: row.balanceAfter,
      关联订单: row.orderNumber ?? "",
      发生时间: row.occurredAt.toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
      }),
      操作人: row.operator,
      原因说明: row.reason,
      内部备注: row.internalNote ?? "",
    })),
    [18, 12, 16, 12, 14, 14, 20, 20, 16, 28, 28],
    [
      "集团名称", "员工姓名", "手机号", "流水类型", "变动额度",
      "变动后余额", "关联订单", "发生时间", "操作人", "原因说明",
      "内部备注",
    ],
  );
}
