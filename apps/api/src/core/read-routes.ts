import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { requireAdmin, requireEmployee } from "../auth/guards.js";
import type { Database } from "../db/client.js";
import {
  listEmployees,
  listGroups,
  listOperatorAccounts,
  listPersonalIntents,
  listPersonalOrders,
  listQuotaAccounts,
  listQuotaTransactions,
  listServiceProducts,
} from "./read-model.js";

export function createAdminReadRoutes(
  db: Database,
): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.get("/operators", async (request) => {
      await requireAdmin(db, request);
      return { operatorAccounts: await listOperatorAccounts(db) };
    });

    app.get("/groups", async (request) => {
      await requireAdmin(db, request, "groups");
      return { groups: await listGroups(db) };
    });

    app.get("/employees", async (request) => {
      await requireAdmin(db, request, "employees");
      return { employees: await listEmployees(db) };
    });

    app.get("/quota-accounts", async (request) => {
      await requireAdmin(db, request, "quotas");
      return { quotaAccounts: await listQuotaAccounts(db) };
    });

    app.get("/quota-transactions", async (request) => {
      await requireAdmin(db, request, "quotas");
      return {
        quotaTransactions: await listQuotaTransactions(db),
      };
    });

    app.get("/products", async (request) => {
      await requireAdmin(db, request, "products");
      return { serviceProducts: await listServiceProducts(db) };
    });

    app.get("/intents", async (request) => {
      await requireAdmin(db, request, "intents");
      return { personalIntents: await listPersonalIntents(db) };
    });

    app.get("/orders", async (request) => {
      await requireAdmin(db, request, "orders");
      return { personalOrders: await listPersonalOrders(db) };
    });
  };
}

export function createEmployeeReadRoutes(
  db: Database,
): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.get("/products", async (request) => {
      const employee = await requireEmployee(db, request);
      const products = await listServiceProducts(db);
      return {
        serviceProducts: products.filter(
          (product) =>
            product.status === "published" &&
            (product.visibility.scope === "all_groups" ||
              product.visibility.groupIds.includes(employee.groupId)),
        ),
      };
    });

    app.get("/intents", async (request) => {
      const employee = await requireEmployee(db, request);
      return {
        personalIntents: await listPersonalIntents(db, employee.id),
      };
    });

    app.get("/orders", async (request) => {
      const employee = await requireEmployee(db, request);
      return {
        personalOrders: await listPersonalOrders(db, employee.id),
      };
    });

    app.get("/quota", async (request) => {
      const employee = await requireEmployee(db, request);
      const [accounts, transactions] = await Promise.all([
        listQuotaAccounts(db, employee.id),
        listQuotaTransactions(db, employee.id),
      ]);
      return {
        quotaAccount: accounts[0] ?? null,
        quotaTransactions: transactions.map(
          ({ internalNote: _internalNote, operator: _operator, ...item }) =>
            item,
        ),
      };
    });
  };
}
