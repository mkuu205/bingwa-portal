import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";

describe("PostgreSQL connection", () => {
  it("connects with the configured Prisma database secret", async () => {
    if (!process.env.POSTGRES_DATABASE_URL) {
      throw new Error("POSTGRES_DATABASE_URL is required for this test");
    }

    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    expect(result[0]?.ok).toBe(1);
  }, 15_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
