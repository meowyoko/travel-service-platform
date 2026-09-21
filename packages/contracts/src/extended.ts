import { Type, type Static } from "@sinclair/typebox";

import { CreateServiceProductRequestSchema } from "./core.js";

const DateSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
});
const OptionalTextSchema = Type.Optional(Type.String({ maxLength: 10_000 }));

export const UpdateGroupRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 200 }),
    contactName: Type.String({ minLength: 1, maxLength: 100 }),
    contactPhone: Type.String({ minLength: 1, maxLength: 30 }),
    cooperationStartDate: DateSchema,
    cooperationEndDate: Type.Optional(DateSchema),
    status: Type.Union([
      Type.Literal("active"),
      Type.Literal("paused"),
      Type.Literal("ended"),
    ]),
    note: OptionalTextSchema,
  },
  { additionalProperties: false },
);

export const CreateEmployeesBatchRequestSchema = Type.Object(
  {
    groupId: Type.String({ minLength: 1 }),
    employees: Type.Array(
      Type.Object(
        {
          name: Type.String({ minLength: 1, maxLength: 100 }),
          phone: Type.String({ minLength: 1, maxLength: 30 }),
          password: Type.Optional(
            Type.String({ minLength: 6, maxLength: 200 }),
          ),
          department: Type.Optional(Type.String({ maxLength: 100 })),
          employeeNumber: Type.Optional(Type.String({ maxLength: 100 })),
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
  },
  { additionalProperties: false },
);

export const UpdateEmployeeRequestSchema = Type.Object(
  {
    groupId: Type.String({ minLength: 1 }),
    department: Type.Optional(Type.String({ maxLength: 100 })),
    employeeNumber: Type.Optional(Type.String({ maxLength: 100 })),
    position: Type.Optional(Type.String({ maxLength: 100 })),
    status: Type.Union([Type.Literal("active"), Type.Literal("disabled")]),
    note: OptionalTextSchema,
  },
  { additionalProperties: false },
);

export const AdjustQuotaRequestSchema = Type.Object(
  {
    amount: Type.Integer({ not: { const: 0 } }),
    reason: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);

export const RefundOrderQuotaRequestSchema = Type.Object(
  {
    amount: Type.Integer({ minimum: 1 }),
    reason: Type.String({ minLength: 1, maxLength: 500 }),
    internalNote: OptionalTextSchema,
  },
  { additionalProperties: false },
);

export const CreateHotelRoomTypeRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 200 }),
    imageUrl: Type.Optional(Type.String({ maxLength: 2_000 })),
    bedType: Type.Optional(Type.String({ maxLength: 100 })),
    capacity: Type.Integer({ minimum: 1, maximum: 20 }),
    breakfast: Type.Optional(Type.String({ maxLength: 200 })),
    area: Type.Optional(Type.String({ maxLength: 100 })),
    description: OptionalTextSchema,
  },
  { additionalProperties: false },
);

export const UpdateHotelRoomTypeRequestSchema = Type.Composite(
  [
    CreateHotelRoomTypeRequestSchema,
    Type.Object({
      status: Type.Union([Type.Literal("draft"), Type.Literal("published")]),
    }),
  ],
  { additionalProperties: false },
);

