import {
  Type,
  type FastifyPluginAsyncTypebox,
} from "@fastify/type-provider-typebox";
import type { FastifyReply } from "fastify";

import { requireAdmin } from "../auth/guards.js";
import type { Database } from "../db/client.js";
import {
  exportIntents,
  exportOrders,
  exportTransactions,
} from "./export-service.js";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DateSchema = Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
const BaseQuery = {
  groupId: Type.Optional(Type.String({ minLength: 1 })),
  dateFrom: Type.Optional(DateSchema),
  dateTo: Type.Optional(DateSchema),
};
const IntentExportQuerySchema = Type.Object({
  ...BaseQuery,
  query: Type.Optional(Type.String({ maxLength: 200 })),
  status: Type.Optional(
    Type.Union([
      Type.Literal("pending_follow_up"),
      Type.Literal("communicating"),
      Type.Literal("converted_to_order"),
      Type.Literal("withdrawn_by_employee"),
      Type.Literal("closed"),
    ]),
  ),
});
const OrderExportQuerySchema = Type.Object({
  ...BaseQuery,
  status: Type.Optional(
    Type.Union([
      Type.Literal("pending_confirmation"),
      Type.Literal("confirmed"),
      Type.Literal("waiting_for_service"),
      Type.Literal("in_service"),
      Type.Literal("completed"),
      Type.Literal("cancelled"),
    ]),
  ),
  type: Type.Optional(
    Type.Union([
      Type.Literal("travel"),
      Type.Literal("insurance"),
      Type.Literal("medical"),
      Type.Literal("health_management"),
      Type.Literal("other"),
    ]),
  ),
});
const TransactionExportQuerySchema = Type.Object({
  ...BaseQuery,
  type: Type.Optional(
    Type.Union([
      Type.Literal("grant"),
      Type.Literal("deduction"),
      Type.Literal("refund"),
      Type.Literal("adjustment"),
    ]),
  ),
});

function sendWorkbook(
  reply: FastifyReply,
  buffer: Buffer,
  filename: string,
) {
  return reply
    .type(XLSX_CONTENT_TYPE)
    .header(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    )
    .send(buffer);
}

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
  }).format(new Date());
}

export function createExportRoutes(
  db: Database,
): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.get(
      "/intents",
      { schema: { querystring: IntentExportQuerySchema } },
      async (request, reply) => {
        await requireAdmin(db, request, "intents");
        const buffer = await exportIntents(db, request.query);
        return sendWorkbook(reply, buffer, `个人意向_${today()}.xlsx`);
      },
    );

    app.get(
      "/orders",
      { schema: { querystring: OrderExportQuerySchema } },
      async (request, reply) => {
        await requireAdmin(db, request, "orders");
        const buffer = await exportOrders(db, request.query);
        return sendWorkbook(reply, buffer, `订单对账明细_${today()}.xlsx`);
      },
    );

    app.get(
      "/quota-transactions",
      { schema: { querystring: TransactionExportQuerySchema } },
      async (request, reply) => {
        await requireAdmin(db, request, "quotas");
        const buffer = await exportTransactions(db, request.query);
        return sendWorkbook(reply, buffer, `额度流水_${today()}.xlsx`);
      },
    );
  };
}
