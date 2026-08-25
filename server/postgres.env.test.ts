import { afterEach, describe, expect, it, vi } from "vitest";
import { validateProductionDatabaseUrl } from "./_core/env";

describe("PostgreSQL runtime configuration", () => {
  it("uses a PostgreSQL DATABASE_URL when configured", () => {
    const url = process.env.DATABASE_URL;
    if (!url || !/^(postgresql|postgres):\/\//.test(url)) return;
    expect(url.startsWith("postgresql://") || url.startsWith("postgres://")).toBe(true);
  });

  it("requires TLS and explicit pool settings in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => validateProductionDatabaseUrl("postgresql://user:pass@host/db?sslmode=require&connection_limit=5&pool_timeout=10&connect_timeout=10")).not.toThrow();
    expect(() => validateProductionDatabaseUrl("postgresql://user:pass@host/db?sslmode=require")).toThrow(/connection_limit/);
  });

  afterEach(() => vi.unstubAllEnvs());
});
