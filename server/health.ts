import type { Express } from "express";
import { prisma } from "./prisma";
import { ENV } from "./_core/env";

/**
 * Process liveness must not depend on optional external services. Railway uses
 * this endpoint to determine whether the Node process is accepting requests.
 */
export function registerHealthRoute(app: Express) {
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, service: "bingwa-portal" });
  });

  /**
   * Database readiness is intentionally separate from process liveness. A
   * missing DATABASE_URL is reported explicitly instead of being swallowed.
   */
  app.get("/readyz", async (_req, res) => {
    if (!ENV.databaseUrl) {
      res.status(503).json({ ok: false, database: "not_configured" });
      return;
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ ok: true, database: "up" });
    } catch {
      res.status(503).json({ ok: false, database: "down" });
    }
  });
}

