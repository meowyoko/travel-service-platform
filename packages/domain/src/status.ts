export const GROUP_STATUSES = ["active", "paused", "ended"] as const;
export type GroupStatus = (typeof GROUP_STATUSES)[number];

export const EMPLOYEE_STATUSES = ["active", "disabled"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const OPERATOR_ACCOUNT_STATUSES = ["active", "disabled"] as const;
export type OperatorAccountStatus =
  (typeof OPERATOR_ACCOUNT_STATUSES)[number];

export const OPERATOR_ROLES = ["leader", "staff"] as const;
export type OperatorRole = (typeof OPERATOR_ROLES)[number];

export const ADMIN_PAGE_PERMISSIONS = [
  "groups",
  "employees",
  "quotas",
  "products",
  "hotels",
  "intents",
  "orders",
  "reviews",
  "operator_accounts",
] as const;
export type AdminPagePermission =
  (typeof ADMIN_PAGE_PERMISSIONS)[number];

export const PRODUCT_TYPES = [
  "travel",
  "hotel",
  "insurance",
  "medical",
  "health_management",
  "other",
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_STATUSES = ["draft", "published"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const INTENT_STATUSES = [
  "pending_follow_up",
  "communicating",
  "converted_to_order",
  "withdrawn_by_employee",
  "closed",
] as const;
export type IntentStatus = (typeof INTENT_STATUSES)[number];

export const ORDER_STATUSES = [
  "pending_confirmation",
  "confirmed",
  "waiting_for_service",
  "in_service",
  "completed",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const REVIEW_STATUSES = [
  "pending_review",
  "published",
  "hidden",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const QUOTA_TRANSACTION_TYPES = [
  "grant",
  "deduction",
  "refund",
  "adjustment",
] as const;
export type QuotaTransactionType =
  (typeof QUOTA_TRANSACTION_TYPES)[number];
