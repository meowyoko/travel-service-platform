export interface ApiConfig {
  databaseUrl: string;
  host: string;
  port: number;
  uploadDir: string;
  sessionCookieSecure: boolean;
  sessionTtlDays: number;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} 必须是正整数`);
  }
  return parsed;
}

export function loadApiConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApiConfig {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("缺少 DATABASE_URL");
  }

  return {
    databaseUrl,
    host: environment.API_HOST?.trim() || "127.0.0.1",
    port: parsePositiveInteger(environment.API_PORT, 3000, "API_PORT"),
    uploadDir: environment.UPLOAD_DIR?.trim() || "./data/uploads",
    sessionCookieSecure:
      environment.SESSION_COOKIE_SECURE?.toLowerCase() === "true",
    sessionTtlDays: parsePositiveInteger(
      environment.SESSION_TTL_DAYS,
      7,
      "SESSION_TTL_DAYS",
    ),
  };
}
