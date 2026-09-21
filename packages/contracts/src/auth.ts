import { Type, type Static } from "@sinclair/typebox";

export const LoginRequestSchema = Type.Object(
  {
    identifier: Type.String({ minLength: 1, maxLength: 100 }),
    password: Type.String({ minLength: 1, maxLength: 200 }),
  },
  { additionalProperties: false },
);

export type LoginRequest = Static<typeof LoginRequestSchema>;

export const AdminPagePermissionSchema = Type.Union([
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

export const PublicOperatorAccountSchema = Type.Object(
  {
    id: Type.String(),
    username: Type.String(),
    displayName: Type.String(),
    role: Type.Union([Type.Literal("leader"), Type.Literal("staff")]),
    pagePermissions: Type.Array(AdminPagePermissionSchema),
  },
  { additionalProperties: false },
);

export type PublicOperatorAccount = Static<
  typeof PublicOperatorAccountSchema
>;

export const PublicEmployeeSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    phone: Type.String(),
    groupId: Type.String(),
    department: Type.Optional(Type.String()),
    employeeNumber: Type.Optional(Type.String()),
    position: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type PublicEmployee = Static<typeof PublicEmployeeSchema>;

export const AdminSessionResponseSchema = Type.Object(
  { account: PublicOperatorAccountSchema },
  { additionalProperties: false },
);

export const EmployeeSessionResponseSchema = Type.Object(
  { employee: PublicEmployeeSchema },
  { additionalProperties: false },
);

export const ApiErrorSchema = Type.Object(
  {
    code: Type.String(),
    message: Type.String(),
  },
  { additionalProperties: false },
);

export type ApiError = Static<typeof ApiErrorSchema>;
