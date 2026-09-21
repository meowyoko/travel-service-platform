import {
  AdjustQuotaRequestSchema,
  AssignOrderRequestSchema,
  CloseIntentRequestSchema,
  CreateEmployeesBatchRequestSchema,
  CreateHotelRoomTypeRequestSchema,
  CreateOperatorAccountRequestSchema,
  ModerateReviewRequestSchema,
  RefundOrderQuotaRequestSchema,
  UpdateEmployeeRequestSchema,
  UpdateGroupRequestSchema,
  UpdateHotelRoomTypeRequestSchema,
  UpdateOperatorAccountRequestSchema,
  UpdateOrderTravelDatesRequestSchema,
  UpdatePendingOrderRequestSchema,
  UpdateServiceProductRequestSchema,
  UpsertHotelRoomInventoryRequestSchema,
} from "@travel/contracts";
import {
  Type,
  type FastifyPluginAsyncTypebox,
} from "@fastify/type-provider-typebox";

import { requireAdmin } from "../auth/guards.js";
import type { Database } from "../db/client.js";
import {
  adjustQuota,
  assignOrder,
  cancelOrder,
  closeIntent,
  createEmployeesBatch,
  createHotelRoomType,
  createOperatorAccount,
  deleteEmployee,
  deleteGroup,
  deleteServiceProduct,
  moderateReview,
  refundOrderQuota,
  syncOrderStatuses,
  unpublishServiceProduct,
  updateEmployee,
  updateGroup,
  updateHotelRoomType,
  updateOperatorAccount,
  updateOrderTravelDates,
  updatePendingOrder,
  updateServiceProduct,
  upsertHotelRoomInventory,
} from "./extended-service.js";
import {
  listAdminOperatorAccounts,
  listEmployees,
  listGroups,
  listHotelRoomDailyInventories,
  listHotelRoomTypes,
  listPersonalIntents,
  listPersonalOrders,
  listQuotaTransactions,
  listServiceProducts,
  listServiceReviews,
} from "./read-model.js";

const GroupParams = Type.Object({ groupId: Type.String({ minLength: 1 }) });
const EmployeeParams = Type.Object({
  employeeId: Type.String({ minLength: 1 }),
});
const ProductParams = Type.Object({
  productId: Type.String({ minLength: 1 }),
});
const RoomTypeParams = Type.Object({
  roomTypeId: Type.String({ minLength: 1 }),
});
const IntentParams = Type.Object({ intentId: Type.String({ minLength: 1 }) });
const OrderParams = Type.Object({ orderId: Type.String({ minLength: 1 }) });
const ReviewParams = Type.Object({ reviewId: Type.String({ minLength: 1 }) });
const OperatorParams = Type.Object({
  accountId: Type.String({ minLength: 1 }),
});

