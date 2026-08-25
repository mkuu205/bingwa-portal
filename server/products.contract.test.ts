import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
const navigationSource = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");

describe("configurable product contract", () => {
  it("keeps product procedures admin-gated and price optional", () => {
    expect(routerSource).toContain("products: router({");
    expect(routerSource).toContain("list: adminProcedure.query");
    expect(routerSource).toContain("create: adminProcedure.input");
    expect(routerSource).toContain('price: z.number().finite().nonnegative().optional()');
    expect(routerSource).toContain('status: z.enum([\"DRAFT\", \"ACTIVE\", \"ARCHIVED\"])');
  });

  it("does not define an invented default price in the product UI", () => {
    expect(homeSource).toContain("Price (optional)");
    expect(homeSource).toContain("price: draft.price === \"\" ? undefined : Number(draft.price)");
    expect(homeSource).toContain("No products configured");
  });

  it("mirrors the server constraints for product edits before mutation", () => {
    expect(homeSource).toContain("isPositiveIntegerOrNull");
    expect(homeSource).toContain("Number.isInteger(value) && value > 0");
    expect(homeSource).toContain("/^[A-Z]{3}$/");
    expect(homeSource).toContain("non-negative price, and positive whole-number limits");
  });

  it("exposes Products through the existing admin navigation", () => {
    expect(navigationSource).toContain('label: "Products"');
    expect(navigationSource).toContain('path: "/?view=products"');
    expect(homeSource).toContain('view === "products" ? <Products />');
  });
});