export const UpsertHotelRoomInventoryRequestSchema = Type.Object(
  {
    date: DateSchema,
    quotaPrice: Type.Integer({ minimum: 0 }),
    totalInventory: Type.Integer({ minimum: 0 }),
    isAvailable: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const UpdateServiceProductRequestSchema = Type.Composite(
  [
    CreateServiceProductRequestSchema,
    Type.Object({
      confirmDescriptionChanges: Type.Optional(Type.Boolean()),
    }),
  ],
  { additionalProperties: false },
);

export const CloseIntentRequestSchema = Type.Object(
  {
    assigneeAccountId: Type.String({ minLength: 1 }),
    internalNote: OptionalTextSchema,
  },
  { additionalProperties: false },
);

export const UpdatePendingOrderRequestSchema = Type.Object(
  {
    plannedQuotaDeduction: Type.Optional(Type.Integer({ minimum: 1 })),
    servicePlan: Type.Optional(Type.String({ minLength: 1, maxLength: 10_000 })),
    departureDate: Type.Optional(DateSchema),
    returnDate: Type.Optional(DateSchema),
    transport: Type.Optional(Type.String({ maxLength: 500 })),
    accommodation: Type.Optional(Type.String({ maxLength: 2_000 })),
    hotelAccommodation: Type.Optional(
      Type.Union([
        Type.Object(
          {
            hotelProductId: Type.String({ minLength: 1 }),
            roomTypeId: Type.Optional(Type.String({ minLength: 1 })),
            checkInDate: DateSchema,
            checkOutDate: DateSchema,
            note: Type.Optional(Type.String({ maxLength: 10_000 })),
          },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
    ),
    pickupService: Type.Optional(Type.String({ maxLength: 1_000 })),
    internalNote: OptionalTextSchema,
  },
  { additionalProperties: false, minProperties: 1 },
);

export const AssignOrderRequestSchema = Type.Object(
  { assigneeAccountId: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);

export const UpdateOrderTravelDatesRequestSchema = Type.Object(
  {
    departureDate: DateSchema,
    returnDate: DateSchema,
  },
  { additionalProperties: false },
);

export const ModerateReviewRequestSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("published"),
      Type.Literal("hidden"),
    ]),
  },
  { additionalProperties: false },
);

export const SubmitOrderReviewRequestSchema = Type.Object(
  {
    rating: Type.Integer({ minimum: 1, maximum: 5 }),
    content: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);

const AdminPermissionSchema = Type.Union([
  Type.Literal("groups"),
  Type.Literal("employees"),
  Type.Literal("quotas"),
  Type.Literal("products"),
  Type.Literal("hotels"),
  Type.Literal("intents"),
  Type.Literal("orders"),
  Type.Literal("reviews"),
  Type.Literal("operator_accounts"),
]);

export const CreateOperatorAccountRequestSchema = Type.Object(
  {
    username: Type.String({ minLength: 1, maxLength: 100 }),
    password: Type.String({ minLength: 6, maxLength: 200 }),
    displayName: Type.String({ minLength: 1, maxLength: 100 }),
    role: Type.Union([Type.Literal("leader"), Type.Literal("staff")]),
    pagePermissions: Type.Array(AdminPermissionSchema, { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const UpdateOperatorAccountRequestSchema = Type.Object(
  {
    displayName: Type.String({ minLength: 1, maxLength: 100 }),
    role: Type.Union([Type.Literal("leader"), Type.Literal("staff")]),
    status: Type.Union([Type.Literal("active"), Type.Literal("disabled")]),
    pagePermissions: Type.Array(AdminPermissionSchema, { uniqueItems: true }),
    newPassword: Type.Optional(
      Type.String({ minLength: 6, maxLength: 200 }),
    ),
  },
  { additionalProperties: false },
);

export type UpdateGroupRequest = Static<typeof UpdateGroupRequestSchema>;
export type CreateEmployeesBatchRequest = Static<
  typeof CreateEmployeesBatchRequestSchema
>;
export type UpdateEmployeeRequest = Static<
  typeof UpdateEmployeeRequestSchema
>;
export type AdjustQuotaRequest = Static<typeof AdjustQuotaRequestSchema>;
export type RefundOrderQuotaRequest = Static<
  typeof RefundOrderQuotaRequestSchema
>;
export type CreateHotelRoomTypeRequest = Static<
  typeof CreateHotelRoomTypeRequestSchema
>;
export type UpdateHotelRoomTypeRequest = Static<
  typeof UpdateHotelRoomTypeRequestSchema
>;
export type UpsertHotelRoomInventoryRequest = Static<
  typeof UpsertHotelRoomInventoryRequestSchema
>;
export type UpdateServiceProductRequest = Static<
  typeof UpdateServiceProductRequestSchema
>;
export type CloseIntentRequest = Static<typeof CloseIntentRequestSchema>;
export type UpdatePendingOrderRequest = Static<
  typeof UpdatePendingOrderRequestSchema
>;
export type AssignOrderRequest = Static<typeof AssignOrderRequestSchema>;
export type UpdateOrderTravelDatesRequest = Static<
  typeof UpdateOrderTravelDatesRequestSchema
>;
export type ModerateReviewRequest = Static<
  typeof ModerateReviewRequestSchema
>;
export type SubmitOrderReviewRequest = Static<
  typeof SubmitOrderReviewRequestSchema
>;
export type CreateOperatorAccountRequest = Static<
  typeof CreateOperatorAccountRequestSchema
>;
export type UpdateOperatorAccountRequest = Static<
  typeof UpdateOperatorAccountRequestSchema
>;
