import type {
  PersonalIntentDto,
  PersonalOrderDto,
  HotelRoomDailyInventoryDto,
  HotelRoomTypeDto,
  PublicEmployee,
  QuotaTransactionDto,
  ServiceProductDto,
  ServiceReviewDto,
  SubmitPersonalIntentRequest,
  SubmitOrderReviewRequest,
  PaginatedResponse,
} from "@travel/contracts";
import type { QuotaAccount } from "@travel/domain";

interface ApiErrorBody {
  message?: string;
}

export interface EmployeeContextData {
  employee: PublicEmployee;
  group: {
    id: string;
    name: string;
    status: "active" | "paused" | "ended";
  } | null;
  quotaAccount: QuotaAccount | null;
  visibleProducts: ServiceProductDto[];
  hotelRoomTypes: HotelRoomTypeDto[];
  hotelRoomDailyInventories: HotelRoomDailyInventoryDto[];
  personalIntents: PersonalIntentDto[];
  personalOrders: PersonalOrderDto[];
  personalReviews: ServiceReviewDto[];
  publishedReviews: ServiceReviewDto[];
  personalQuotaTransactions: Array<
    Omit<QuotaTransactionDto, "internalNote" | "operator">
  >;
}

async function apiRequest<TResult>(
  path: string,
  init?: RequestInit,
): Promise<TResult> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // 使用统一兜底提示。
    }
    throw new Error(body.message || `请求失败（${response.status}）`);
  }
  if (response.status === 204) {
    return undefined as TResult;
  }
  return (await response.json()) as TResult;
}

export async function restoreEmployeeSession(): Promise<PublicEmployee> {
  const response = await apiRequest<{ employee: PublicEmployee }>(
    "/api/employee/session",
  );
  return response.employee;
}

export async function loginEmployee(
  phone: string,
  password: string,
): Promise<PublicEmployee> {
  const response = await apiRequest<{ employee: PublicEmployee }>(
    "/api/employee/session",
    {
      method: "POST",
      body: JSON.stringify({ identifier: phone, password }),
    },
  );
  return response.employee;
}

export async function logoutEmployee(): Promise<void> {
  await apiRequest("/api/employee/session", { method: "DELETE" });
}

export async function fetchEmployeeContext(): Promise<EmployeeContextData> {
  return apiRequest<EmployeeContextData>("/api/employee/context");
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

export async function submitIntent(
  input: SubmitPersonalIntentRequest,
): Promise<PersonalIntentDto> {
  const response = await apiRequest<{ intent: PersonalIntentDto }>(
    "/api/employee/intents",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return response.intent;
}

export async function withdrawIntent(
  intentId: string,
): Promise<PersonalIntentDto> {
  const response = await apiRequest<{ intent: PersonalIntentDto }>(
    `/api/employee/intents/${intentId}/withdraw`,
    { method: "POST" },
  );
  return response.intent;
}

export async function submitOrderReview(
  orderId: string,
  input: SubmitOrderReviewRequest,
): Promise<ServiceReviewDto> {
  const response = await apiRequest<{ review: ServiceReviewDto }>(
    `/api/employee/orders/${orderId}/review`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return response.review;
}
