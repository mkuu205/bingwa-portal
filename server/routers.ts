import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { commands, devices, services, subscriptions, syncEvents, transactions } from "../drizzle/schema";
import { getDb, getDeviceByToken, getOperationsSnapshot, searchTransactions, getQueuedCommandsForDevice, markCommandDelivered, updateDeviceCommandResult, updateSubscriptionRecord } from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const deviceInput = z.object({
  deviceId: z.string().min(3).max(128),
  deviceName: z.string().min(1).max(160),
  model: z.string().max(160).optional(),
  manufacturer: z.string().max(120).optional(),
  androidVersion: z.string().max(40).optional(),
  sdkVersion: z.string().max(40).optional(),
  appVersion: z.string().max(80).optional(),
  appBuild: z.string().max(40).optional(),
  phoneNumber: z.string().max(40).optional(),
  simSlot: z.number().int().optional(),
  subscriptionId: z.number().int().optional(),
  carrierName: z.string().max(120).optional(),
  iccId: z.string().max(160).optional(),
  automationSimConfigured: z.boolean().optional(),
});

const transactionSyncInput = z.object({
  androidTransactionId: z.string().max(128).optional(),
  executionId: z.string().max(128).optional(),
  operationId: z.string().max(160).optional(),
  customerName: z.string().max(180).optional(),
  phoneNumber: z.string().min(5).max(40),
  packageName: z.string().min(1).max(160),
  amount: z.number().nonnegative(),
  paymentMethod: z.enum(["MPESA", "AIRTEL_MONEY", "AIRTIME", "OTHER"]).optional(),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "WAITING"]).optional(),
  verificationStatus: z.enum(["NOT_REQUIRED", "PENDING", "VERIFIED", "FAILED"]).optional(),
  verificationMessage: z.string().optional(),
  receiptCode: z.string().max(120).optional(),
  issue: z.string().optional(),
  executedAt: z.coerce.date().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  operations: router({
    snapshot: adminProcedure.query(() => getOperationsSnapshot()),
    transactions: adminProcedure.input(z.object({ query: z.string().optional() })).query(({ input }) => searchTransactions(input.query)),
    enqueueCommand: adminProcedure.input(z.object({ deviceId: z.number().int().positive(), commandType: z.string().min(1).max(80), payload: z.record(z.string(), z.unknown()).optional(), expiresAt: z.coerce.date().optional() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result = await db.insert(commands).values({ deviceId: input.deviceId, commandType: input.commandType, payload: input.payload, requestedBy: ctx.user.id, expiresAt: input.expiresAt });
      return { id: Number(result[0].insertId), status: "QUEUED" as const };
    }),
    registerDevice: adminProcedure.input(deviceInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const enrollmentToken = randomBytes(24).toString("hex");
      await db.insert(devices).values({ ...input, automationSimConfigured: input.automationSimConfigured ? 1 : 0, status: "pending", enrollmentTokenHash: hashToken(enrollmentToken), enrolledAt: new Date() }).onDuplicateKeyUpdate({ set: { deviceName: input.deviceName, model: input.model, appVersion: input.appVersion, appBuild: input.appBuild, updatedAt: new Date() } });
      return { enrollmentToken };
    }),
    updateService: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["OPERATIONAL", "DEGRADED", "OUTAGE", "MAINTENANCE"]) })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(services).set({ status: input.status, lastCheckedAt: new Date() }).where(eq(services.id, input.id));
      return { success: true };
    }),
    updateSubscription: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"]).optional(), planName: z.string().min(1).max(120).optional(), tokenBalance: z.number().int().min(0).optional(), renewalAt: z.coerce.date().nullable().optional() })).mutation(async ({ input }) => {
      const { id, ...patch } = input;
      return { success: await updateSubscriptionRecord(id, patch) };
    }),
  }),
  deviceSync: router({
    pollCommands: publicProcedure.input(z.object({ deviceId: z.string().min(3), enrollmentToken: z.string().min(8), limit: z.number().int().min(1).max(50).optional() })).mutation(async ({ input }) => {
      const device = await getDeviceByToken(input.deviceId, hashToken(input.enrollmentToken));
      if (!device) return { accepted: false as const, reason: "INVALID_DEVICE_CREDENTIALS" };
      const queued = await getQueuedCommandsForDevice(device.id, input.limit ?? 20);
      const commandsForDevice = [];
      for (const command of queued) {
        await markCommandDelivered(device.id, command.id);
        commandsForDevice.push({ id: command.id, commandType: command.commandType, payload: command.payload, expiresAt: command.expiresAt });
      }
      return { accepted: true as const, commands: commandsForDevice };
    }),
    reportCommand: publicProcedure.input(z.object({ deviceId: z.string().min(3), enrollmentToken: z.string().min(8), commandId: z.number().int().positive(), status: z.enum(["ACKNOWLEDGED", "EXECUTING", "SUCCEEDED", "FAILED", "EXPIRED"]), resultMessage: z.string().max(1000).optional() })).mutation(async ({ input }) => {
      const device = await getDeviceByToken(input.deviceId, hashToken(input.enrollmentToken));
      if (!device) return { accepted: false as const, reason: "INVALID_DEVICE_CREDENTIALS" };
      const updated = await updateDeviceCommandResult(device.id, input.commandId, input.status, input.resultMessage);
      return { accepted: updated as boolean };
    }),
    heartbeat: publicProcedure.input(z.object({ deviceId: z.string().min(3), enrollmentToken: z.string().min(8), device: deviceInput.partial().extend({ deviceName: z.string().optional() }), transactions: z.array(transactionSyncInput).max(100).default([]), operationalStatus: z.string().max(120).optional() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const device = await getDeviceByToken(input.deviceId, hashToken(input.enrollmentToken));
      if (!device) return { accepted: false as const, reason: "INVALID_DEVICE_CREDENTIALS" };
      const now = new Date();
      await db.update(devices).set({ ...input.device, automationSimConfigured: input.device.automationSimConfigured === undefined ? device.automationSimConfigured : input.device.automationSimConfigured ? 1 : 0, status: "online", lastHeartbeatAt: now, lastSyncAt: now }).where(eq(devices.id, device.id));
      for (const tx of input.transactions) {
        await db.insert(transactions).values({ ...tx, deviceId: device.id, amount: tx.amount.toFixed(2) });
      }
      await db.insert(syncEvents).values({ deviceId: device.id, eventType: "HEARTBEAT", payload: { operationalStatus: input.operationalStatus, transactionCount: input.transactions.length }, accepted: 1 });
      return { accepted: true as const, receivedAt: now.toISOString(), commandIds: [] as number[] };
    }),
  }),
});

export type AppRouter = typeof appRouter;
