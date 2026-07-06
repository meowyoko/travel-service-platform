import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { requireAdmin, requireEmployee } from "../auth/guards.js";
import type { Database } from "../db/client.js";
import {
  pageEmployees,
  pageGroups,
  pageIntents,
  pageOrders,
  pageProducts,
  pageReviews,
  pageTransactions,
} from "./paged-read-model.js";
import { parsePageQuery, type PageQuery } from "./pagination.js";
import {
  listEmployees,
  listAdminOperatorAccounts,
  listGroups,
  listOperatorAccounts,
  listPersonalIntents,
  listPersonalOrders,
  listQuotaAccounts,
  listQuotaTransactions,
  listServiceReviews,
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

    app.get("/operator-accounts", async (request) => {
      await requireAdmin(db, request, "operator_accounts");
      return {
        operatorAccounts: await listAdminOperatorAccounts(db),
      };
    });

    app.get("/groups", async (request) => {
      await requireAdmin(db, request, "groups");
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        return pageGroups(db, parsePageQuery(query));
      }
      return { groups: await listGroups(db) };
    });

    app.get("/employees", async (request) => {
      await requireAdmin(db, request, "employees");
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        return pageEmployees(db, parsePageQuery(query));
      }
      return { employees: await listEmployees(db) };
    });

    app.get("/quota-accounts", async (request) => {
      await requireAdmin(db, request, "quotas");
      return { quotaAccounts: await listQuotaAccounts(db) };
    });

    app.get("/quota-transactions", async (request) => {
      await requireAdmin(db, request, "quotas");
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        return pageTransactions(db, parsePageQuery(query));
      }
      return {
        quotaTransactions: await listQuotaTransactions(db),
      };
    });

    app.get("/products", async (request) => {
      await requireAdmin(db, request, "products");
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        return pageProducts(db, parsePageQuery(query));
      }
      return { serviceProducts: await listServiceProducts(db) };
    });

    app.get("/intents", async (request) => {
      await requireAdmin(db, request, "intents");
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        return pageIntents(db, parsePageQuery(query));
      }
      return { personalIntents: await listPersonalIntents(db) };
    });

    app.get("/orders", async (request) => {
      await requireAdmin(db, request, "orders");
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        return pageOrders(db, parsePageQuery(query));
      }
      return { personalOrders: await listPersonalOrders(db) };
    });

    app.get("/reviews", async (request) => {
      await requireAdmin(db, request, "reviews");
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        return pageReviews(db, parsePageQuery(query));
      }
      return { serviceReviews: await listServiceReviews(db) };
    });
  };
}

export function createEmployeeReadRoutes(
  db: Database,
): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.get("/products", async (request) => {
      const employee = await requireEmployee(db, request);
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        return pageProducts(db, {
          ...parsePageQuery(query),
          visibleGroupId: employee.groupId,
          publishedOnly: true,
        });
      }
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
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        return pageIntents(db, {
          ...parsePageQuery(query),
          employeeId: employee.id,
        });
      }
      return {
        personalIntents: await listPersonalIntents(db, employee.id),
      };
    });

    app.get("/orders", async (request) => {
      const employee = await requireEmployee(db, request);
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        return pageOrders(db, {
          ...parsePageQuery(query),
          employeeId: employee.id,
        });
      }
      return {
        personalOrders: await listPersonalOrders(db, employee.id),
      };
    });

    app.get("/quota", async (request) => {
      const employee = await requireEmployee(db, request);
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        const [accounts, transactions] = await Promise.all([
          listQuotaAccounts(db, employee.id),
          pageTransactions(db, {
            ...parsePageQuery(query),
            employeeId: employee.id,
          }),
        ]);
        return {
          quotaAccount: accounts[0] ?? null,
          items: transactions.items.map(
            ({ internalNote: _note, operator: _operator, ...transaction }) =>
              transaction,
          ),
          pagination: transactions.pagination,
        };
      }
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

    app.get("/group", async (request) => {
      const employee = await requireEmployee(db, request);
      const currentGroup = (await listGroups(db)).find(
        ({ id }) => id === employee.groupId,
      );
      return {
        group: currentGroup
          ? {
              id: currentGroup.id,
              name: currentGroup.name,
              status: currentGroup.status,
            }
          : null,
      };
    });

    app.get("/reviews", async (request) => {
      const employee = await requireEmployee(db, request);
      const query = request.query as PageQuery;
      if (query.page !== undefined) {
        return pageReviews(db, {
          ...parsePageQuery(query),
          employeeId: employee.id,
        });
      }
      const [personalReviews, allReviews, products] = await Promise.all([
        listServiceReviews(db, employee.id),
        listServiceReviews(db),
        listServiceProducts(db),
      ]);
      const visibleProductIds = new Set(
        products
          .filter(
            (product) =>
              product.status === "published" &&
              (product.visibility.scope === "all_groups" ||
                product.visibility.groupIds.includes(employee.groupId)),
          )
          .map(({ id }) => id),
      );
      return {
        personalReviews,
        publishedReviews: allReviews.filter(
          ({ productId, status }) =>
            status === "published" && visibleProductIds.has(productId),
        ),
      };
    });
  };
}
