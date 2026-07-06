import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { requireAdmin, requireEmployee } from "../auth/guards.js";
import type { Database } from "../db/client.js";
import {
  listAdminOperatorAccounts,
  listEmployees,
  listGroups,
  listPersonalIntents,
  listPersonalOrders,
  listQuotaAccounts,
  listQuotaTransactions,
  listServiceProducts,
  listServiceReviews,
} from "./read-model.js";

export function createContextRoutes(
  db: Database,
): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.get("/admin/context", async (request) => {
      const actor = await requireAdmin(db, request);
      const can = (permission: (typeof actor.pagePermissions)[number]) =>
        actor.role === "leader" ||
        actor.pagePermissions.includes(permission);
      const [
        allOperators,
        allGroups,
        allEmployees,
        allQuotaAccounts,
        allProducts,
        allIntents,
        allOrders,
        allReviews,
        allTransactions,
      ] = await Promise.all([
        listAdminOperatorAccounts(db),
        listGroups(db),
        listEmployees(db),
        listQuotaAccounts(db),
        listServiceProducts(db),
        listPersonalIntents(db),
        listPersonalOrders(db),
        listServiceReviews(db),
        listQuotaTransactions(db),
      ]);

      const needsGroups =
        can("groups") ||
        can("employees") ||
        can("quotas") ||
        can("products") ||
        can("intents") ||
        can("orders") ||
        can("reviews");
      const needsEmployees =
        can("groups") ||
        can("employees") ||
        can("quotas") ||
        can("intents") ||
        can("orders") ||
        can("reviews");
      const needsProducts =
        can("products") ||
        can("intents") ||
        can("orders") ||
        can("reviews");
      const needsOrders =
        can("groups") ||
        can("employees") ||
        can("quotas") ||
        can("products") ||
        can("orders") ||
        can("reviews");

      return {
        data: {
          operatorAccounts: can("operator_accounts")
            ? allOperators
            : allOperators.filter(({ status }) => status === "active"),
          groups: needsGroups ? allGroups : [],
          employees: needsEmployees ? allEmployees : [],
          quotaAccounts:
            can("quotas") || can("orders") ? allQuotaAccounts : [],
          serviceProducts: needsProducts ? allProducts : [],
          personalIntents:
            can("intents") || can("products") ? allIntents : [],
          personalOrders: needsOrders ? allOrders : [],
          serviceReviews:
            can("reviews") || can("orders") ? allReviews : [],
          quotaTransactions:
            can("quotas") || can("orders") ? allTransactions : [],
        },
      };
    });

    app.get("/employee/context", async (request) => {
      const employee = await requireEmployee(db, request);
      const [
        groups,
        products,
        intents,
        orders,
        quotaAccounts,
        transactions,
        personalReviews,
        allReviews,
      ] = await Promise.all([
        listGroups(db),
        listServiceProducts(db),
        listPersonalIntents(db, employee.id),
        listPersonalOrders(db, employee.id),
        listQuotaAccounts(db, employee.id),
        listQuotaTransactions(db, employee.id),
        listServiceReviews(db, employee.id),
        listServiceReviews(db),
      ]);
      const group = groups.find(({ id }) => id === employee.groupId) ?? null;
      const visibleProducts = products.filter(
        (product) =>
          product.status === "published" &&
          (product.visibility.scope === "all_groups" ||
            product.visibility.groupIds.includes(employee.groupId)),
      );
      const visibleProductIds = new Set(
        visibleProducts.map(({ id }) => id),
      );

      return {
        employee,
        group: group
          ? { id: group.id, name: group.name, status: group.status }
          : null,
        quotaAccount: quotaAccounts[0] ?? null,
        visibleProducts,
        personalIntents: intents,
        personalOrders: orders,
        personalReviews,
        publishedReviews: allReviews.filter(
          ({ productId, status }) =>
            status === "published" && visibleProductIds.has(productId),
        ),
        personalQuotaTransactions: transactions.map(
          ({ internalNote: _note, operator: _operator, ...transaction }) =>
            transaction,
        ),
      };
    });
  };
}