export function createAdminExtendedRoutes(
  db: Database,
): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.patch(
      "/groups/:groupId",
      { schema: { params: GroupParams, body: UpdateGroupRequestSchema } },
      async (request) => {
        await requireAdmin(db, request, "groups");
        await updateGroup(db, request.params.groupId, request.body);
        return {
          group: (await listGroups(db)).find(
            ({ id }) => id === request.params.groupId,
          ),
        };
      },
    );

    app.delete(
      "/groups/:groupId",
      { schema: { params: GroupParams } },
      async (request) => {
        await requireAdmin(db, request, "groups");
        return {
          groupId: request.params.groupId,
          ...(await deleteGroup(db, request.params.groupId)),
        };
      },
    );

    app.post(
      "/employees/batch",
      { schema: { body: CreateEmployeesBatchRequestSchema } },
      async (request, reply) => {
        await requireAdmin(db, request, "employees");
        const ids = await createEmployeesBatch(db, request.body);
        const allEmployees = await listEmployees(db);
        return reply.code(201).send({
          employees: allEmployees.filter(({ id }) => ids.includes(id)),
        });
      },
    );

    app.patch(
      "/employees/:employeeId",
      {
        schema: {
          params: EmployeeParams,
          body: UpdateEmployeeRequestSchema,
        },
      },
      async (request) => {
        await requireAdmin(db, request, "employees");
        await updateEmployee(
          db,
          request.params.employeeId,
          request.body,
        );
        return {
          employee: (await listEmployees(db, request.params.employeeId))[0],
        };
      },
    );

    app.delete(
      "/employees/:employeeId",
      { schema: { params: EmployeeParams } },
      async (request, reply) => {
        await requireAdmin(db, request, "employees");
        await deleteEmployee(db, request.params.employeeId);
        return reply.code(204).send();
      },
    );

    app.post(
      "/employees/:employeeId/quota-adjustments",
      {
        schema: {
          params: EmployeeParams,
          body: AdjustQuotaRequestSchema,
        },
      },
      async (request, reply) => {
        const actor = await requireAdmin(db, request, "quotas");
        const id = await adjustQuota(
          db,
          actor,
          request.params.employeeId,
          request.body,
        );
        const transaction = (await listQuotaTransactions(db)).find(
          (item) => item.id === id,
        );
        return reply.code(201).send({ quotaTransaction: transaction });
      },
    );

    app.post(
      "/orders/:orderId/refunds",
      {
        schema: {
          params: OrderParams,
          body: RefundOrderQuotaRequestSchema,
        },
      },
      async (request, reply) => {
        const actor = await requireAdmin(db, request, "quotas");
        const id = await refundOrderQuota(
          db,
          actor,
          request.params.orderId,
          request.body,
        );
        const transaction = (await listQuotaTransactions(db)).find(
          (item) => item.id === id,
        );
        return reply.code(201).send({ quotaTransaction: transaction });
      },
    );

    app.patch(
      "/products/:productId",
      {
        schema: {
          params: ProductParams,
          body: UpdateServiceProductRequestSchema,
        },
      },
      async (request) => {
        await requireAdmin(db, request, "products");
        await updateServiceProduct(
          db,
          request.params.productId,
          request.body,
        );
        return {
          product: (await listServiceProducts(db)).find(
            ({ id }) => id === request.params.productId,
          ),
        };
      },
    );

    app.post(
      "/products/:productId/unpublish",
      { schema: { params: ProductParams } },
      async (request) => {
        await requireAdmin(db, request, "products");
        await unpublishServiceProduct(db, request.params.productId);
        return {
          product: (await listServiceProducts(db)).find(
            ({ id }) => id === request.params.productId,
          ),
        };
      },
    );

    app.delete(
      "/products/:productId",
      { schema: { params: ProductParams } },
      async (request, reply) => {
        await requireAdmin(db, request, "products");
        await deleteServiceProduct(db, request.params.productId);
        return reply.code(204).send();
      },
    );

    app.post(
      "/products/:productId/room-types",
      {
        schema: {
          params: ProductParams,
          body: CreateHotelRoomTypeRequestSchema,
        },
      },
      async (request, reply) => {
        await requireAdmin(db, request, "products");
        const id = await createHotelRoomType(
          db,
          request.params.productId,
          request.body,
        );
        const roomType = (await listHotelRoomTypes(db, undefined, [id]))[0];
        return reply.code(201).send({ roomType });
      },
    );

    app.patch(
      "/room-types/:roomTypeId",
      {
        schema: {
          params: RoomTypeParams,
          body: UpdateHotelRoomTypeRequestSchema,
        },
      },
      async (request) => {
        await requireAdmin(db, request, "products");
        await updateHotelRoomType(
          db,
          request.params.roomTypeId,
          request.body,
        );
        return {
          roomType: (await listHotelRoomTypes(db, undefined, [
            request.params.roomTypeId,
          ]))[0],
        };
      },
    );

    app.put(
      "/room-types/:roomTypeId/inventory",
      {
        schema: {
          params: RoomTypeParams,
          body: UpsertHotelRoomInventoryRequestSchema,
        },
      },
      async (request) => {
        await requireAdmin(db, request, "products");
        const id = await upsertHotelRoomInventory(
          db,
          request.params.roomTypeId,
          request.body,
        );
        return {
          inventory: (await listHotelRoomDailyInventories(db)).find(
            (item) => item.id === id,
          ),
        };
      },
    );

    app.post(
      "/intents/:intentId/close",
      {
        schema: {
          params: IntentParams,
          body: CloseIntentRequestSchema,
        },
      },
      async (request) => {
        await requireAdmin(db, request, "intents");
        await closeIntent(db, request.params.intentId, request.body);
        return {
          intent: (await listPersonalIntents(db)).find(
            ({ id }) => id === request.params.intentId,
          ),
        };
      },
    );

    app.patch(
      "/orders/:orderId",
      {
        schema: {
          params: OrderParams,
          body: UpdatePendingOrderRequestSchema,
        },
      },
      async (request) => {
        await requireAdmin(db, request, "orders");
        await updatePendingOrder(
          db,
          request.params.orderId,
          request.body,
        );
        return {
          order: (await listPersonalOrders(db)).find(
            ({ id }) => id === request.params.orderId,
          ),
        };
      },
    );

    app.patch(
      "/orders/:orderId/assignee",
      { schema: { params: OrderParams, body: AssignOrderRequestSchema } },
      async (request) => {
        await requireAdmin(db, request, "orders");
        await assignOrder(db, request.params.orderId, request.body);
        return {
          order: (await listPersonalOrders(db)).find(
            ({ id }) => id === request.params.orderId,
          ),
        };
      },
    );

    app.patch(
      "/orders/:orderId/travel-dates",
      {
        schema: {
          params: OrderParams,
          body: UpdateOrderTravelDatesRequestSchema,
        },
      },
      async (request) => {
        await requireAdmin(db, request, "orders");
        await updateOrderTravelDates(
          db,
          request.params.orderId,
          request.body,
        );
        return {
          order: (await listPersonalOrders(db)).find(
            ({ id }) => id === request.params.orderId,
          ),
        };
      },
    );

    app.post(
      "/orders/:orderId/cancel",
      { schema: { params: OrderParams } },
      async (request) => {
        await requireAdmin(db, request, "orders");
        await cancelOrder(db, request.params.orderId);
        return {
          order: (await listPersonalOrders(db)).find(
            ({ id }) => id === request.params.orderId,
          ),
        };
      },
    );

    app.post("/orders/sync-statuses", async (request) => {
      await requireAdmin(db, request, "orders");
      return { updatedCount: await syncOrderStatuses(db) };
    });

    app.patch(
      "/reviews/:reviewId",
      {
        schema: {
          params: ReviewParams,
          body: ModerateReviewRequestSchema,
        },
      },
      async (request) => {
        const actor = await requireAdmin(db, request, "reviews");
        await moderateReview(
          db,
          actor,
          request.params.reviewId,
          request.body,
        );
        return {
          review: (await listServiceReviews(db)).find(
            ({ id }) => id === request.params.reviewId,
          ),
        };
      },
    );

    app.post(
      "/operator-accounts",
      { schema: { body: CreateOperatorAccountRequestSchema } },
      async (request, reply) => {
        await requireAdmin(db, request, "operator_accounts");
        const id = await createOperatorAccount(db, request.body);
        return reply.code(201).send({
          account: (await listAdminOperatorAccounts(db)).find(
            (item) => item.id === id,
          ),
        });
      },
    );

    app.patch(
      "/operator-accounts/:accountId",
      {
        schema: {
          params: OperatorParams,
          body: UpdateOperatorAccountRequestSchema,
        },
      },
      async (request) => {
        const actor = await requireAdmin(
          db,
          request,
          "operator_accounts",
        );
        await updateOperatorAccount(
          db,
          actor,
          request.params.accountId,
          request.body,
        );
        return {
          account: (await listAdminOperatorAccounts(db)).find(
            (item) => item.id === request.params.accountId,
          ),
        };
      },
    );
  };
}
