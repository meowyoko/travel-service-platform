import {
  ADMIN_PAGE_PERMISSIONS,
  createOrderProductSnapshot,
  type AdminPagePermission,
  type Employee,
  type Group,
  type GroupStatus,
  type HotelProductDetails,
  type OrderStatus,
  type OperatorAccount,
  type OperatorRole,
  type PersonalIntent,
  type PersonalOrder,
  type PlatformData,
  type ProductGalleryItem,
  type ProductType,
  type ProductVisibility,
  type QuotaTransaction,
  type ReviewStatus,
  type ServiceReview,
  type ServiceProduct,
  type TravelProductDetails,
} from "@travel/domain";

import type { PlatformRepository } from "./repository.js";

export interface PlatformServiceDependencies {
  now: () => string;
  nextId: (scope: string) => string;
  nextOrderNumber?: () => string;
}

export interface CreateGroupInput {
  name: string;
  contactName: string;
  contactPhone: string;
  cooperationStartDate: string;
  cooperationEndDate?: string;
  status?: GroupStatus;
  note?: string;
}

export interface CreateOperatorAccountInput {
  actorAccountId: string;
  username: string;
  password: string;
  displayName: string;
  role: OperatorRole;
  pagePermissions: AdminPagePermission[];
}

export interface UpdateOperatorAccountInput {
  actorAccountId: string;
  accountId: string;
  displayName: string;
  role: OperatorRole;
  status: "active" | "disabled";
  pagePermissions: AdminPagePermission[];
  newPassword?: string;
}

export interface UpdateGroupInput {
  groupId: string;
  name: string;
  contactName: string;
  contactPhone: string;
  cooperationStartDate: string;
  cooperationEndDate?: string;
  status: GroupStatus;
  note?: string;
}

export interface CreateEmployeeInput {
  name: string;
  phone: string;
  password: string;
  groupId: string;
  department?: string;
  employeeNumber?: string;
  position?: string;
  note?: string;
}

export interface CreateEmployeesBatchInput {
  groupId: string;
  employees: Array<{
    name: string;
    phone: string;
    password?: string;
    department?: string;
    employeeNumber?: string;
  }>;
}

export interface UpdateEmployeeInput {
  employeeId: string;
  groupId: string;
  department?: string;
  employeeNumber?: string;
  position?: string;
  status: "active" | "disabled";
  note?: string;
}

export interface AuthenticateEmployeeInput {
  phone: string;
  password: string;
}

export interface GrantQuotaInput {
  employeeId: string;
  amount: number;
  reason: string;
  operator: string;
}

export interface GrantQuotaBatchInput {
  employeeIds: string[];
  amount: number;
  reason: string;
  operator: string;
}

export interface AdjustQuotaInput {
  employeeId: string;
  amount: number;
  reason: string;
  operator: string;
}

export interface RefundPersonalOrderQuotaInput {
  orderId: string;
  amount: number;
  reason: string;
  internalNote?: string;
  operator: string;
}

export interface CreateHotelRoomTypeInput {
  hotelProductId: string;
  name: string;
  imageUrl?: string;
  bedType?: string;
  capacity: number;
  breakfast?: string;
  area?: string;
  description?: string;
}

export interface UpdateHotelRoomTypeInput extends CreateHotelRoomTypeInput {
  roomTypeId: string;
  status: "draft" | "published";
}

export interface UpsertHotelRoomInventoryInput {
  roomTypeId: string;
  date: string;
  quotaPrice: number;
  totalInventory: number;
  isAvailable: boolean;
}

export interface CreateServiceProductInput {
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
  sortOrder?: number;
  recommended?: boolean;
  travelDetails?: TravelProductDetails;
  hotelDetails?: HotelProductDetails;
  linkedHotelProductIds?: string[];
}

export interface UpdateServiceProductInput
  extends CreateServiceProductInput {
  productId: string;
  confirmDescriptionChanges?: boolean;
}

export interface ServiceProductUsage {
  hasIntent: boolean;
  hasOrder: boolean;
  hasBusinessRecords: boolean;
}

export interface SubmitPersonalIntentInput {
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
}

export interface WithdrawPersonalIntentInput {
  employeeId: string;
  intentId: string;
}

export interface UpdateIntentFollowUpInput {
  intentId: string;
  status: "pending_follow_up" | "communicating";
  assigneeAccountId: string;
  internalNote?: string;
}

export interface ClosePersonalIntentInput {
  intentId: string;
  assigneeAccountId: string;
  internalNote?: string;
}

export interface ConvertIntentToOrderInput {
  intentId: string;
  assigneeAccountId: string;
  plannedQuotaDeduction: number;
  servicePlan: string;
  departureDate?: string;
  returnDate?: string;
  transport?: string;
  accommodation?: string;
  hotelAccommodation?: {
    hotelProductId: string;
    roomTypeId?: string;
    checkInDate: string;
    checkOutDate: string;
    note?: string;
  };
  pickupService?: string;
  internalNote?: string;
}

export interface UpdatePendingOrderInput {
  orderId: string;
  plannedQuotaDeduction?: number;
  servicePlan?: string;
  departureDate?: string;
  returnDate?: string;
  transport?: string;
  accommodation?: string;
  hotelAccommodation?: {
    hotelProductId: string;
    roomTypeId?: string;
    checkInDate: string;
    checkOutDate: string;
    note?: string;
  } | null;
  pickupService?: string;
  internalNote?: string;
}

export interface AssignPersonalOrderInput {
  orderId: string;
  assigneeAccountId: string;
}

export interface UpdatePersonalOrderTravelDatesInput {
  orderId: string;
  departureDate: string;
  returnDate: string;
}

export interface ConfirmPersonalOrderInput {
  orderId: string;
  operator: string;
}

export interface UpdatePersonalOrderStatusInput {
  orderId: string;
  status: "cancelled";
}

export interface SubmitPersonalOrderReviewInput {
  orderId: string;
  employeeId: string;
  rating: number;
  content: string;
}

export interface ModerateServiceReviewInput {
  reviewId: string;
  actorAccountId: string;
  status: Extract<ReviewStatus, "published" | "hidden">;
}

let defaultIdSequence = 0;

