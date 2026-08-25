import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./src/App.tsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("./src/pages/CustomerAuth.tsx", import.meta.url), "utf8");

// This is intentionally a source-level contract: the project does not ship a browser test runtime.
describe("customer auth routing contract", () => {
  it("registers the authenticated customer destination", () => {
    expect(appSource).toContain('<Route path={"/customer"} component={CustomerHome} />');
  });

  it("navigates successful customer login to the authenticated destination", () => {
    expect(authSource).toMatch(/loginCustomer\.useMutation\([\s\S]*onSuccess:\s*\(\)\s*=>\s*navigate\("\/customer"\)/);
  });
});
