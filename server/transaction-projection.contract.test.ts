import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const projectionSection = routerSource.slice(
  routerSource.indexOf("for (const tx of input.transactions)"),
  routerSource.indexOf("await db.syncEvent.create", routerSource.indexOf("for (const tx of input.transactions)")),
);

describe("Android transaction projection idempotency", () => {
  it("uses the unique projection key as a conflict-safe upsert boundary", () => {
    expect(projectionSection).toContain("const projectionKey = tx.androidTransactionId");
    expect(projectionSection).toContain("await db.transaction.upsert({");
    expect(projectionSection).toContain("where: { projectionKey }");
    expect(projectionSection).toContain("create: data");
    expect(projectionSection).toContain("update: data");
    expect(projectionSection).not.toContain("transaction.findFirst");
    expect(projectionSection).toContain("if (projectionKey)");
    expect(projectionSection).toContain("} else {\n            await db.transaction.create({ data });");
    expect(routerSource).toContain("At least one Android transaction identity is required for projection");
  });
});
