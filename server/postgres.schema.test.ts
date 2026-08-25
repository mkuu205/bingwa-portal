import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";

describe("PostgreSQL Prisma schema", () => {
  it("contains the migrated Portal tables on the configured database", async () => {
    if (!process.env.POSTGRES_DATABASE_URL) {
      throw new Error("POSTGRES_DATABASE_URL is required for this test");
    }

    const result = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'customers', 'devices', 'transactions', 'commands', 'subscriptions', 'products', 'bingwa_payments', 'entitlement_grants', 'audit_logs', '_prisma_migrations')
      ORDER BY table_name
    `;

    expect(result.map(row => row.table_name)).toEqual([
      "_prisma_migrations",
      "audit_logs",
      "bingwa_payments",
      "commands",
      "customers",
      "devices",
      "entitlement_grants",
      "products",
      "subscriptions",
      "transactions",
      "users",
    ]);
  }, 15_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
