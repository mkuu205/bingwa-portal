import express from "express";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { registerHealthRoute } from "./health";

describe("process healthcheck", () => {
  it("returns liveness without requiring database configuration", async () => {
    const app = express();
    registerHealthRoute(app);
    const server = createServer(app);

    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("health test server did not bind to an ephemeral port");
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ ok: true, service: "bingwa-portal" });
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});

