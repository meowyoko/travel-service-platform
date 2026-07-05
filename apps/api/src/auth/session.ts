import { createHash, randomBytes, randomUUID } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "travel_admin_session";
export const EMPLOYEE_SESSION_COOKIE = "travel_employee_session";

export interface NewSessionToken {
  id: string;
  token: string;
  tokenHash: string;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken(): NewSessionToken {
  const token = randomBytes(32).toString("base64url");
  return {
    id: randomUUID(),
    token,
    tokenHash: hashSessionToken(token),
  };
}

export function getSessionExpiry(ttlDays: number, now = new Date()): Date {
  return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}
