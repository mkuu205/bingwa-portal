import { describe, expect, it } from "vitest";
import { getAnalyticsScriptUrl } from "./src/lib/analytics";
import { readFileSync } from "node:fs";

describe("analytics endpoint contract", () => {
  it("does not emit a request for unresolved build placeholders", () => {
    expect(getAnalyticsScriptUrl("%VITE_ANALYTICS_ENDPOINT%")).toBeNull();
    expect(getAnalyticsScriptUrl("%VITE_ANALYTICS_ENDPOINT%/umami")).toBeNull();
    expect(getAnalyticsScriptUrl(undefined)).toBeNull();
  });

  it("keeps the runtime loader guarded against unresolved website-id placeholders", () => {
    const source = readFileSync(new URL("./src/lib/analytics.ts", import.meta.url), "utf8");
    expect(source).toContain("!isResolved(import.meta.env.VITE_ANALYTICS_WEBSITE_ID)");
  });

  it("accepts only credential-free HTTP(S) origins and appends Umami path", () => {
    expect(getAnalyticsScriptUrl("https://analytics.example.com/")).toBe("https://analytics.example.com/umami");
    expect(getAnalyticsScriptUrl("http://localhost:3001")).toBe("http://localhost:3001/umami");
    expect(getAnalyticsScriptUrl("javascript:alert(1)")).toBeNull();
    expect(getAnalyticsScriptUrl("https://user:pass@analytics.example.com")).toBeNull();
    expect(getAnalyticsScriptUrl("not-a-url")).toBeNull();
  });
});
