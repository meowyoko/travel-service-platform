import { mockData } from "@travel/mock-data";
import { count } from "drizzle-orm";

import { hashPassword } from "../auth/password.js";
import type { Database } from "./client.js";
import {
  employees,
  groups,
  operatorAccounts,
  operatorPagePermissions,
  personalIntents,
  personalOrders,
  productVisibleGroups,
  quotaAccounts,
  quotaTransactions,
  serviceProducts,
  serviceReviews,
} from "./schema.js";

function toDate(value: string): Date {
  return new Date(value);
}

export async function seedDatabase(db: Database): Promise<void> {
  const operatorPasswordHashes = await Promise.all(
    mockData.operatorAccounts.map(({ password }) => hashPassword(password)),
  );
  const employeePasswordHashes = await Promise.all(
    mockData.employees.map(({ password }) => hashPassword(password)),
  );

  await db.transaction(async (tx) => {
    const existingOperators = await tx
      .select({ total: count() })
      .from(operatorAccounts);
    const total = existingOperators[0]?.total ?? 0;
    if (total > 0) {
      throw new Error("数据库已有运营账号，拒绝重复执行 Seed");
    }

    await tx.insert(groups).values(
      mockData.groups.map((group) => ({
        id: group.id,
        name: group.name,
        contactName: group.contactName,
        contactPhone: group.contactPhone,
        cooperationStartDate: group.cooperationStartDate,
        cooperationEndDate: group.cooperationEndDate ?? null,
        status: group.status,
        note: group.note ?? null,
        createdAt: toDate(group.createdAt),
      })),
    );

    await tx.insert(operatorAccounts).values(
      mockData.operatorAccounts.map((account, index) => ({
        id: account.id,
        username: account.username,
        passwordHash: operatorPasswordHashes[index]!,
        displayName: account.displayName,
        role: account.role,
        status: account.status,
        createdAt: toDate(account.createdAt),
        updatedAt: toDate(account.updatedAt),
      })),
    );

    const permissionRows = mockData.operatorAccounts.flatMap((account) =>
      account.pagePermissions.map((permission) => ({
        operatorAccountId: account.id,
        permission,
      })),
    );
    if (permissionRows.length > 0) {
      await tx.insert(operatorPagePermissions).values(permissionRows);
    }

    await tx.insert(employees).values(
      mockData.employees.map((employee, index) => ({
        id: employee.id,
        name: employee.name,
        phone: employee.phone,
        passwordHash: employeePasswordHashes[index]!,
        groupId: employee.groupId,
        department: employee.department ?? null,
        employeeNumber: employee.employeeNumber ?? null,
        position: employee.position ?? null,
        status: employee.status,
        note: employee.note ?? null,
        createdAt: toDate(employee.createdAt),
      })),
    );

    await tx.insert(quotaAccounts).values(
      mockData.quotaAccounts.map((account) => ({
        ...account,
        updatedAt: toDate(account.updatedAt),
      })),
    );

    await tx.insert(serviceProducts).values(
      mockData.serviceProducts.map((product) => ({
        id: product.id,
        name: product.name,
        type: product.type,
        summary: product.summary,
        coverImage: product.coverImage,
        gallery: product.gallery ?? null,
        quotaReference: product.quotaReference ?? null,
        serviceDescription: product.serviceDescription,
        notes: product.notes,
        visibilityScope: product.visibility.scope,
        status: product.status,
        sortOrder: product.sortOrder ?? null,
        recommended: product.recommended ?? null,
        travelDetails: product.travelDetails ?? null,
        createdAt: toDate(product.createdAt),
        updatedAt: toDate(product.updatedAt),
      })),
    );

    const visibilityRows = mockData.serviceProducts.flatMap((product) =>
      product.visibility.scope === "specified_groups"
        ? product.visibility.groupIds.map((groupId) => ({
            productId: product.id,
            groupId,
          }))
        : [],
    );
    if (visibilityRows.length > 0) {
      await tx.insert(productVisibleGroups).values(visibilityRows);
    }

    await tx.insert(personalIntents).values(
      mockData.personalIntents.map((intent) => ({
        id: intent.id,
        employeeId: intent.employeeId,
        productId: intent.productId,
        expectedTravelDate: intent.expectedTravelDate,
        expectedStayDays: intent.expectedStayDays,
        companionCount: intent.companionCount ?? null,
        preferredTransport: intent.preferredTransport ?? null,
        needsPickup: intent.needsPickup ?? null,
        accommodationPreference: intent.accommodationPreference ?? null,
        additionalNotes: intent.additionalNotes ?? null,
        convenientContactTime: intent.convenientContactTime ?? null,
        status: intent.status,
        assigneeAccountId: intent.assigneeAccountId ?? null,
        internalNote: intent.internalNote ?? null,
        createdAt: toDate(intent.createdAt),
        updatedAt: toDate(intent.updatedAt),
      })),
    );

    await tx.insert(personalOrders).values(
      mockData.personalOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        sourceIntentId: order.sourceIntentId ?? null,
        sourceProductId: order.sourceProductId,
        employeeId: order.employeeId,
        groupId: order.groupId,
        productSnapshot: order.productSnapshot,
        departureDate: order.departureDate ?? null,
        returnDate: order.returnDate ?? null,
        transport: order.transport ?? null,
        accommodation: order.accommodation ?? null,
        pickupService: order.pickupService ?? null,
        servicePlan: order.servicePlan,
        plannedQuotaDeduction: order.plannedQuotaDeduction,
        deductedQuota: order.deductedQuota,
        refundedQuota: order.refundedQuota,
        finalConsumedQuota: order.finalConsumedQuota,
        status: order.status,
        assigneeAccountId: order.assigneeAccountId ?? null,
        internalNote: order.internalNote ?? null,
        confirmedAt: order.confirmedAt ? toDate(order.confirmedAt) : null,
        createdAt: toDate(order.createdAt),
        updatedAt: toDate(order.updatedAt),
      })),
    );

    if (mockData.serviceReviews.length > 0) {
      await tx.insert(serviceReviews).values(
        mockData.serviceReviews.map((review) => ({
          id: review.id,
          orderId: review.orderId,
          employeeId: review.employeeId,
          productId: review.productId,
          rating: review.rating,
          content: review.content,
          status: review.status,
          submittedAt: toDate(review.submittedAt),
          updatedAt: toDate(review.updatedAt),
          moderatedByAccountId: review.moderatedByAccountId ?? null,
          moderatedAt: review.moderatedAt
            ? toDate(review.moderatedAt)
            : null,
        })),
      );
    }

    if (mockData.quotaTransactions.length > 0) {
      await tx.insert(quotaTransactions).values(
        mockData.quotaTransactions.map((transaction) => ({
          id: transaction.id,
          employeeId: transaction.employeeId,
          type: transaction.type,
          amount: transaction.amount,
          balanceAfter: transaction.balanceAfter,
          relatedOrderId: transaction.relatedOrderId ?? null,
          reason: transaction.reason,
          internalNote: transaction.internalNote ?? null,
          operator: transaction.operator,
          occurredAt: toDate(transaction.occurredAt),
        })),
      );
    }
  });
}
