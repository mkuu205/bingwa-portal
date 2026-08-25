import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PaymentMethod, type TransactionStatus, type VerificationStatus } from "@prisma/client";
import { z } from "zod";
import {
  getDb,
  authenticateDevice,
  getOperationsSnapshot,
  getQueuedCommandsForDevice,
  markCommandDelivered,
  searchTransactions,
  updateDeviceCommandResult,
  updateSubscriptionRecord,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, customerProcedure, publicProcedure, router } from "./_core/trpc";
import { createCustomerSession, clearCustomerSession, consumeEmailVerificationToken, createEmailVerificationToken, customerEmail, hashPassword, verifyPassword } from "./customerAuth";
import { sendCustomerVerificationEmail } from "./email";
import { createDeviceCredential, createPairingMaterial, hashPairingSecret, normalizePairingCode } from "./pairing";

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
    customerMe: publicProcedure.query(opts => opts.ctx.customer ?? null),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    customerLogout: publicProcedure.mutation(async ({ ctx }) => {
      await clearCustomerSession(ctx.req, ctx.res);
      return { success: true } as const;
    }),
    registerCustomer: publicProcedure
      .input(z.object({
        email: z.string().email().max(320),
        password: z.string().min(12).max(128),
        name: z.string().trim().min(2).max(180),
        phone: z.string().trim().min(7).max(40).optional(),
      }))
      .mutation(async ({ input }) => {
        const email = customerEmail(input.email);
        const existing = await (await getDb())?.customer.findUnique({ where: { email } });
        if (existing) throw new Error("Unable to create account with those details");
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const customer = await db.customer.create({
          data: {
            email,
            passwordHash: await hashPassword(input.password),
            name: input.name,
            phone: input.phone,
          },
        });
        const token = await createEmailVerificationToken(customer.id);
        await sendCustomerVerificationEmail({ email: customer.email, name: customer.name, token });
        return { created: true as const, email: customer.email };
      }),
    loginCustomer: publicProcedure
      .input(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const customer = await db.customer.findUnique({ where: { email: customerEmail(input.email) } });
        if (!customer || !(await verifyPassword(input.password, customer.passwordHash)) || !customer.emailVerifiedAt || customer.status !== "ACTIVE") {
          throw new Error("Invalid credentials or unverified email");
        }
        await db.customer.update({ where: { id: customer.id }, data: { lastSignedInAt: new Date() } });
        await createCustomerSession(ctx.req, ctx.res, customer.id);
        return { success: true as const, customer: { id: customer.id, email: customer.email, name: customer.name } };
      }),
    verifyCustomerEmail: publicProcedure
      .input(z.object({ token: z.string().min(20).max(200) }))
      .mutation(async ({ input }) => {
        const customer = await consumeEmailVerificationToken(input.token);
        if (!customer) throw new Error("Verification link is invalid or expired");
        return { verified: true as const, email: customer.email };
      }),
    customerAccount: customerProcedure.query(({ ctx }) => ({
      id: ctx.customer.id,
      email: ctx.customer.email,
      name: ctx.customer.name,
      phone: ctx.customer.phone,
      emailVerifiedAt: ctx.customer.emailVerifiedAt,
    })),
    devices: customerProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db.device.findMany({
        where: { customerId: ctx.customer.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          deviceId: true,
          deviceName: true,
          model: true,
          manufacturer: true,
          androidVersion: true,
          appVersion: true,
          phoneNumber: true,
          automationSimConfigured: true,
          status: true,
          lastHeartbeatAt: true,
          lastSyncAt: true,
          enrolledAt: true,
        },
      });
    }),
    createPairingToken: customerProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const material = createPairingMaterial();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await db.pairingToken.create({
        data: {
          customerId: ctx.customer.id,
          codeHash: material.codeHash,
          secretHash: material.secretHash,
          expiresAt,
        },
      });
      return { code: material.code, secret: material.secret, expiresAt };
    }),
    unpairDevice: customerProcedure
      .input(z.object({ deviceId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        return db.$transaction(async tx => {
          const device = await tx.device.findFirst({ where: { id: input.deviceId, customerId: ctx.customer.id }, select: { id: true } });
          if (!device) return { success: false as const };
          await tx.deviceCredential.updateMany({ where: { deviceId: device.id, revokedAt: null }, data: { revokedAt: new Date() } });
          await tx.pairingToken.deleteMany({ where: { deviceId: device.id } });
          await tx.device.update({ where: { id: device.id }, data: { customerId: null, status: "pending", enrolledAt: null } });
          await tx.auditLog.create({ data: { actorType: "CUSTOMER", actorCustomerId: ctx.customer.id, deviceId: device.id, action: "DEVICE_UNPAIRED" } });
          return { success: true as const };
        });
      }),
  }),
  operations: router({
    snapshot: adminProcedure.query(() => getOperationsSnapshot()),
    transactions: adminProcedure.input(z.object({ query: z.string().optional() })).query(({ input }) => searchTransactions(input.query)),
    enqueueCommand: adminProcedure
      .input(
        z.object({
          deviceId: z.number().int().positive(),
          commandType: z.string().min(1).max(80),
          payload: z.record(z.string(), z.unknown()).optional(),
          expiresAt: z.coerce.date().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const command = await db.command.create({
          data: {
            deviceId: input.deviceId,
            commandType: input.commandType,
            payload: input.payload as Prisma.InputJsonValue | undefined,
            requestedBy: ctx.user.id,
            expiresAt: input.expiresAt,
          },
          select: { id: true, status: true },
        });
        return command;
      }),
    registerDevice: adminProcedure.input(deviceInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const enrollmentToken = randomBytes(24).toString("hex");
      const values = {
        deviceName: input.deviceName,
        model: input.model,
        manufacturer: input.manufacturer,
        androidVersion: input.androidVersion,
        sdkVersion: input.sdkVersion,
        appVersion: input.appVersion,
        appBuild: input.appBuild,
        phoneNumber: input.phoneNumber,
        simSlot: input.simSlot,
        subscriptionId: input.subscriptionId,
        carrierName: input.carrierName,
        iccId: input.iccId,
        automationSimConfigured: input.automationSimConfigured ?? false,
        enrollmentTokenHash: hashToken(enrollmentToken),
        enrolledAt: new Date(),
        status: "pending" as const,
      };
      await db.device.upsert({
        where: { deviceId: input.deviceId },
        create: { deviceId: input.deviceId, ...values },
        update: values,
      });
      return { enrollmentToken };
    }),
    updateService: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["OPERATIONAL", "DEGRADED", "OUTAGE", "MAINTENANCE"]) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const result = await db.service.updateMany({
          where: { id: input.id },
          data: { status: input.status, lastCheckedAt: new Date() },
        });
        return { success: result.count > 0 };
      }),
    updateSubscription: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"]).optional(),
          planName: z.string().min(1).max(120).optional(),
          tokenBalance: z.number().int().min(0).optional(),
          renewalAt: z.coerce.date().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...patch } = input;
        return { success: await updateSubscriptionRecord(id, patch) };
      }),
  }),
  deviceSync: router({
    pairDevice: publicProcedure
      .input(z.object({
        code: z.string().min(4).max(32),
        secret: z.string().min(32).max(128),
        device: deviceInput,
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const codeHash = hashPairingSecret(normalizePairingCode(input.code));
        const secretHash = hashPairingSecret(input.secret);
        const credential = createDeviceCredential();
        const now = new Date();
        return db.$transaction(async tx => {
          const pairing = await tx.pairingToken.findFirst({
            where: { codeHash, secretHash, consumedAt: null, expiresAt: { gt: now } },
            select: { id: true, customerId: true },
          });
          if (!pairing) return { accepted: false as const, reason: "INVALID_OR_EXPIRED_PAIRING" };
          const existing = await tx.device.findUnique({ where: { deviceId: input.device.deviceId }, select: { id: true, customerId: true } });
          if (existing?.customerId && existing.customerId !== pairing.customerId) {
            return { accepted: false as const, reason: "DEVICE_ALREADY_OWNED" };
          }
          const device = existing
            ? await tx.device.update({
                where: { id: existing.id },
                data: {
                  customerId: pairing.customerId,
                  deviceName: input.device.deviceName,
                  model: input.device.model,
                  manufacturer: input.device.manufacturer,
                  androidVersion: input.device.androidVersion,
                  sdkVersion: input.device.sdkVersion,
                  appVersion: input.device.appVersion,
                  appBuild: input.device.appBuild,
                  phoneNumber: input.device.phoneNumber,
                  simSlot: input.device.simSlot,
                  subscriptionId: input.device.subscriptionId,
                  carrierName: input.device.carrierName,
                  iccId: input.device.iccId,
                  automationSimConfigured: input.device.automationSimConfigured ?? false,
                  status: "pending",
                  enrolledAt: now,
                },
              })
            : await tx.device.create({
                data: {
                  deviceId: input.device.deviceId,
                  customerId: pairing.customerId,
                  deviceName: input.device.deviceName,
                  model: input.device.model,
                  manufacturer: input.device.manufacturer,
                  androidVersion: input.device.androidVersion,
                  sdkVersion: input.device.sdkVersion,
                  appVersion: input.device.appVersion,
                  appBuild: input.device.appBuild,
                  phoneNumber: input.device.phoneNumber,
                  simSlot: input.device.simSlot,
                  subscriptionId: input.device.subscriptionId,
                  carrierName: input.device.carrierName,
                  iccId: input.device.iccId,
                  automationSimConfigured: input.device.automationSimConfigured ?? false,
                  status: "pending",
                  enrolledAt: now,
                },
              });
          await tx.deviceCredential.updateMany({ where: { deviceId: device.id, revokedAt: null }, data: { revokedAt: now, rotatedAt: now } });
          await tx.deviceCredential.create({ data: { deviceId: device.id, tokenHash: credential.tokenHash } });
          const consumed = await tx.pairingToken.updateMany({ where: { id: pairing.id, consumedAt: null }, data: { consumedAt: now, deviceId: device.id } });
          if (consumed.count !== 1) return { accepted: false as const, reason: "PAIRING_ALREADY_CONSUMED" };
          await tx.auditLog.create({ data: { actorType: "CUSTOMER", actorCustomerId: pairing.customerId, deviceId: device.id, action: "DEVICE_PAIRED" } });
          return { accepted: true as const, deviceId: device.deviceId, deviceToken: credential.token };
        });
      }),
    pollCommands: publicProcedure
      .input(z.object({ deviceId: z.string().min(3), deviceToken: z.string().min(8).optional(), enrollmentToken: z.string().min(8).optional(), limit: z.number().int().min(1).max(50).optional() }).refine(input => input.deviceToken || input.enrollmentToken, { message: "A device credential is required" }))
      .mutation(async ({ input }) => {
        const device = await authenticateDevice(input.deviceId, input.deviceToken ?? input.enrollmentToken ?? "");
        if (!device) return { accepted: false as const, reason: "INVALID_DEVICE_CREDENTIALS" };
        const queued = await getQueuedCommandsForDevice(device.id, input.limit ?? 20);
        const commandsForDevice = [];
        for (const command of queued) {
          await markCommandDelivered(device.id, command.id);
          commandsForDevice.push({ id: command.id, commandType: command.commandType, payload: command.payload, expiresAt: command.expiresAt });
        }
        return { accepted: true as const, commands: commandsForDevice };
      }),
    reportCommand: publicProcedure
      .input(
        z.object({
          deviceId: z.string().min(3),
          deviceToken: z.string().min(8).optional(),
          enrollmentToken: z.string().min(8).optional(),
          commandId: z.number().int().positive(),
          status: z.enum(["ACKNOWLEDGED", "EXECUTING", "SUCCEEDED", "FAILED", "EXPIRED"]),
          resultMessage: z.string().max(1000).optional(),
        }).refine(input => input.deviceToken || input.enrollmentToken, { message: "A device credential is required" })
      )
      .mutation(async ({ input }) => {
        const device = await authenticateDevice(input.deviceId, input.deviceToken ?? input.enrollmentToken ?? "");
        if (!device) return { accepted: false as const, reason: "INVALID_DEVICE_CREDENTIALS" };
        const updated = await updateDeviceCommandResult(device.id, input.commandId, input.status, input.resultMessage);
        return { accepted: updated as boolean };
      }),
    heartbeat: publicProcedure
      .input(
        z.object({
          deviceId: z.string().min(3),
          deviceToken: z.string().min(8).optional(),
          enrollmentToken: z.string().min(8).optional(),
          device: deviceInput.partial().extend({ deviceName: z.string().optional() }),
          transactions: z.array(transactionSyncInput).max(100).default([]),
          operationalStatus: z.string().max(120).optional(),
        }).refine(input => input.deviceToken || input.enrollmentToken, { message: "A device credential is required" })
      )
      .mutation(async ({ input }) => {
        const device = await authenticateDevice(input.deviceId, input.deviceToken ?? input.enrollmentToken ?? "");
        if (!device) return { accepted: false as const, reason: "INVALID_DEVICE_CREDENTIALS" };
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const now = new Date();
        const deviceUpdate: Prisma.DeviceUpdateInput = {
          ...(input.device.deviceName !== undefined ? { deviceName: input.device.deviceName } : {}),
          ...(input.device.model !== undefined ? { model: input.device.model } : {}),
          ...(input.device.manufacturer !== undefined ? { manufacturer: input.device.manufacturer } : {}),
          ...(input.device.androidVersion !== undefined ? { androidVersion: input.device.androidVersion } : {}),
          ...(input.device.sdkVersion !== undefined ? { sdkVersion: input.device.sdkVersion } : {}),
          ...(input.device.appVersion !== undefined ? { appVersion: input.device.appVersion } : {}),
          ...(input.device.appBuild !== undefined ? { appBuild: input.device.appBuild } : {}),
          ...(input.device.phoneNumber !== undefined ? { phoneNumber: input.device.phoneNumber } : {}),
          ...(input.device.simSlot !== undefined ? { simSlot: input.device.simSlot } : {}),
          ...(input.device.subscriptionId !== undefined ? { subscriptionId: input.device.subscriptionId } : {}),
          ...(input.device.carrierName !== undefined ? { carrierName: input.device.carrierName } : {}),
          ...(input.device.iccId !== undefined ? { iccId: input.device.iccId } : {}),
          ...(input.device.automationSimConfigured !== undefined ? { automationSimConfigured: input.device.automationSimConfigured } : {}),
          status: "online",
          lastHeartbeatAt: now,
          lastSyncAt: now,
        };
        await db.device.update({ where: { id: device.id }, data: deviceUpdate });
        for (const tx of input.transactions) {
          const existing = tx.androidTransactionId
            ? await db.transaction.findFirst({
                where: { deviceId: device.id, androidTransactionId: tx.androidTransactionId },
                orderBy: { updatedAt: "desc" },
                select: { id: true },
              })
            : null;
          const data = {
            deviceId: device.id,
            androidTransactionId: tx.androidTransactionId,
            executionId: tx.executionId,
            operationId: tx.operationId,
            customerName: tx.customerName,
            phoneNumber: tx.phoneNumber,
            packageName: tx.packageName,
            amount: tx.amount.toFixed(2),
            paymentMethod: tx.paymentMethod as PaymentMethod | undefined,
            status: tx.status as TransactionStatus | undefined,
            verificationStatus: tx.verificationStatus as VerificationStatus | undefined,
            verificationMessage: tx.verificationMessage,
            receiptCode: tx.receiptCode,
            issue: tx.issue,
            executedAt: tx.executedAt,
          };
          if (existing) {
            await db.transaction.update({ where: { id: existing.id }, data });
          } else {
            await db.transaction.create({ data });
          }
        }
        await db.syncEvent.create({
          data: {
            deviceId: device.id,
            eventType: "HEARTBEAT",
            payload: { operationalStatus: input.operationalStatus, transactionCount: input.transactions.length },
            accepted: true,
          },
        });
        return { accepted: true as const, receivedAt: now.toISOString(), commandIds: [] as number[] };
      }),
  }),
});

export type AppRouter = typeof appRouter;
