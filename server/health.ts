import type { Express } from "express";
import { prisma } from "./prisma";

export function registerHealthRoute(app: Express) {
  app.get("/healthz", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ ok: true, database: "up" });
    } catch {
      res.status(503).json({ ok: false, database: "down" });
    }
  });
}
