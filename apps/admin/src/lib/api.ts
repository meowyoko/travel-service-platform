import type {
  AdjustQuotaInput,
  AssignPersonalOrderInput,
  ClosePersonalIntentInput,
  ConfirmPersonalOrderInput,
  ConvertIntentToOrderInput,
  CreateEmployeeInput,
  CreateEmployeesBatchInput,
  CreateGroupInput,
  CreateOperatorAccountInput,
  CreateServiceProductInput,
  GrantQuotaBatchInput,
  GrantQuotaInput,
  ModerateServiceReviewInput,
  RefundPersonalOrderQuotaInput,
  UpdateEmployeeInput,
  UpdateGroupInput,
  UpdateIntentFollowUpInput,
  UpdateOperatorAccountInput,
  UpdatePendingOrderInput,
  UpdatePersonalOrderStatusInput,
  UpdatePersonalOrderTravelDatesInput,
  UpdateServiceProductInput,
} from "@travel/application";
import type {
  AdminEmployeeDto,
  AdminOperatorAccountDto,
  PersonalIntentDto,
  PersonalOrderDto,
  PublicOperatorAccount,
  QuotaTransactionDto,
  ServiceProductDto,
  ServiceReviewDto,
  PaginatedResponse,
} from "@travel/contracts";
import type { Group, QuotaAccount } from "@travel/domain";

export interface AdminPlatformData {
  operatorAccounts: AdminOperatorAccountDto[];
  groups: Group[];
  employees: AdminEmployeeDto[];
  quotaAccounts: QuotaAccount[];
  serviceProducts: ServiceProductDto[];
  personalIntents: PersonalIntentDto[];
  personalOrders: PersonalOrderDto[];
  serviceReviews: ServiceReviewDto[];
  quotaTransactions: QuotaTransactionDto[];
}

interface ApiErrorBody {
  message?: string;
}

async function apiRequest<TResult>(
  path: string,
  init?: RequestInit,
): Promise<TResult> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      ...(init?.body && !isFormData
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // 保留统一错误提示。
    }
    throw new Error(body.message || `请求失败（${response.status}）`);
  }
  if (response.status === 204) {
    return undefined as TResult;
  }
  return (await response.json()) as TResult;
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

export async function fetchPaginated<TResult>(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<PaginatedResponse<TResult>> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return apiRequest<PaginatedResponse<TResult>>(`${path}?${search}`);
}

export async function restoreAdminSession(): Promise<PublicOperatorAccount> {
  const response = await apiRequest<{ account: PublicOperatorAccount }>(
    "/api/admin/session",
  );
  return response.account;
}

export async function loginAdmin(
  username: string,
  password: string,
): Promise<PublicOperatorAccount> {
  const response = await apiRequest<{ account: PublicOperatorAccount }>(
    "/api/admin/session",
    {
      method: "POST",
      body: jsonBody({ identifier: username, password }),
    },
  );
  return response.account;
}

export async function logoutAdmin(): Promise<void> {
  await apiRequest("/api/admin/session", { method: "DELETE" });
}

export async function fetchAdminContext(): Promise<AdminPlatformData> {
  const response = await apiRequest<{ data: AdminPlatformData }>(
    "/api/admin/context",
  );
  return response.data;
}

export async function uploadProductImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("image", file);
  const response = await apiRequest<{ url: string }>(
    "/api/admin/uploads/product-images",
    { method: "POST", body },
  );
  return response.url;
}

export class RemotePlatformService {
  createOperatorAccount(input: CreateOperatorAccountInput) {
    const { actorAccountId: _actor, ...body } = input;
    return apiRequest("/api/admin/operator-accounts", {
      method: "POST",
      body: jsonBody(body),
    });
  }

  updateOperatorAccount(input: UpdateOperatorAccountInput) {
    const { actorAccountId: _actor, accountId, ...body } = input;
    return apiRequest(`/api/admin/operator-accounts/${accountId}`, {
      method: "PATCH",
      body: jsonBody(body),
    });
  }

  createGroup(input: CreateGroupInput) {
    return apiRequest("/api/admin/groups", {
      method: "POST",
      body: jsonBody(input),
    });
  }

  updateGroup(input: UpdateGroupInput) {
    const { groupId, ...body } = input;
    return apiRequest(`/api/admin/groups/${groupId}`, {
      method: "PATCH",
      body: jsonBody(body),
    });
  }

  deleteGroup(groupId: string) {
    return apiRequest(`/api/admin/groups/${groupId}`, { method: "DELETE" });
  }

  createEmployee(input: CreateEmployeeInput) {
    return apiRequest("/api/admin/employees", {
      method: "POST",
      body: jsonBody(input),
    });
  }

  createEmployeesBatch(input: CreateEmployeesBatchInput) {
    return apiRequest("/api/admin/employees/batch", {
      method: "POST",
      body: jsonBody(input),
    });
  }

