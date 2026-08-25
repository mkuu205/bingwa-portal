export function validateProductionDatabaseUrl(url: string): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!/^postgres(?:ql):\/\//.test(url)) {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol in production");
  }
  const parsed = new URL(url);
  if (parsed.searchParams.get("sslmode") !== "require") {
    throw new Error("DATABASE_URL must set sslmode=require in production");
  }
  for (const parameter of ["connection_limit", "pool_timeout", "connect_timeout"]) {
    const value = Number(parsed.searchParams.get(parameter));
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`DATABASE_URL must set a positive ${parameter} in production`);
    }
  }
}

export function validateProductionAppUrl(url: string): void {
  if (process.env.NODE_ENV !== "production") return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("APP_URL must be a valid absolute URL in production");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("APP_URL must use HTTPS in production");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".railway.app") || hostname.endsWith(".manus.computer")) {
    throw new Error("APP_URL must use the public production Portal domain, not a local or temporary host");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("APP_URL must be an origin URL without a path, query, or fragment");
  }
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? "587"),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPassword: process.env.SMTP_PASSWORD ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  customerSessionSecret: process.env.CUSTOMER_SESSION_SECRET ?? process.env.JWT_SECRET ?? "",
  payflowApiKey: process.env.PAYFLOW_API_KEY ?? "",
  payflowApiSecret: process.env.PAYFLOW_API_SECRET ?? "",
  payflowBaseUrl: process.env.PAYFLOW_BASE_URL ?? "https://payflow.top/api/v2",
  payflowPaymentAccountId: process.env.PAYFLOW_PAYMENT_ACCOUNT_ID ?? "",
};
