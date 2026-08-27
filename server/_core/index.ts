import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerHealthRoute } from "../health";
import { bootstrapAdminFromEnvironment } from "../adminAuth";
import { getDatabaseStatus } from "../db";
import { serveStatic, setupVite } from "./vite";
import { ENV, validateProductionAppUrl } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  validateProductionAppUrl(ENV.appUrl);
  console.log(`[Config] APP_URL configured: ${ENV.appUrl ? "yes" : "no"}`);
  console.log(`[Config] DATABASE_URL configured: ${ENV.databaseUrl ? "yes" : "no"}`);
  console.log(`[Config] Native authentication: enabled`);
  console.log(`[Config] PayFlow: ${ENV.payflowApiKey && ENV.payflowApiSecret ? "configured" : "not configured"}`);
  console.log(`[Config] OAuth: ${ENV.oAuthServerUrl ? "optional/configured" : "optional/not configured"}`);
  const databaseStatus = await getDatabaseStatus();
  console.log(`[Config] DATABASE connection attempted: ${databaseStatus !== "not_configured" ? "yes" : "no"}`);
  console.log(`[Config] DATABASE connection: ${databaseStatus === "up" ? "successful" : databaseStatus === "down" ? "failed" : "not configured"}`);
  if (ENV.databaseUrl) {
    try {
      const bootstrap = await bootstrapAdminFromEnvironment();
      console.log(`[Admin] Bootstrap: ${bootstrap.bootstrapped ? "created" : bootstrap.reason === "not_configured" ? "not configured" : "existing"}`);
    } catch (error) {
      console.error("[Admin] Bootstrap failed:", error instanceof Error ? error.message : "unknown error");
    }
  }
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  const allowedOrigin = new URL(ENV.appUrl).origin;
  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    const localOrigin = process.env.NODE_ENV === "development" && requestOrigin?.startsWith("http://localhost:");
    if (requestOrigin && (requestOrigin === allowedOrigin || localOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerHealthRoute(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const isProduction = process.env.NODE_ENV === "production";
  const port = isProduction ? preferredPort : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  const host = process.env.HOST || (isProduction ? "0.0.0.0" : "127.0.0.1");
  server.listen(port, host, () => {
    console.log(`[Server] Listening on configured PORT ${port}`);
  });
}

startServer().catch(error => {
  console.error("Server startup failed", error);
  process.exitCode = 1;
});