  updateEmployee(input: UpdateEmployeeInput) {
    const { employeeId, ...body } = input;
    return apiRequest(`/api/admin/employees/${employeeId}`, {
      method: "PATCH",
      body: jsonBody(body),
    });
  }

  deleteEmployee(employeeId: string) {
    return apiRequest(`/api/admin/employees/${employeeId}`, {
      method: "DELETE",
    });
  }

  grantQuota(input: GrantQuotaInput) {
    return this.grantQuotaBatch({
      employeeIds: [input.employeeId],
      amount: input.amount,
      reason: input.reason,
      operator: input.operator,
    });
  }

  grantQuotaBatch(input: GrantQuotaBatchInput) {
    const { operator: _operator, ...body } = input;
    return apiRequest("/api/admin/quota-grants", {
      method: "POST",
      body: jsonBody(body),
    });
  }

  adjustQuota(input: AdjustQuotaInput) {
    const { employeeId, operator: _operator, ...body } = input;
    return apiRequest(
      `/api/admin/employees/${employeeId}/quota-adjustments`,
      { method: "POST", body: jsonBody(body) },
    );
  }

  refundPersonalOrderQuota(input: RefundPersonalOrderQuotaInput) {
    const { orderId, operator: _operator, ...body } = input;
    return apiRequest(`/api/admin/orders/${orderId}/refunds`, {
      method: "POST",
      body: jsonBody(body),
    });
  }

  createServiceProduct(input: CreateServiceProductInput) {
    return apiRequest("/api/admin/products", {
      method: "POST",
      body: jsonBody(input),
    });
  }

  updateServiceProduct(input: UpdateServiceProductInput) {
    const { productId, ...body } = input;
    return apiRequest(`/api/admin/products/${productId}`, {
      method: "PATCH",
      body: jsonBody(body),
    });
  }

  deleteServiceProduct(productId: string) {
    return apiRequest(`/api/admin/products/${productId}`, {
      method: "DELETE",
    });
  }

  publishServiceProduct(productId: string) {
    return apiRequest(`/api/admin/products/${productId}/publish`, {
      method: "POST",
    });
  }

  unpublishServiceProduct(productId: string) {
    return apiRequest(`/api/admin/products/${productId}/unpublish`, {
      method: "POST",
    });
  }

  updateIntentFollowUp(input: UpdateIntentFollowUpInput) {
    const { intentId, ...body } = input;
    return apiRequest(`/api/admin/intents/${intentId}/follow-up`, {
      method: "PATCH",
      body: jsonBody(body),
    });
  }

  closePersonalIntent(input: ClosePersonalIntentInput) {
    const { intentId, ...body } = input;
    return apiRequest(`/api/admin/intents/${intentId}/close`, {
      method: "POST",
      body: jsonBody(body),
    });
  }

  convertIntentToPendingOrder(input: ConvertIntentToOrderInput) {
    const { intentId, ...body } = input;
    return apiRequest(`/api/admin/intents/${intentId}/orders`, {
      method: "POST",
      body: jsonBody(body),
    });
  }

  updatePendingPersonalOrder(input: UpdatePendingOrderInput) {
    const { orderId, ...body } = input;
    return apiRequest(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      body: jsonBody(body),
    });
  }

  assignPersonalOrder(input: AssignPersonalOrderInput) {
    const { orderId, ...body } = input;
    return apiRequest(`/api/admin/orders/${orderId}/assignee`, {
      method: "PATCH",
      body: jsonBody(body),
    });
  }

  updatePersonalOrderTravelDates(
    input: UpdatePersonalOrderTravelDatesInput,
  ) {
    const { orderId, ...body } = input;
    return apiRequest(`/api/admin/orders/${orderId}/travel-dates`, {
      method: "PATCH",
      body: jsonBody(body),
    });
  }

  confirmPersonalOrder(input: ConfirmPersonalOrderInput) {
    return apiRequest(`/api/admin/orders/${input.orderId}/confirm`, {
      method: "POST",
    });
  }

  updatePersonalOrderStatus(input: UpdatePersonalOrderStatusInput) {
    return apiRequest(`/api/admin/orders/${input.orderId}/cancel`, {
      method: "POST",
    });
  }

  moderateServiceReview(input: ModerateServiceReviewInput) {
    const { reviewId, actorAccountId: _actor, ...body } = input;
    return apiRequest(`/api/admin/reviews/${reviewId}`, {
      method: "PATCH",
      body: jsonBody(body),
    });
  }

  syncPersonalOrderStatuses() {
    return apiRequest<{ updatedCount: number }>(
      "/api/admin/orders/sync-statuses",
      { method: "POST" },
    ).then(({ updatedCount }) => updatedCount);
  }
}