const defaultDependencies: PlatformServiceDependencies = {
  now: () => new Date().toISOString(),
  nextId: (scope) => {
    defaultIdSequence += 1;
    return `${scope}-${Date.now()}-${defaultIdSequence}`;
  },
  nextOrderNumber: () => {
    defaultIdSequence += 1;
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    return `PO-${date}-${String(defaultIdSequence).padStart(4, "0")}`;
  },
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertPositiveAmount(amount: number, fieldName: string): void {
  assert(
    Number.isFinite(amount) && amount > 0,
    `${fieldName}必须是大于 0 的数字`,
  );
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertTravelDateRange(
  departureDate: string | undefined,
  returnDate: string | undefined,
  required = false,
): void {
  if (required) {
    assert(departureDate && returnDate, "确认订单前必须填写出行日期和返程日期");
  }

  if (!departureDate && !returnDate) {
    return;
  }

  assert(departureDate && returnDate, "出行日期和返程日期必须同时填写");
  assert(DATE_PATTERN.test(departureDate), "出行日期必须使用 YYYY-MM-DD 格式");
  assert(DATE_PATTERN.test(returnDate), "返程日期必须使用 YYYY-MM-DD 格式");
  assert(returnDate >= departureDate, "返程日期不能早于出行日期");
}

function getShanghaiDate(now: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getAutomaticOrderStatus(
  now: string,
  departureDate: string,
  returnDate: string,
): Extract<OrderStatus, "waiting_for_service" | "in_service" | "completed"> {
  const today = getShanghaiDate(now);

  if (today < departureDate) {
    return "waiting_for_service";
  }
  if (today <= returnDate) {
    return "in_service";
  }
  return "completed";
}

function getEmployee(data: PlatformData, employeeId: string): Employee {
  const employee = data.employees.find(({ id }) => id === employeeId);
  assert(employee, `员工不存在：${employeeId}`);
  return employee;
}

function getOperatorAccount(
  data: PlatformData,
  accountId: string,
): OperatorAccount {
  const account = data.operatorAccounts.find(({ id }) => id === accountId);
  assert(account, `运营账号不存在：${accountId}`);
  return account;
}

function getActiveOperatorAccount(
  data: PlatformData,
  accountId: string,
): OperatorAccount {
  const account = getOperatorAccount(data, accountId);
  assert(account.status === "active", "停用的运营账号不可参与业务");
  return account;
}

function normalizePermissions(
  role: OperatorRole,
  permissions: AdminPagePermission[],
): AdminPagePermission[] {
  if (role === "leader") {
    return [...ADMIN_PAGE_PERMISSIONS];
  }

  return [
    ...new Set(
      permissions.filter((permission) =>
        ADMIN_PAGE_PERMISSIONS.includes(permission) &&
        permission !== "operator_accounts",
      ),
    ),
  ];
}

function assertProductContent(product: CreateServiceProductInput): void {
  assert(product.name.trim(), "商品名称不能为空");
  assert(product.summary.trim(), "商品简介不能为空");
  assert(product.coverImage.trim(), "商品主图不能为空");
  assert(product.serviceDescription.trim(), "服务说明不能为空");
  assert(product.notes.trim(), "注意事项不能为空");
  for (const item of product.gallery ?? []) {
    assert(item.imageUrl.trim(), "图文项目图片不能为空");
    assert(item.description.trim(), "图片说明不能为空");
    assert(item.description.trim().length <= 100, "图片说明不能超过100字");
  }

  if (product.quotaReference) {
    assertPositiveAmount(product.quotaReference.min, "额度参考下限");
    assert(
      product.quotaReference.max === undefined ||
        product.quotaReference.max >= product.quotaReference.min,
      "额度参考上限不能小于下限",
    );
  }

  if (product.type === "travel") {
    const details = product.travelDetails;
    assert(details, "疗养旅游类商品必须填写旅游扩展信息");
    assert(details.destination.trim(), "目的地不能为空");
    assert(details.destinationHighlights.trim(), "目的地特色不能为空");
    assert(details.recommendedStayDays.trim(), "建议停留天数不能为空");
    assert(details.serviceScope.trim(), "服务范围说明不能为空");

    assert(
      details.suitableTravelMonths.length > 0 &&
        details.suitableTravelMonths.every(
          (month) => Number.isInteger(month) && month >= 1 && month <= 12,
        ),
      "请至少选择一个适宜月份",
    );
  }

  if (product.type === "hotel") {
    const details = product.hotelDetails;
    assert(details, "酒店类商品必须填写酒店扩展信息");
    assert(details.city.trim(), "酒店城市不能为空");
    assert(details.address.trim(), "酒店地址不能为空");
  }
}

function normalizeHotelDetails(
  details: HotelProductDetails | undefined,
): HotelProductDetails | undefined {
  if (!details) return undefined;
  const { paidServices: _paidServices, ...baseDetails } = details;
  const paidServices = (details.paidServices ?? [])
    .map((service) => ({
      title: service.title.trim(),
      description: service.description.trim(),
    }))
    .filter(
      ({ title, description }) => title.length > 0 || description.length > 0,
    );
  assert(
    paidServices.every(({ title, description }) => title && description),
    "付费服务标题和详情说明需同时填写",
  );
  const normalized: HotelProductDetails = {
    ...baseDetails,
    city: details.city.trim(),
    address: details.address.trim(),
  };
  const starRating = details.starRating?.trim();
  const facilities = details.facilities?.trim();
  const trafficInfo = details.trafficInfo?.trim();
  const checkInPolicy = details.checkInPolicy?.trim();
  if (starRating !== undefined) normalized.starRating = starRating;
  if (facilities !== undefined) normalized.facilities = facilities;
  if (trafficInfo !== undefined) normalized.trafficInfo = trafficInfo;
  if (checkInPolicy !== undefined) normalized.checkInPolicy = checkInPolicy;
  if (paidServices.length > 0) normalized.paidServices = paidServices;
  return normalized;
}

function hotelDetailsWithoutPaidServices(
  details: HotelProductDetails | undefined,
): Omit<HotelProductDetails, "paidServices"> | undefined {
  if (!details) return undefined;
  const { paidServices: _paidServices, ...rest } = details;
  return rest;
}

function isSameVisibility(
  left: ProductVisibility,
  right: ProductVisibility,
): boolean {
  if (left.scope !== right.scope) {
    return false;
  }

  if (left.scope === "all_groups" || right.scope === "all_groups") {
    return true;
  }

  return (
    left.groupIds.length === right.groupIds.length &&
    [...left.groupIds].sort().every(
      (groupId, index) => groupId === [...right.groupIds].sort()[index],
    )
  );
}

function getProductUsage(
  data: PlatformData,
  productId: string,
): ServiceProductUsage {
  const hasIntent = data.personalIntents.some(
    (intent) => intent.productId === productId,
  );
  const hasOrder = data.personalOrders.some(
    (order) => order.sourceProductId === productId,
  );

  return {
    hasIntent,
    hasOrder,
    hasBusinessRecords: hasIntent || hasOrder,
  };
}

export class PlatformService {
  constructor(
    private readonly repository: PlatformRepository,
    private readonly dependencies: PlatformServiceDependencies =
      defaultDependencies,
  ) {}

  createOperatorAccount(
    input: CreateOperatorAccountInput,
  ): OperatorAccount {
    const username = input.username.trim().toLowerCase();
    assert(username, "用户名不能为空");
    assert(input.password.length >= 6, "初始密码至少需要 6 位");
    assert(input.displayName.trim(), "显示姓名不能为空");

    return this.repository.update((data) => {
      const actor = getActiveOperatorAccount(data, input.actorAccountId);
      assert(actor.role === "leader", "只有领导账号可以管理运营账号");
      assert(
        !data.operatorAccounts.some(
          (account) => account.username.toLowerCase() === username,
        ),
        `用户名已存在：${username}`,
      );

      const now = this.dependencies.now();
      const account: OperatorAccount = {
        id: this.dependencies.nextId("operator-account"),
        username,
        password: input.password,
        displayName: input.displayName.trim(),
        role: input.role,
        status: "active",
        pagePermissions: normalizePermissions(
          input.role,
          input.pagePermissions,
        ),
        createdAt: now,
        updatedAt: now,
      };
      data.operatorAccounts.push(account);
      return account;
    });
  }

  updateOperatorAccount(
    input: UpdateOperatorAccountInput,
  ): OperatorAccount {
    assert(input.displayName.trim(), "显示姓名不能为空");
    assert(
      input.newPassword === undefined || input.newPassword.length >= 6,
      "新密码至少需要 6 位",
    );

    return this.repository.update((data) => {
      const actor = getActiveOperatorAccount(data, input.actorAccountId);
      assert(actor.role === "leader", "只有领导账号可以管理运营账号");

      const account = getOperatorAccount(data, input.accountId);
      assert(
        account.id !== actor.id || input.status === "active",
        "当前登录账号不能停用自己",
      );

      account.displayName = input.displayName.trim();
      account.role = input.role;
      account.status = input.status;
      account.pagePermissions = normalizePermissions(
        input.role,
        input.pagePermissions,
      );
      account.updatedAt = this.dependencies.now();

      if (input.newPassword) {
        account.password = input.newPassword;
      }

      return account;
    });
  }

  createGroup(input: CreateGroupInput): Group {
    assert(input.name.trim(), "集团名称不能为空");

    return this.repository.update((data) => {
      assert(
        !data.groups.some(({ name }) => name === input.name.trim()),
        `集团名称已存在：${input.name}`,
      );

      const group: Group = {
        id: this.dependencies.nextId("group"),
        name: input.name.trim(),
        contactName: input.contactName.trim(),
        contactPhone: input.contactPhone.trim(),
        cooperationStartDate: input.cooperationStartDate,
        status: input.status ?? "active",
        createdAt: this.dependencies.now(),
        ...(input.cooperationEndDate
          ? { cooperationEndDate: input.cooperationEndDate }
          : {}),
        ...(input.note ? { note: input.note } : {}),
      };

      data.groups.push(group);
      return group;
    });
  }

  updateGroup(input: UpdateGroupInput): Group {
    assert(input.name.trim(), "集团名称不能为空");
    assert(input.contactName.trim(), "联系人不能为空");
    assert(input.contactPhone.trim(), "联系电话不能为空");

    return this.repository.update((data) => {
      const group = data.groups.find(({ id }) => id === input.groupId);
      assert(group, `集团不存在：${input.groupId}`);
      assert(
        !data.groups.some(
          ({ id, name }) =>
            id !== input.groupId && name === input.name.trim(),
        ),
        `集团名称已存在：${input.name}`,
      );

      group.name = input.name.trim();
      group.contactName = input.contactName.trim();
      group.contactPhone = input.contactPhone.trim();
      group.cooperationStartDate = input.cooperationStartDate;
      group.status = input.status;

      if (input.cooperationEndDate) {
        group.cooperationEndDate = input.cooperationEndDate;
      } else {
        delete group.cooperationEndDate;
      }

      if (input.note?.trim()) {
        group.note = input.note.trim();
      } else {
        delete group.note;
      }

      return group;
    });
  }

  deleteGroup(groupId: string): {
    groupId: string;
    deletedEmployees: number;
    deletedOrders: number;
  } {
    return this.repository.update((data) => {
      const group = data.groups.find(({ id }) => id === groupId);
      assert(group, `集团不存在：${groupId}`);

      const employeeIds = new Set(
        data.employees
          .filter((employee) => employee.groupId === groupId)
          .map(({ id }) => id),
      );
      const orderIds = new Set(
        data.personalOrders
          .filter(
            (order) =>
              order.groupId === groupId || employeeIds.has(order.employeeId),
          )
          .map(({ id }) => id),
      );

      const deletedEmployees = employeeIds.size;
      const deletedOrders = orderIds.size;

      data.groups = data.groups.filter(({ id }) => id !== groupId);
      data.employees = data.employees.filter(
        ({ id }) => !employeeIds.has(id),
      );
      data.quotaAccounts = data.quotaAccounts.filter(
        ({ employeeId }) => !employeeIds.has(employeeId),
      );
      data.personalIntents = data.personalIntents.filter(
        ({ employeeId }) => !employeeIds.has(employeeId),
      );
      data.personalOrders = data.personalOrders.filter(
        ({ id }) => !orderIds.has(id),
      );
      data.serviceReviews = data.serviceReviews.filter(
        ({ orderId, employeeId }) =>
          !orderIds.has(orderId) && !employeeIds.has(employeeId),
      );
      data.quotaTransactions = data.quotaTransactions.filter(
        ({ employeeId, relatedOrderId }) =>
          !employeeIds.has(employeeId) &&
          (!relatedOrderId || !orderIds.has(relatedOrderId)),
      );

      for (const product of data.serviceProducts) {
        if (product.visibility.scope === "specified_groups") {
          product.visibility.groupIds =
            product.visibility.groupIds.filter((id) => id !== groupId);

          if (product.visibility.groupIds.length === 0) {
            product.status = "draft";
          }
        }
      }

      return { groupId, deletedEmployees, deletedOrders };
    });
  }

  createEmployee(input: CreateEmployeeInput): Employee {
    assert(input.name.trim(), "员工姓名不能为空");
    assert(input.phone.trim(), "员工手机号不能为空");
    assert(input.password.length >= 6, "初始密码至少需要 6 位");

    return this.repository.update((data) => {
      assert(
        data.groups.some(({ id }) => id === input.groupId),
        `员工所属集团不存在：${input.groupId}`,
      );
      assert(
        !data.employees.some(({ phone }) => phone === input.phone.trim()),
        `员工手机号已存在：${input.phone}`,
      );

      const now = this.dependencies.now();
      const employee: Employee = {
        id: this.dependencies.nextId("employee"),
        name: input.name.trim(),
        phone: input.phone.trim(),
        password: input.password,
        groupId: input.groupId,
        status: "active",
        createdAt: now,
        ...(input.department ? { department: input.department } : {}),
        ...(input.employeeNumber
          ? { employeeNumber: input.employeeNumber }
          : {}),
        ...(input.position ? { position: input.position } : {}),
        ...(input.note ? { note: input.note } : {}),
      };

      data.employees.push(employee);
      data.quotaAccounts.push({
        id: this.dependencies.nextId("quota-account"),
        employeeId: employee.id,
        totalGranted: 0,
        totalDeducted: 0,
        totalRefunded: 0,
        totalAdjusted: 0,
        availableBalance: 0,
        updatedAt: now,
      });

      return employee;
    });
  }

  createEmployeesBatch(input: CreateEmployeesBatchInput): Employee[] {
    assert(input.employees.length > 0, "导入文件中没有员工数据");

    return this.repository.update((data) => {
      assert(
        data.groups.some(({ id }) => id === input.groupId),
        `员工所属集团不存在：${input.groupId}`,
      );

      const normalizedEmployees = input.employees.map((employee, index) => {
        const name = employee.name.trim();
        const phone = employee.phone.trim();
        const password = employee.password || "123456";
        assert(name, `第 ${index + 1} 行员工姓名不能为空`);
        assert(phone, `第 ${index + 1} 行手机号不能为空`);
        assert(password.length >= 6, `第 ${index + 1} 行初始密码至少需要 6 位`);
        return {
          name,
          phone,
          password,
          ...(employee.department?.trim()
            ? { department: employee.department.trim() }
            : {}),
          ...(employee.employeeNumber?.trim()
            ? { employeeNumber: employee.employeeNumber.trim() }
            : {}),
        };
      });
      const phones = normalizedEmployees.map(({ phone }) => phone);

      assert(
        new Set(phones).size === phones.length,
        "导入文件中存在重复手机号",
      );
      for (const phone of phones) {
        assert(
          !data.employees.some((employee) => employee.phone === phone),
          `员工手机号已存在：${phone}`,
        );
      }

      const now = this.dependencies.now();
      const createdEmployees = normalizedEmployees.map((inputEmployee) => {
        const employee: Employee = {
          id: this.dependencies.nextId("employee"),
          name: inputEmployee.name,
          phone: inputEmployee.phone,
          password: inputEmployee.password,
          groupId: input.groupId,
          status: "active",
          createdAt: now,
          ...(inputEmployee.department
            ? { department: inputEmployee.department }
            : {}),
          ...(inputEmployee.employeeNumber
            ? { employeeNumber: inputEmployee.employeeNumber }
            : {}),
        };

        data.employees.push(employee);
        data.quotaAccounts.push({
          id: this.dependencies.nextId("quota-account"),
          employeeId: employee.id,
          totalGranted: 0,
          totalDeducted: 0,
          totalRefunded: 0,
          totalAdjusted: 0,
          availableBalance: 0,
          updatedAt: now,
        });

        return employee;
      });

      return createdEmployees;
    });
  }

  updateEmployee(input: UpdateEmployeeInput): Employee {
    return this.repository.update((data) => {
      const employee = getEmployee(data, input.employeeId);
      assert(
        data.groups.some(({ id }) => id === input.groupId),
        `员工所属集团不存在：${input.groupId}`,
      );

      employee.groupId = input.groupId;
      employee.status = input.status;

      const optionalFields = [
        ["department", input.department],
        ["employeeNumber", input.employeeNumber],
        ["position", input.position],
        ["note", input.note],
      ] as const;

      for (const [field, value] of optionalFields) {
        if (value?.trim()) {
          employee[field] = value.trim();
        } else {
          delete employee[field];
        }
      }

      return employee;
    });
  }

  authenticateEmployee(input: AuthenticateEmployeeInput): Employee {
    const phone = input.phone.trim();
    const employee = this.repository
      .getSnapshot()
      .employees.find((candidate) => candidate.phone === phone);

    assert(employee && employee.password === input.password, "手机号或密码错误");
    assert(employee.status === "active", "该员工账号已停用");
    return employee;
  }

  deleteEmployee(employeeId: string): Employee {
    return this.repository.update((data) => {
      const employee = getEmployee(data, employeeId);
      assert(
        !data.personalOrders.some(
          (order) => order.employeeId === employeeId,
        ),
        "该员工已有订单，一期不允许删除",
      );

      data.employees = data.employees.filter(({ id }) => id !== employeeId);
      data.quotaAccounts = data.quotaAccounts.filter(
        (account) => account.employeeId !== employeeId,
      );
      data.personalIntents = data.personalIntents.filter(
        (intent) => intent.employeeId !== employeeId,
      );
      data.quotaTransactions = data.quotaTransactions.filter(
        (transaction) => transaction.employeeId !== employeeId,
      );

      return employee;
    });
  }

  grantQuota(input: GrantQuotaInput): QuotaTransaction {
    assertPositiveAmount(input.amount, "发放额度");
    assert(input.reason.trim(), "发放原因不能为空");

    return this.repository.update((data) => {
      const employee = getEmployee(data, input.employeeId);
      assert(employee.status === "active", "停用员工不能发放额度");

      const account = data.quotaAccounts.find(
        ({ employeeId }) => employeeId === employee.id,
      );
      assert(account, `员工缺少额度账户：${employee.id}`);

      const now = this.dependencies.now();
      account.totalGranted += input.amount;
      account.availableBalance += input.amount;
      account.updatedAt = now;

      const transaction: QuotaTransaction = {
        id: this.dependencies.nextId("quota-transaction"),
        employeeId: employee.id,
        type: "grant",
        amount: input.amount,
        balanceAfter: account.availableBalance,
        reason: input.reason.trim(),
        operator: input.operator,
        occurredAt: now,
      };

      data.quotaTransactions.push(transaction);
      return transaction;
    });
  }

  grantQuotaBatch(input: GrantQuotaBatchInput): QuotaTransaction[] {
    assert(input.employeeIds.length > 0, "请至少选择一名员工");
    assertPositiveAmount(input.amount, "发放额度");
    assert(input.reason.trim(), "发放原因不能为空");
    assert(
      new Set(input.employeeIds).size === input.employeeIds.length,
      "批量发放名单中存在重复员工",
    );

    return this.repository.update((data) => {
      const employees = input.employeeIds.map((employeeId) =>
        getEmployee(data, employeeId),
      );
      assert(
        new Set(employees.map(({ groupId }) => groupId)).size === 1,
        "批量额度管理仅支持同一集团员工",
      );
      assert(
        employees.every(({ status }) => status === "active"),
        "停用员工不能发放额度",
      );

      const now = this.dependencies.now();
      return employees.map((employee) => {
        const account = data.quotaAccounts.find(
          ({ employeeId }) => employeeId === employee.id,
        );
        assert(account, `员工缺少额度账户：${employee.id}`);

        account.totalGranted += input.amount;
        account.availableBalance += input.amount;
        account.updatedAt = now;

        const transaction: QuotaTransaction = {
          id: this.dependencies.nextId("quota-transaction"),
          employeeId: employee.id,
          type: "grant",
          amount: input.amount,
          balanceAfter: account.availableBalance,
          reason: input.reason.trim(),
          operator: input.operator,
          occurredAt: now,
        };
        data.quotaTransactions.push(transaction);
        return transaction;
      });
    });
  }

  adjustQuota(input: AdjustQuotaInput): QuotaTransaction {
    assert(
      Number.isFinite(input.amount) && input.amount !== 0,
      "调整额度不能为 0",
    );
    assert(input.reason.trim(), "调整原因不能为空");

    return this.repository.update((data) => {
      const employee = getEmployee(data, input.employeeId);
      assert(employee.status === "active", "停用员工不能调整额度");

      const account = data.quotaAccounts.find(
        ({ employeeId }) => employeeId === employee.id,
      );
      assert(account, `员工缺少额度账户：${employee.id}`);
      assert(
        account.availableBalance + input.amount >= 0,
        "调减后可用额度不能小于 0",
      );

      const now = this.dependencies.now();
      account.totalAdjusted += input.amount;
      account.availableBalance += input.amount;
      account.updatedAt = now;

      const transaction: QuotaTransaction = {
        id: this.dependencies.nextId("quota-transaction"),
        employeeId: employee.id,
        type: "adjustment",
        amount: input.amount,
        balanceAfter: account.availableBalance,
        reason: input.reason.trim(),
        operator: input.operator,
        occurredAt: now,
      };

      data.quotaTransactions.push(transaction);
      return transaction;
    });
  }

  refundPersonalOrderQuota(
    input: RefundPersonalOrderQuotaInput,
  ): QuotaTransaction {
    assertPositiveAmount(input.amount, "退回额度");
    assert(input.reason.trim(), "退回原因不能为空");

    return this.repository.update((data) => {
      const order = data.personalOrders.find(
        ({ id }) => id === input.orderId,
      );
      assert(order, `个人订单不存在：${input.orderId}`);
      assert(order.deductedQuota > 0, "该订单尚未扣减额度，不能办理退回");

      const refundableQuota = order.deductedQuota - order.refundedQuota;
      assert(refundableQuota > 0, "该订单额度已全部退回");
      assert(input.amount <= refundableQuota, "退回额度不能超过订单剩余可退额度");

      const account = data.quotaAccounts.find(
        ({ employeeId }) => employeeId === order.employeeId,
      );
      assert(account, `员工缺少额度账户：${order.employeeId}`);

      const now = this.dependencies.now();
      account.totalRefunded += input.amount;
      account.availableBalance += input.amount;
      account.updatedAt = now;

      order.refundedQuota += input.amount;
      order.finalConsumedQuota =
        order.deductedQuota - order.refundedQuota;
      order.updatedAt = now;

      const transaction: QuotaTransaction = {
        id: this.dependencies.nextId("quota-transaction"),
        employeeId: order.employeeId,
        type: "refund",
        amount: input.amount,
        balanceAfter: account.availableBalance,
        relatedOrderId: order.id,
        reason: input.reason.trim(),
        operator: input.operator,
        occurredAt: now,
        ...(input.internalNote?.trim()
          ? { internalNote: input.internalNote.trim() }
          : {}),
      };

      data.quotaTransactions.push(transaction);
      return transaction;
    });
  }

  createServiceProduct(input: CreateServiceProductInput): ServiceProduct {
      assertProductContent(input);
      const hotelDetails = normalizeHotelDetails(input.hotelDetails);

    return this.repository.update((data) => {
      assert(
        !data.serviceProducts.some(({ name }) => name === input.name.trim()),
        `商品名称已存在：${input.name}`,
      );

      if (input.visibility.scope === "specified_groups") {
        assert(
          input.visibility.groupIds.length > 0,
          "指定集团可见时至少需要选择一个集团",
        );

        for (const groupId of input.visibility.groupIds) {
          assert(
            data.groups.some(({ id }) => id === groupId),
            `商品可见集团不存在：${groupId}`,
          );
        }
      }

      const now = this.dependencies.now();
      const product: ServiceProduct = {
        id: this.dependencies.nextId("service-product"),
        name: input.name.trim(),
        type: input.type,
        summary: input.summary.trim(),
        coverImage: input.coverImage.trim(),
        serviceDescription: input.serviceDescription.trim(),
        notes: input.notes.trim(),
        visibility: structuredClone(input.visibility),
        status: "draft",
        createdAt: now,
        updatedAt: now,
        ...(input.gallery ? { gallery: structuredClone(input.gallery) } : {}),
        ...(input.quotaReference
          ? { quotaReference: structuredClone(input.quotaReference) }
          : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
        ...(input.recommended !== undefined
          ? { recommended: input.recommended }
          : {}),
        ...(input.travelDetails
          ? { travelDetails: structuredClone(input.travelDetails) }
          : {}),
        ...(hotelDetails
          ? { hotelDetails: structuredClone(hotelDetails) }
          : {}),
        ...(input.linkedHotelProductIds
          ? { linkedHotelProductIds: [...input.linkedHotelProductIds] }
          : {}),
      };

      data.serviceProducts.push(product);
      return product;
    });
  }

  getServiceProductUsage(productId: string): ServiceProductUsage {
    const data = this.repository.getSnapshot();
    assert(
      data.serviceProducts.some(({ id }) => id === productId),
      `服务商品不存在：${productId}`,
    );
    return getProductUsage(data, productId);
  }

  updateServiceProduct(input: UpdateServiceProductInput): ServiceProduct {
      assertProductContent(input);
      const hotelDetails = normalizeHotelDetails(input.hotelDetails);

    return this.repository.update((data) => {
      const product = data.serviceProducts.find(
        ({ id }) => id === input.productId,
      );
      assert(product, `服务商品不存在：${input.productId}`);
      assert(product.status === "draft", "已上架商品不能编辑，请先下架");
      assert(
        !data.serviceProducts.some(
          ({ id, name }) =>
            id !== product.id && name === input.name.trim(),
        ),
        `商品名称已存在：${input.name}`,
      );

      if (input.visibility.scope === "specified_groups") {
        assert(
          input.visibility.groupIds.length > 0,
          "指定集团可见时至少需要选择一个集团",
        );
        for (const groupId of input.visibility.groupIds) {
          assert(
            data.groups.some(({ id }) => id === groupId),
            `商品可见集团不存在：${groupId}`,
          );
        }
      }

      const usage = getProductUsage(data, product.id);
      if (usage.hasBusinessRecords) {
        const currentTravel = product.travelDetails;
        const nextTravel = input.travelDetails;
        assert(product.name === input.name.trim(), "已有业务记录，商品名称不可修改");
        assert(product.type === input.type, "已有业务记录，商品类型不可修改");
        assert(
          JSON.stringify(product.quotaReference) ===
            JSON.stringify(input.quotaReference),
          "已有业务记录，额度参考不可修改",
        );
        assert(
          isSameVisibility(product.visibility, input.visibility),
          "已有业务记录，可见范围不可修改",
        );
        assert(
          currentTravel?.destination === nextTravel?.destination,
          "已有业务记录，目的地不可修改",
        );
        assert(
          currentTravel?.recommendedStayDays ===
            nextTravel?.recommendedStayDays,
          "已有业务记录，建议停留天数不可修改",
        );
        assert(
          JSON.stringify(currentTravel?.suitableTravelMonths) ===
            JSON.stringify(nextTravel?.suitableTravelMonths),
          "已有业务记录，适宜月份不可修改",
        );
        assert(
          JSON.stringify(currentTravel?.transportOptions) ===
            JSON.stringify(nextTravel?.transportOptions) &&
            currentTravel?.accommodation === nextTravel?.accommodation &&
            currentTravel?.dining === nextTravel?.dining &&
            currentTravel?.pickupService === nextTravel?.pickupService,
          "已有业务记录，旅游服务配置不可修改",
        );
        assert(
          JSON.stringify(hotelDetailsWithoutPaidServices(product.hotelDetails)) ===
            JSON.stringify(hotelDetailsWithoutPaidServices(hotelDetails)),
          "已有业务记录，酒店基础配置不可修改",
        );
        assert(
          product.sortOrder === input.sortOrder,
          "已有业务记录，商品排序不可修改",
        );
        assert(
          product.recommended === input.recommended,
          "已有业务记录，推荐设置不可修改",
        );

        const changedDescriptionFields =
          product.serviceDescription !== input.serviceDescription.trim() ||
          product.notes !== input.notes.trim() ||
          currentTravel?.serviceScope !== nextTravel?.serviceScope;
        assert(
          !changedDescriptionFields || input.confirmDescriptionChanges,
          "说明类字段发生变化，需要二次确认",
        );
      }

      product.name = input.name.trim();
      product.type = input.type;
      product.summary = input.summary.trim();
      product.coverImage = input.coverImage.trim();
      product.serviceDescription = input.serviceDescription.trim();
      product.notes = input.notes.trim();
      product.visibility = structuredClone(input.visibility);
      product.updatedAt = this.dependencies.now();

      if (input.gallery) {
        product.gallery = structuredClone(input.gallery);
      } else {
        delete product.gallery;
      }
      if (input.quotaReference) {
        product.quotaReference = structuredClone(input.quotaReference);
      } else {
        delete product.quotaReference;
      }
      if (input.travelDetails) {
        product.travelDetails = structuredClone(input.travelDetails);
      } else {
        delete product.travelDetails;
      }
      if (hotelDetails) {
        product.hotelDetails = structuredClone(hotelDetails);
      } else {
        delete product.hotelDetails;
      }
      if (input.linkedHotelProductIds) {
        product.linkedHotelProductIds = [...input.linkedHotelProductIds];
      } else {
        delete product.linkedHotelProductIds;
      }
      if (input.sortOrder !== undefined) {
        product.sortOrder = input.sortOrder;
      } else {
        delete product.sortOrder;
      }
      if (input.recommended !== undefined) {
        product.recommended = input.recommended;
      } else {
        delete product.recommended;
      }

      return product;
    });
  }

  deleteServiceProduct(productId: string): { productId: string } {
    return this.repository.update((data) => {
      const product = data.serviceProducts.find(({ id }) => id === productId);
      assert(product, `服务商品不存在：${productId}`);
      assert(product.status === "draft", "已上架商品不能删除，请先下架");

      const usage = getProductUsage(data, productId);
      assert(
        !usage.hasIntent,
        "该商品已产生意向记录，不能删除，只能下架",
      );
      assert(
        !usage.hasOrder,
        "该商品已产生订单记录，不能删除，只能下架",
      );

      // 团体项目模块接入后，应在此处继续检查商品与团体项目的关联。
      data.serviceProducts = data.serviceProducts.filter(
        ({ id }) => id !== productId,
      );
      return { productId };
    });
  }

  publishServiceProduct(productId: string): ServiceProduct {
    return this.repository.update((data) => {
      const product = data.serviceProducts.find(({ id }) => id === productId);
      assert(product, `服务商品不存在：${productId}`);
      assert(product.status === "draft", "只有未上架商品可以上架");

      product.status = "published";
      product.updatedAt = this.dependencies.now();
      return product;
    });
  }

  unpublishServiceProduct(productId: string): ServiceProduct {
    return this.repository.update((data) => {
      const product = data.serviceProducts.find(({ id }) => id === productId);
      assert(product, `服务商品不存在：${productId}`);
      assert(product.status === "published", "只有已上架商品可以下架");

      product.status = "draft";
      product.updatedAt = this.dependencies.now();
      return product;
    });
  }

  submitPersonalIntent(input: SubmitPersonalIntentInput): PersonalIntent {
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(input.expectedTravelDate),
      "预计出行日期必须使用 YYYY-MM-DD 格式",
    );
    assert(
      input.expectedTravelDate >= getShanghaiDate(this.dependencies.now()),
      "预计出行日期不能早于今天",
    );
    assert(
      Number.isInteger(input.expectedStayDays) && input.expectedStayDays > 0,
      "期望停留天数必须是大于 0 的整数",
    );
    assert(
      input.companionCount === undefined ||
        (Number.isInteger(input.companionCount) &&
          input.companionCount >= 0),
      "预计同行人数不能小于 0",
    );

    return this.repository.update((data) => {
      const employee = getEmployee(data, input.employeeId);
      assert(employee.status === "active", "停用员工不能提交意向");

      const account = data.quotaAccounts.find(
        ({ employeeId }) => employeeId === employee.id,
      );
      assert(
        account && account.availableBalance > 0,
        "员工当前不具备有效额度资格",
      );

      const product = data.serviceProducts.find(
        ({ id }) => id === input.productId,
      );
      assert(product, `服务商品不存在：${input.productId}`);
      assert(product.status === "published", "未上架商品不能提交意向");
      assert(
        product.visibility.scope === "all_groups" ||
          product.visibility.groupIds.includes(employee.groupId),
        "该服务商品对员工所属集团不可见",
      );

      const activeIntentCount = data.personalIntents.filter(
        ({ employeeId, status }) =>
          employeeId === employee.id &&
          ["pending_follow_up", "communicating"].includes(status),
      ).length;
      assert(activeIntentCount < 2, "每名员工最多同时保留 2 个有效意向");

      const travelMonths = product.travelDetails?.suitableTravelMonths;
      if (travelMonths) {
        const month = Number(input.expectedTravelDate.slice(5, 7));
        assert(
          travelMonths.includes(month),
          "预计出行时间不在商品适宜出行月份内",
        );
      }

      const now = this.dependencies.now();
      const intent: PersonalIntent = {
        id: this.dependencies.nextId("personal-intent"),
        employeeId: employee.id,
        productId: product.id,
        expectedTravelDate: input.expectedTravelDate,
        expectedStayDays: input.expectedStayDays,
        status: "pending_follow_up",
        createdAt: now,
        updatedAt: now,
        ...(input.companionCount !== undefined
          ? { companionCount: input.companionCount }
          : {}),
        ...(input.preferredTransport
          ? { preferredTransport: input.preferredTransport }
          : {}),
        ...(input.needsPickup !== undefined
          ? { needsPickup: input.needsPickup }
          : {}),
        ...(input.accommodationPreference
          ? { accommodationPreference: input.accommodationPreference }
          : {}),
        ...(input.preferredHotelProductId
          ? { preferredHotelProductId: input.preferredHotelProductId }
          : {}),
        ...(input.preferredHotelRoomTypeId
          ? { preferredHotelRoomTypeId: input.preferredHotelRoomTypeId }
          : {}),
        ...(input.additionalNotes
          ? { additionalNotes: input.additionalNotes }
          : {}),
        ...(input.convenientContactTime
          ? { convenientContactTime: input.convenientContactTime }
          : {}),
      };

      data.personalIntents.push(intent);
      return intent;
    });
  }

  withdrawPersonalIntent(input: WithdrawPersonalIntentInput): PersonalIntent {
    return this.repository.update((data) => {
      getEmployee(data, input.employeeId);
      const intent = data.personalIntents.find(
        ({ id }) => id === input.intentId,
      );
      assert(intent, `个人意向不存在：${input.intentId}`);
      assert(intent.employeeId === input.employeeId, "只能撤销本人的意向");
      assert(
        ["pending_follow_up", "communicating"].includes(intent.status),
        "只有待跟进或沟通中的意向可以撤销",
      );

      intent.status = "withdrawn_by_employee";
      intent.updatedAt = this.dependencies.now();
      return intent;
    });
  }

  updateIntentFollowUp(input: UpdateIntentFollowUpInput): PersonalIntent {
    assert(input.assigneeAccountId, "跟进人不能为空");
    return this.repository.update((data) => {
      getActiveOperatorAccount(data, input.assigneeAccountId);
      const intent = data.personalIntents.find(
        ({ id }) => id === input.intentId,
      );
      assert(intent, `个人意向不存在：${input.intentId}`);
      assert(
        ["pending_follow_up", "communicating"].includes(intent.status),
        "已结束或已转订单的意向不能继续跟进",
      );

      intent.status = input.status;
      intent.updatedAt = this.dependencies.now();
      intent.assigneeAccountId = input.assigneeAccountId;

      if (input.internalNote !== undefined) {
        assert(input.internalNote.trim(), "内部备注不能为空");
        intent.internalNote = input.internalNote.trim();
      }

      return intent;
    });
  }

  closePersonalIntent(input: ClosePersonalIntentInput): PersonalIntent {
    assert(input.assigneeAccountId, "跟进人不能为空");
    return this.repository.update((data) => {
      getActiveOperatorAccount(data, input.assigneeAccountId);
      const intent = data.personalIntents.find(
        ({ id }) => id === input.intentId,
      );
      assert(intent, `个人意向不存在：${input.intentId}`);
      assert(
        ["pending_follow_up", "communicating"].includes(intent.status),
        "只有待跟进或沟通中的意向可以关闭",
      );

      intent.status = "closed";
      intent.assigneeAccountId = input.assigneeAccountId;
      intent.updatedAt = this.dependencies.now();

      if (input.internalNote !== undefined) {
        assert(input.internalNote.trim(), "关闭备注不能为空");
        intent.internalNote = input.internalNote.trim();
      }

      return intent;
    });
  }

  convertIntentToPendingOrder(
    input: ConvertIntentToOrderInput,
  ): PersonalOrder {
    assertPositiveAmount(input.plannedQuotaDeduction, "计划扣减额度");
    assert(input.servicePlan.trim(), "订单专属方案不能为空");
    assert(input.assigneeAccountId, "跟进人不能为空");
    assertTravelDateRange(input.departureDate, input.returnDate);

    return this.repository.update((data) => {
      getActiveOperatorAccount(data, input.assigneeAccountId);
      const intent = data.personalIntents.find(
        ({ id }) => id === input.intentId,
      );
      assert(intent, `个人意向不存在：${input.intentId}`);
      assert(
        ["pending_follow_up", "communicating"].includes(intent.status),
        "只有待跟进或沟通中的意向可以转订单",
      );
      assert(
        !data.personalOrders.some(
          ({ sourceIntentId }) => sourceIntentId === intent.id,
        ),
        "该意向已经生成订单",
      );

      const employee = getEmployee(data, intent.employeeId);
      assert(employee.status === "active", "停用员工的意向不能转订单");

      const product = data.serviceProducts.find(
        ({ id }) => id === intent.productId,
      );
      assert(product, `意向关联的服务商品不存在：${intent.productId}`);
      assert(product.status === "published", "未上架商品不能转订单");
      assert(
        product.visibility.scope === "all_groups" ||
          product.visibility.groupIds.includes(employee.groupId),
        "该服务商品对员工所属集团不可见",
      );

      const now = this.dependencies.now();
      const order: PersonalOrder = {
        id: this.dependencies.nextId("personal-order"),
        orderNumber:
          this.dependencies.nextOrderNumber?.() ??
          this.dependencies.nextId("order-number"),
        sourceIntentId: intent.id,
        sourceProductId: product.id,
        employeeId: employee.id,
        groupId: employee.groupId,
        productSnapshot: createOrderProductSnapshot(product),
        servicePlan: input.servicePlan.trim(),
        plannedQuotaDeduction: input.plannedQuotaDeduction,
        deductedQuota: 0,
        refundedQuota: 0,
        finalConsumedQuota: 0,
        status: "pending_confirmation",
        assigneeAccountId: input.assigneeAccountId,
        createdAt: now,
        updatedAt: now,
        ...(input.departureDate
          ? { departureDate: input.departureDate }
          : {}),
        ...(input.returnDate
          ? { returnDate: input.returnDate }
          : {}),
        ...(input.transport ? { transport: input.transport } : {}),
        ...(input.accommodation
          ? { accommodation: input.accommodation }
          : {}),
        ...(input.hotelAccommodation
          ? {
              hotelAccommodation: {
                hotelProductId: input.hotelAccommodation.hotelProductId,
                hotelName: "待确认酒店",
                ...(input.hotelAccommodation.roomTypeId
                  ? { roomTypeId: input.hotelAccommodation.roomTypeId }
                  : {}),
                checkInDate: input.hotelAccommodation.checkInDate,
                checkOutDate: input.hotelAccommodation.checkOutDate,
                nights: 1,
                ...(input.hotelAccommodation.note
                  ? { note: input.hotelAccommodation.note }
                  : {}),
              },
            }
          : {}),
        ...(input.pickupService
          ? { pickupService: input.pickupService }
          : {}),
        ...(input.internalNote ? { internalNote: input.internalNote } : {}),
      };

      intent.status = "converted_to_order";
      intent.assigneeAccountId = input.assigneeAccountId;
      intent.updatedAt = now;
      data.personalOrders.push(order);

      return order;
    });
  }

  updatePendingPersonalOrder(
    input: UpdatePendingOrderInput,
  ): PersonalOrder {
    return this.repository.update((data) => {
      const order = data.personalOrders.find(({ id }) => id === input.orderId);
      assert(order, `个人订单不存在：${input.orderId}`);
      assert(
        order.status === "pending_confirmation",
        "只有待确认订单可以调整内容",
      );

      if (input.plannedQuotaDeduction !== undefined) {
        assertPositiveAmount(input.plannedQuotaDeduction, "计划扣减额度");
        order.plannedQuotaDeduction = input.plannedQuotaDeduction;
      }

      if (input.servicePlan !== undefined) {
        assert(input.servicePlan.trim(), "订单专属方案不能为空");
        order.servicePlan = input.servicePlan.trim();
      }

      if (
        input.departureDate !== undefined ||
        input.returnDate !== undefined
      ) {
        const departureDate = input.departureDate ?? order.departureDate;
        const returnDate = input.returnDate ?? order.returnDate;
        assertTravelDateRange(departureDate, returnDate);
        assert(departureDate && returnDate, "出行日期和返程日期必须同时填写");
        order.departureDate = departureDate;
        order.returnDate = returnDate;
      }

      if (input.transport !== undefined) {
        order.transport = input.transport.trim();
      }
      if (input.accommodation !== undefined) {
        order.accommodation = input.accommodation.trim();
      }
      if (input.hotelAccommodation !== undefined) {
        if (input.hotelAccommodation) {
          order.hotelAccommodation = {
            hotelProductId: input.hotelAccommodation.hotelProductId,
            hotelName: "待确认酒店",
            ...(input.hotelAccommodation.roomTypeId
              ? { roomTypeId: input.hotelAccommodation.roomTypeId }
              : {}),
            checkInDate: input.hotelAccommodation.checkInDate,
            checkOutDate: input.hotelAccommodation.checkOutDate,
            nights: 1,
            ...(input.hotelAccommodation.note
              ? { note: input.hotelAccommodation.note }
              : {}),
          };
        } else {
          delete order.hotelAccommodation;
        }
      }
      if (input.pickupService !== undefined) {
        order.pickupService = input.pickupService.trim();
      }
      if (input.internalNote !== undefined) {
        order.internalNote = input.internalNote.trim();
      }

      order.updatedAt = this.dependencies.now();
      return order;
    });
  }

  assignPersonalOrder(input: AssignPersonalOrderInput): PersonalOrder {
    assert(input.assigneeAccountId, "订单负责人不能为空");

    return this.repository.update((data) => {
      getActiveOperatorAccount(data, input.assigneeAccountId);
      const order = data.personalOrders.find(({ id }) => id === input.orderId);
      assert(order, `个人订单不存在：${input.orderId}`);

      order.assigneeAccountId = input.assigneeAccountId;
      order.updatedAt = this.dependencies.now();
      return order;
    });
  }

  updatePersonalOrderTravelDates(
    input: UpdatePersonalOrderTravelDatesInput,
  ): PersonalOrder {
    assertTravelDateRange(input.departureDate, input.returnDate, true);

    return this.repository.update((data) => {
      const order = data.personalOrders.find(({ id }) => id === input.orderId);
      assert(order, `个人订单不存在：${input.orderId}`);
      assert(
        ["pending_confirmation", "confirmed", "waiting_for_service"].includes(
          order.status,
        ),
        "只有待确认、已确认或待出行订单可以调整出行日期",
      );

      const now = this.dependencies.now();
      order.departureDate = input.departureDate;
      order.returnDate = input.returnDate;
      if (order.status !== "pending_confirmation") {
        order.status = getAutomaticOrderStatus(
          now,
          input.departureDate,
          input.returnDate,
        );
      }
      order.updatedAt = now;
      return order;
    });
  }

  confirmPersonalOrder(input: ConfirmPersonalOrderInput): PersonalOrder {
    return this.repository.update((data) => {
      const order = data.personalOrders.find(({ id }) => id === input.orderId);
      assert(order, `个人订单不存在：${input.orderId}`);
      assert(
        order.status === "pending_confirmation",
        "只有待确认订单可以确认",
      );
      assertTravelDateRange(order.departureDate, order.returnDate, true);
      assert(
        order.departureDate && order.returnDate,
        "确认订单前必须填写出行日期和返程日期",
      );

      const employee = getEmployee(data, order.employeeId);
      assert(employee.status === "active", "停用员工的订单不能确认");

      const account = data.quotaAccounts.find(
        ({ employeeId }) => employeeId === employee.id,
      );
      assert(account, `员工缺少额度账户：${employee.id}`);
      assert(
        account.availableBalance >= order.plannedQuotaDeduction,
        "员工可用额度不足，不能确认订单",
      );

      const now = this.dependencies.now();
      const amount = order.plannedQuotaDeduction;

      account.totalDeducted += amount;
      account.availableBalance -= amount;
      account.updatedAt = now;

      order.deductedQuota = amount;
      order.finalConsumedQuota = amount;
      order.status = getAutomaticOrderStatus(
        now,
        order.departureDate,
        order.returnDate,
      );
      order.confirmedAt = now;
      order.updatedAt = now;

      data.quotaTransactions.push({
        id: this.dependencies.nextId("quota-transaction"),
        employeeId: employee.id,
        type: "deduction",
        amount: -amount,
        balanceAfter: account.availableBalance,
        relatedOrderId: order.id,
        reason: "个人订单确认扣减",
        operator: input.operator,
        occurredAt: now,
      });

      return order;
    });
  }

  updatePersonalOrderStatus(
    input: UpdatePersonalOrderStatusInput,
  ): PersonalOrder {
    const cancellableStatuses: OrderStatus[] = [
      "pending_confirmation",
      "confirmed",
      "waiting_for_service",
      "in_service",
    ];

    return this.repository.update((data) => {
      const order = data.personalOrders.find(({ id }) => id === input.orderId);
      assert(order, `个人订单不存在：${input.orderId}`);
      assert(
        cancellableStatuses.includes(order.status),
        "当前订单状态不允许取消",
      );

      order.status = input.status;
      order.updatedAt = this.dependencies.now();
      return order;
    });
  }

  submitPersonalOrderReview(
    input: SubmitPersonalOrderReviewInput,
  ): ServiceReview {
    assert(
      Number.isInteger(input.rating) &&
        input.rating >= 1 &&
        input.rating <= 5,
      "评价星级必须是 1 至 5 的整数",
    );
    const content = input.content.trim();
    assert(content, "评价内容不能为空");
    assert(content.length <= 500, "评价内容不能超过 500 个字符");

    return this.repository.update((data) => {
      const order = data.personalOrders.find(({ id }) => id === input.orderId);
      assert(order, `个人订单不存在：${input.orderId}`);
      assert(order.employeeId === input.employeeId, "只能评价本人的订单");
      assert(order.status === "completed", "只有已完成订单可以评价");
      assert(
        !data.serviceReviews.some(({ orderId }) => orderId === order.id),
        "该订单已经提交过评价",
      );

      const now = this.dependencies.now();
      const review: ServiceReview = {
        id: this.dependencies.nextId("service-review"),
        orderId: order.id,
        employeeId: order.employeeId,
        productId: order.sourceProductId,
        rating: input.rating,
        content,
        status: "pending_review",
        submittedAt: now,
        updatedAt: now,
      };
      data.serviceReviews.push(review);
      return review;
    });
  }

  moderateServiceReview(
    input: ModerateServiceReviewInput,
  ): ServiceReview {
    return this.repository.update((data) => {
      const actor = getActiveOperatorAccount(data, input.actorAccountId);
      assert(
        actor.role === "leader" ||
          actor.pagePermissions.includes("reviews"),
        "当前运营账号没有评价管理权限",
      );
      const review = data.serviceReviews.find(
        ({ id }) => id === input.reviewId,
      );
      assert(review, `评价不存在：${input.reviewId}`);

      const now = this.dependencies.now();
      review.status = input.status;
      review.moderatedByAccountId = actor.id;
      review.moderatedAt = now;
      review.updatedAt = now;
      return review;
    });
  }

  syncPersonalOrderStatuses(): number {
    return this.repository.update((data) => {
      const now = this.dependencies.now();
      let updatedCount = 0;

      for (const order of data.personalOrders) {
        if (
          !["confirmed", "waiting_for_service", "in_service"].includes(
            order.status,
          ) ||
          !order.departureDate ||
          !order.returnDate
        ) {
          continue;
        }

        const nextStatus = getAutomaticOrderStatus(
          now,
          order.departureDate,
          order.returnDate,
        );
        if (order.status !== nextStatus) {
          order.status = nextStatus;
          order.updatedAt = now;
          updatedCount += 1;
        }
      }

      return updatedCount;
    });
  }
}
