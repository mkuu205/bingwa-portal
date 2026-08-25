import { describe, expect, it, vi } from "vitest";

import { ENV, validateProductionAppUrl } from "./_core/env";

describe("production APP_URL configuration", () => {
  it("uses the configured public Portal origin for generated links", () => {
    expect(ENV.appUrl).toBe("https://portal.bingwasokoni.top");
    expect(new URL("/verify-email?token=test", ENV.appUrl).origin).toBe("https://portal.bingwasokoni.top");
  });

  it("builds pairing links from the production Portal origin", () => {
    const pairingUrl = new URL("/pair-device", ENV.appUrl);
    pairingUrl.searchParams.set("code", "BINGWA-TEST");
    pairingUrl.searchParams.set("secret", "secret-test");
    expect(pairingUrl.origin).toBe("https://portal.bingwasokoni.top");
    expect(pairingUrl.pathname).toBe("/pair-device");
  });

  it("enforces an HTTPS origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => validateProductionAppUrl("https://portal.bingwasokoni.top")).not.toThrow();
    expect(() => validateProductionAppUrl("http://portal.bingwasokoni.top")).toThrow(/HTTPS/);
    expect(() => validateProductionAppUrl("https://portal.bingwasokoni.top/customer")).toThrow(/origin URL/);
    expect(() => validateProductionAppUrl("https://localhost")).toThrow(/public production Portal domain/);
    expect(() => validateProductionAppUrl("https://example.railway.app")).toThrow(/public production Portal domain/);
    expect(() => validateProductionAppUrl("https://example.manus.computer")).toThrow(/public production Portal domain/);
    vi.unstubAllEnvs();
  });
});
