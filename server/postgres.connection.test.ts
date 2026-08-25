import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";

const hasPostgres = /^(postgresql|postgres):\/\//.test(process.env.DATABASE_URL ?? "");

describe.skipIf(!hasPostgres)("PostgreSQL connection", () => {
  it("connects with the configured Prisma database secret", async () => {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    expect(result[0]?.ok).toBe(1);
  }, 15_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
