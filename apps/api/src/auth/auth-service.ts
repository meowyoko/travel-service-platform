import type {
  PublicEmployee,
  PublicOperatorAccount,
} from "@travel/contracts";
import { and, eq, gt, lt, sql } from "drizzle-orm";

import type { ApiConfig } from "../config.js";
import type { Database } from "../db/client.js";
import {
  employees,
  operatorAccounts,
  operatorPagePermissions,
  sessions,
} from "../db/schema.js";
import { verifyPassword } from "./password.js";
import {
  createSessionToken,
  getSessionExpiry,
  hashSessionToken,
} from "./session.js";

export interface CreatedSession<TAccount> {
  token: string;
  expiresAt: Date;
  account: TAccount;
}

async function getPublicOperatorAccount(
  db: Database,
  accountId: string,
): Promise<PublicOperatorAccount | null> {
  const [account] = await db
    .select({
      id: operatorAccounts.id,
      username: operatorAccounts.username,
      displayName: operatorAccounts.displayName,
      role: operatorAccounts.role,
      status: operatorAccounts.status,
    })
    .from(operatorAccounts)
    .where(eq(operatorAccounts.id, accountId))
    .limit(1);

  if (!account || account.status !== "active") {
    return null;
  }

  const permissionRows = await db
    .select({ permission: operatorPagePermissions.permission })
    .from(operatorPagePermissions)
    .where(eq(operatorPagePermissions.operatorAccountId, account.id));

  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    pagePermissions: permissionRows.map(({ permission }) => permission),
  };
}

async function getPublicEmployee(
  db: Database,
  employeeId: string,
): Promise<PublicEmployee | null> {
  const [employee] = await db
    .select({
      id: employees.id,
      name: employees.name,
      phone: employees.phone,
      groupId: employees.groupId,
      department: employees.department,
      employeeNumber: employees.employeeNumber,
      position: employees.position,
      status: employees.status,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee || employee.status !== "active") {
    return null;
  }

  return {
    id: employee.id,
    name: employee.name,
    phone: employee.phone,
    groupId: employee.groupId,
    ...(employee.department ? { department: employee.department } : {}),
    ...(employee.employeeNumber
      ? { employeeNumber: employee.employeeNumber }
      : {}),
    ...(employee.position ? { position: employee.position } : {}),
  };
}

export async function createAdminSession(
  db: Database,
  config: Pick<ApiConfig, "sessionTtlDays">,
  identifier: string,
  password: string,
): Promise<CreatedSession<PublicOperatorAccount> | null> {
  const normalizedUsername = identifier.trim().toLowerCase();
  const [storedAccount] = await db
    .select()
    .from(operatorAccounts)
    .where(
      sql`lower(${operatorAccounts.username}) = ${normalizedUsername}`,
    )
    .limit(1);

  if (
    !storedAccount ||
    storedAccount.status !== "active" ||
    !(await verifyPassword(password, storedAccount.passwordHash))
  ) {
    return null;
  }

  const account = await getPublicOperatorAccount(db, storedAccount.id);
  if (!account) {
    return null;
  }

  const now = new Date();
  const expiresAt = getSessionExpiry(config.sessionTtlDays, now);
  const sessionToken = createSessionToken();

  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(lt(sessions.expiresAt, now));
    await tx.insert(sessions).values({
      id: sessionToken.id,
      tokenHash: sessionToken.tokenHash,
      operatorAccountId: account.id,
      expiresAt,
      createdAt: now,
    });
  });

  return { token: sessionToken.token, expiresAt, account };
}

export async function createEmployeeSession(
  db: Database,
  config: Pick<ApiConfig, "sessionTtlDays">,
  identifier: string,
  password: string,
): Promise<CreatedSession<PublicEmployee> | null> {
  const normalizedPhone = identifier.trim();
  const [storedEmployee] = await db
    .select()
    .from(employees)
    .where(eq(employees.phone, normalizedPhone))
    .limit(1);

  if (
    !storedEmployee ||
    storedEmployee.status !== "active" ||
    !(await verifyPassword(password, storedEmployee.passwordHash))
  ) {
    return null;
  }

  const employee = await getPublicEmployee(db, storedEmployee.id);
  if (!employee) {
    return null;
  }

  const now = new Date();
  const expiresAt = getSessionExpiry(config.sessionTtlDays, now);
  const sessionToken = createSessionToken();

  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(lt(sessions.expiresAt, now));
    await tx.insert(sessions).values({
      id: sessionToken.id,
      tokenHash: sessionToken.tokenHash,
      employeeId: employee.id,
      expiresAt,
      createdAt: now,
    });
  });

  return { token: sessionToken.token, expiresAt, account: employee };
}

export async function resolveAdminSession(
  db: Database,
  token: string | undefined,
): Promise<PublicOperatorAccount | null> {
  if (!token) {
    return null;
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session?.operatorAccountId) {
    return null;
  }

  const account = await getPublicOperatorAccount(
    db,
    session.operatorAccountId,
  );
  if (!account) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
  }
  return account;
}

export async function resolveEmployeeSession(
  db: Database,
  token: string | undefined,
): Promise<PublicEmployee | null> {
  if (!token) {
    return null;
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session?.employeeId) {
    return null;
  }

  const employee = await getPublicEmployee(db, session.employeeId);
  if (!employee) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
  }
  return employee;
}

export async function deleteSessionByToken(
  db: Database,
  token: string | undefined,
): Promise<void> {
  if (!token) {
    return;
  }
  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(token)));
}
