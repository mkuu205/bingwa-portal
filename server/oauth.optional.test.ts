import { afterEach, describe, expect, it, vi } from "vitest";

describe("optional OAuth startup", () => {
  const originalOAuthUrl = process.env.OAUTH_SERVER_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalOAuthUrl === undefined) delete process.env.OAUTH_SERVER_URL;
    else process.env.OAUTH_SERVER_URL = originalOAuthUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("does not emit a missing-OAuth startup error when native auth is used", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.OAUTH_SERVER_URL;
    vi.resetModules();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await import("./_core/sdk");

    expect(errorSpy).not.toHaveBeenCalledWith(
      "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
    );
  });
});

