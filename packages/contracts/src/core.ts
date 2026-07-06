import { Type, type Static } from "@sinclair/typebox";
import type {
  Employee,
  Group,
  OperatorAccount,
  PersonalIntent,
  PersonalOrder,
  QuotaAccount,
  QuotaTransaction,
  ServiceReview,
  ServiceProduct,
} from "@travel/domain";

const DateSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
});

const OptionalTextSchema = Type.Optional(Type.String({ maxLength: 2_000 }));

export const CreateGroupRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 200 }),
    contactName: Type.String({ minLength: 1, maxLength: 100 }),
    contactPhone: Type.String({ minLength: 1, maxLength: 30 }),
    cooperationStartDate: DateSchema,
    cooperationEndDate: Type.Optional(DateSchema),
    status: Type.Optional(
      Type.Union([
        Type.Literal("active"),
        Type.Literal("paused"),
        Type.Literal("ended"),
      ]),
    ),
    note: OptionalTextSchema,
  },
  { additionalProperties: false },
);

export type CreateGroupRequest = Static<typeof CreateGroupRequestSchema>;

export const CreateEmployeeRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100 }),
    phone: Type.String({ minLength: 1, maxLength: 30 }),
    password: Type.String({ minLength: 6, maxLength: 200 }),
    groupId: Type.String({ minLength: 1 }),
    department: Type.Optional(Type.String({ maxLength: 100 })),
    employeeNumber: Type.Optional(Type.String({ maxLength: 100 })),
    position: Type.Optional(Type.String({ maxLength: 100 })),
    note: OptionalTextSchema,
  },
  { additionalProperties: false },
);

export type CreateEmployeeRequest = Static<
  typeof CreateEmployeeRequestSchema
>;

export const GrantQuotaRequestSchema = Type.Object(
  {
    employeeIds: Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      uniqueItems: true,
    }),
    amount: Type.Integer({ minimum: 1 }),
    reason: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);

export type GrantQuotaRequest = Static<typeof GrantQuotaRequestSchema>;

const ProductVisibilitySchema = Type.Object(
  {
    scope: Type.Union([
      Type.Literal("all_groups"),
      Type.Literal("specified_groups"),
    ]),
    groupIds: Type.Optional(
      Type.Array(Type.String({ minLength: 1 }), {
        minItems: 1,
        uniqueItems: true,
      }),
    ),
  },
  { additionalProperties: false },
);

const TravelProductDetailsSchema = Type.Object(
  {
    destination: Type.String({ minLength: 1, maxLength: 200 }),
    destinationHighlights: Type.String({ minLength: 1, maxLength: 5_000 }),
    suitableTravelMonths: Type.Array(
      Type.Integer({ minimum: 1, maximum: 12 }),
      { minItems: 1, uniqueItems: true },
    ),
    recommendedStayDays: Type.String({ minLength: 1, maxLength: 100 }),
    transportOptions: Type.Optional(
      Type.Array(Type.String({ minLength: 1, maxLength: 100 })),
    ),
    accommodation: OptionalTextSchema,
    dining: OptionalTextSchema,
    pickupService: OptionalTextSchema,
    serviceScope: Type.String({ minLength: 1, maxLength: 5_000 }),
  },
  { additionalProperties: false },
);

export const CreateServiceProductRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 200 }),
    type: Type.Union([
      Type.Literal("travel"),
      Type.Literal("insurance"),
      Type.Literal("medical"),
      Type.Literal("health_management"),
      Type.Literal("other"),
    ]),
    summary: Type.String({ minLength: 1, maxLength: 5_000 }),
    coverImage: Type.String({ minLength: 1, maxLength: 2_000 }),
    gallery: Type.Optional(
      Type.Array(Type.String({ minLength: 1, maxLength: 2_000 })),
    ),
    quotaReference: Type.Optional(
      Type.Object(
        {
          min: Type.Integer({ minimum: 0 }),
          max: Type.Optional(Type.Integer({ minimum: 0 })),
        },
        { additionalProperties: false },
      ),
    ),
    serviceDescription: Type.String({ minLength: 1, maxLength: 10_000 }),
    notes: Type.String({ minLength: 1, maxLength: 10_000 }),
    visibility: ProductVisibilitySchema,
    sortOrder: Type.Optional(Type.Integer()),
    recommended: Type.Optional(Type.Boolean()),
    travelDetails: Type.Optional(TravelProductDetailsSchema),
  },
  { additionalProperties: false },
);

export type CreateServiceProductRequest = Static<
  typeof CreateServiceProductRequestSchema
>;

export const SubmitPersonalIntentRequestSchema = Type.Object(
  {
    productId: Type.String({ minLength: 1 }),
    expectedTravelDate: DateSchema,
    expectedStayDays: Type.Integer({ minimum: 1, maximum: 365 }),
    companionCount: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
    preferredTransport: Type.Optional(Type.String({ maxLength: 100 })),
    needsPickup: Type.Optional(Type.Boolean()),
    accommodationPreference: Type.Optional(
      Type.String({ maxLength: 1_000 }),
    ),
    additionalNotes: OptionalTextSchema,
    convenientContactTime: Type.Optional(Type.String({ maxLength: 500 })),
  },
  { additionalProperties: false },
);

export type SubmitPersonalIntentRequest = Static<
  typeof SubmitPersonalIntentRequestSchema
>;

export const UpdateIntentFollowUpRequestSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("pending_follow_up"),
      Type.Literal("communicating"),
    ]),
    assigneeAccountId: Type.String({ minLength: 1 }),
    internalNote: OptionalTextSchema,
  },
  { additionalProperties: false },
);

export type UpdateIntentFollowUpRequest = Static<
  typeof UpdateIntentFollowUpRequestSchema
>;

export const ConvertIntentToOrderRequestSchema = Type.Object(
  {
    assigneeAccountId: Type.String({ minLength: 1 }),
    plannedQuotaDeduction: Type.Integer({ minimum: 1 }),
    servicePlan: Type.String({ minLength: 1, maxLength: 10_000 }),
    departureDate: DateSchema,
    returnDate: DateSchema,
    transport: Type.Optional(Type.String({ maxLength: 500 })),
    accommodation: Type.Optional(Type.String({ maxLength: 2_000 })),
    pickupService: Type.Optional(Type.String({ maxLength: 1_000 })),
    internalNote: OptionalTextSchema,
  },
  { additionalProperties: false },
);

export type ConvertIntentToOrderRequest = Static<
  typeof ConvertIntentToOrderRequestSchema
>;

export type AdminOperatorAccountDto = Omit<OperatorAccount, "password">;
export type AdminEmployeeDto = Omit<Employee, "password">;
export type GroupDto = Group;
export type QuotaAccountDto = QuotaAccount;
export type ServiceProductDto = ServiceProduct;
export type PersonalIntentDto = PersonalIntent;
export type PersonalOrderDto = PersonalOrder;
export type QuotaTransactionDto = QuotaTransaction;
export type ServiceReviewDto = ServiceReview;
