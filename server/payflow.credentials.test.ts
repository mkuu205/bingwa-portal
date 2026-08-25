import { describe, expect, it } from "vitest";

describe("PayFlow server credentials", () => {
  it.skipIf(process.env.PAYFLOW_VALIDATE !== "1")("reaches the configured PayFlow host without exposing credentials", async () => {
    const baseUrl = process.env.PAYFLOW_BASE_URL?.trim();
    const apiKey = process.env.PAYFLOW_API_KEY?.trim();
    const apiSecret = process.env.PAYFLOW_API_SECRET?.trim();
    expect(baseUrl).toBeTruthy();
    expect(apiKey).toBeTruthy();
    expect(apiSecret).toBeTruthy();

    const response = await fetch(baseUrl!, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey!,
        "X-API-Secret": apiSecret!,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });

    // A configured host may not expose a root document, but credentials must
    // not be rejected at the authentication boundary.
    expect([401, 403]).not.toContain(response.status);
  }, 15_000);
});
