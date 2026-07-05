import {
  ConvertIntentToOrderRequestSchema,
  CreateEmployeeRequestSchema,
  CreateGroupRequestSchema,
  CreateServiceProductRequestSchema,
  GrantQuotaRequestSchema,
  SubmitPersonalIntentRequestSchema,
  UpdateIntentFollowUpRequestSchema,
} from "@travel/contracts";
import {
  Type,
  type FastifyPluginAsyncTypebox,
} from "@fastify/type-provider-typebox";

import { requireAdmin, requireEmployee } from "../auth/guards.js";
import type { Database } from "../db/client.js";
import {
  confirmPersonalOrder,
  convertIntentToOrder,
  createEmployee,
  createGroup,
  createServiceProduct,
  grantQuota,
  publishServiceProduct,
  submitPersonalIntent,
  updateIntentFollowUp,
  withdrawPersonalIntent,
} from "./core-service.js";
import {
  listEmployees,
  listGroups,
  listPersonalIntents,
  listPersonalOrders,
  listQuotaTransactions,
  listServiceProducts,
} from "./read-model.js";

const ProductParamsSchema = Type.Object({
  productId: Type.String({ minLength: 1 }),
});
const IntentParamsSchema = Type.Object({
  intentId: Type.String({ minLength: 1 }),
});
const OrderParamsSchema = Type.Object({
  orderId: Type.String({ minLength: 1 }),
});

function findCreated<T extends { id: string }>(
  rows: T[],
  id: string,
  name: string,
): T {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) {
    throw new Error(`${name}写入后读取失败`);
  }
  return row;
}

export function createAdminWriteRoutes(
  db: Database,
): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.post(
      "/groups",
      { schema: { body: CreateGroupRequestSchema } },
      async (request, reply) => {
        await requireAdmin(db, request, "groups");
        const id = await createGroup(db, request.body);
        const group = findCreated(await listGroups(db), id, "集团");
        return reply.code(201).send({ group });
      },
    );

    app.post(
      "/employees",
      { schema: { body: CreateEmployeeRequestSchema } },
      async (request, reply) => {
        await requireAdmin(db, request, "employees");
        const id = await createEmployee(db, request.body);
        const employee = findCreated(
          await listEmployees(db, id),
          id,
          "员工",
        );
        return reply.code(201).send({ employee });
      },
    );

    app.post(
      "/quota-grants",
      { schema: { body: GrantQuotaRequestSchema } },
      async (request, reply) => {
        const actor = await requireAdmin(db, request, "quotas");
        const ids = await grantQuota(db, actor, request.body);
        const transactions = (await listQuotaTransactions(db)).filter(
          ({ id }) => ids.includes(id),
        );
        return reply.code(201).send({ quotaTransactions: transactions });
      },
    );

    app.post(
      "/products",
      { schema: { body: CreateServiceProductRequestSchema } },
      async (request, reply) => {
        await requireAdmin(db, request, "products");
        const id = await createServiceProduct(db, request.body);
        const product = findCreated(
          await listServiceProducts(db),
          id,
          "商品",
        );
        return reply.code(201).send({ product });
      },
    );

    app.post(
      "/products/:productId/publish",
      { schema: { params: ProductParamsSchema } },
      async (request) => {
        await requireAdmin(db, request, "products");
        await publishServiceProduct(db, request.params.productId);
        const product = findCreated(
          await listServiceProducts(db),
          request.params.productId,
          "商品",
        );
        return { product };
      },
    );

    app.patch(
      "/intents/:intentId/follow-up",
      {
        schema: {
          params: IntentParamsSchema,
          body: UpdateIntentFollowUpRequestSchema,
        },
      },
      async (request) => {
        await requireAdmin(db, request, "intents");
        await updateIntentFollowUp(
          db,
          request.params.intentId,
          request.body,
        );
        const intent = findCreated(
          await listPersonalIntents(db),
          request.params.intentId,
          "意向",
        );
        return { intent };
      },
    );

    app.post(
      "/intents/:intentId/orders",
      {
        schema: {
          params: IntentParamsSchema,
          body: ConvertIntentToOrderRequestSchema,
        },
      },
      async (request, reply) => {
        await requireAdmin(db, request, "intents");
        const id = await convertIntentToOrder(
          db,
          request.params.intentId,
          request.body,
        );
        const order = findCreated(
          await listPersonalOrders(db),
          id,
          "订单",
        );
        return reply.code(201).send({ order });
      },
    );

    app.post(
      "/orders/:orderId/confirm",
      { schema: { params: OrderParamsSchema } },
      async (request) => {
        const actor = await requireAdmin(db, request, "orders");
        await confirmPersonalOrder(db, actor, request.params.orderId);
        const order = findCreated(
          await listPersonalOrders(db),
          request.params.orderId,
          "订单",
        );
        return { order };
      },
    );
  };
}

export function createEmployeeWriteRoutes(
  db: Database,
): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.post(
      "/intents",
      { schema: { body: SubmitPersonalIntentRequestSchema } },
      async (request, reply) => {
        const actor = await requireEmployee(db, request);
        const id = await submitPersonalIntent(db, actor, request.body);
        const intent = findCreated(
          await listPersonalIntents(db, actor.id),
          id,
          "意向",
        );
        return reply.code(201).send({ intent });
      },
    );

    app.post(
      "/intents/:intentId/withdraw",
      { schema: { params: IntentParamsSchema } },
      async (request) => {
        const actor = await requireEmployee(db, request);
        await withdrawPersonalIntent(
          db,
          actor,
          request.params.intentId,
        );
        const intent = findCreated(
          await listPersonalIntents(db, actor.id),
          request.params.intentId,
          "意向",
        );
        return { intent };
      },
    );
  };
}
