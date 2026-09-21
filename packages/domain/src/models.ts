import type {
  AdminPagePermission,
  EmployeeStatus,
  GroupStatus,
  IntentStatus,
  OperatorAccountStatus,
  OperatorRole,
  OrderStatus,
  ProductStatus,
  ProductType,
  QuotaTransactionType,
  ReviewStatus,
} from "./status.js";

export interface OperatorAccount {
  id: string;
  username: string;
  /**
   * 仅用于无后端原型演示；正式系统必须保存密码哈希。
   */
  password: string;
  displayName: string;
  role: OperatorRole;
  status: OperatorAccountStatus;
  pagePermissions: AdminPagePermission[];
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  contactName: string;
  contactPhone: string;
  cooperationStartDate: string;
  cooperationEndDate?: string;
  status: GroupStatus;
  note?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  /**
   * 仅用于无后端原型演示；正式系统必须保存密码哈希。
   */
  password: string;
  groupId: string;
  department?: string;
  employeeNumber?: string;
  position?: string;
  status: EmployeeStatus;
  note?: string;
  createdAt: string;
}

export interface QuotaAccount {
  id: string;
  employeeId: string;
  totalGranted: number;
  totalDeducted: number;
  totalRefunded: number;
  totalAdjusted: number;
  availableBalance: number;
  updatedAt: string;
}

export interface TravelProductDetails {
  destination: string;
  destinationHighlights: string;
  suitableTravelMonths: number[];
  recommendedStayDays: string;
  transportOptions?: string[];
  accommodation?: string;
  dining?: string;
  pickupService?: string;
  serviceScope: string;
}

export interface HotelProductDetails {
  city: string;
  address: string;
  starRating?: string;
  facilities?: string;
  trafficInfo?: string;
  checkInPolicy?: string;
  paidServices?: {
    title: string;
    description: string;
  }[];
}

export interface ProductGalleryItem {
  imageUrl: string;
  description: string;
}

export interface ProductVisibilityAll {
  scope: "all_groups";
}

export interface ProductVisibilitySpecified {
  scope: "specified_groups";
  groupIds: string[];
}

export type ProductVisibility =
  | ProductVisibilityAll
  | ProductVisibilitySpecified;

export interface ServiceProduct {
  id: string;
  name: string;
  type: ProductType;
  summary: string;
  coverImage: string;
  gallery?: ProductGalleryItem[];
  quotaReference?: {
    min: number;
    max?: number;
  };
  serviceDescription: string;
  notes: string;
  visibility: ProductVisibility;
  status: ProductStatus;
  sortOrder?: number;
  recommended?: boolean;
  travelDetails?: TravelProductDetails;
  hotelDetails?: HotelProductDetails;
  linkedHotelProductIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface HotelRoomType {
  id: string;
  hotelProductId: string;
  name: string;
  imageUrl?: string;
  bedType?: string;
  capacity: number;
  breakfast?: string;
  area?: string;
  description?: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HotelRoomDailyInventory {
  id: string;
  roomTypeId: string;
  date: string;
  quotaPrice: number;
  totalInventory: number;
  usedInventory: number;
  isAvailable: boolean;
  updatedAt: string;
}

export interface PersonalIntent {
  id: string;
  employeeId: string;
  productId: string;
  expectedTravelDate: string;
  expectedStayDays: number;
  companionCount?: number;
  preferredTransport?: string;
  needsPickup?: boolean;
  accommodationPreference?: string;
  preferredHotelProductId?: string;
  preferredHotelRoomTypeId?: string;
  additionalNotes?: string;
  convenientContactTime?: string;
  status: IntentStatus;
  assigneeAccountId?: string;
  internalNote?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 订单保存服务商品快照，历史订单不依赖商品后续是否修改或下架。
 */
export interface OrderProductSnapshot {
  productId: string;
  name: string;
  type: ProductType;
  summary: string;
  coverImage: string;
  gallery?: ProductGalleryItem[];
  quotaReference?: {
    min: number;
    max?: number;
  };
  serviceDescription: string;
  notes: string;
  travelDetails?: TravelProductDetails;
  hotelDetails?: HotelProductDetails;
}

export interface OrderHotelAccommodationSnapshot {
  hotelProductId: string;
  hotelName: string;
  roomTypeId?: string;
  roomTypeName?: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  quotaPricePerNight?: number;
  totalQuota?: number;
  address?: string;
  note?: string;
}

export interface PersonalOrder {
  id: string;
  orderNumber: string;
  sourceIntentId?: string;
  sourceProductId: string;
  employeeId: string;
  groupId: string;
  productSnapshot: OrderProductSnapshot;
  departureDate?: string;
  returnDate?: string;
  transport?: string;
  accommodation?: string;
  hotelAccommodation?: OrderHotelAccommodationSnapshot;
  pickupService?: string;
  servicePlan: string;
  plannedQuotaDeduction: number;
  deductedQuota: number;
  refundedQuota: number;
  finalConsumedQuota: number;
  status: OrderStatus;
  assigneeAccountId?: string;
  internalNote?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaTransaction {
  id: string;
  employeeId: string;
  type: QuotaTransactionType;
  /**
   * 发放、退回为正数；扣减为负数；调整可正可负。
   */
  amount: number;
  balanceAfter: number;
  relatedOrderId?: string;
  reason: string;
  internalNote?: string;
  operator: string;
  occurredAt: string;
}

export interface ServiceReview {
  id: string;
  orderId: string;
  employeeId: string;
  productId: string;
  rating: number;
  content: string;
  status: ReviewStatus;
  submittedAt: string;
  updatedAt: string;
  moderatedByAccountId?: string;
  moderatedAt?: string;
}

export interface PlatformData {
  operatorAccounts: OperatorAccount[];
  groups: Group[];
  employees: Employee[];
  quotaAccounts: QuotaAccount[];
  serviceProducts: ServiceProduct[];
  hotelRoomTypes: HotelRoomType[];
  hotelRoomDailyInventories: HotelRoomDailyInventory[];
  personalIntents: PersonalIntent[];
  personalOrders: PersonalOrder[];
  serviceReviews: ServiceReview[];
  quotaTransactions: QuotaTransaction[];
}
