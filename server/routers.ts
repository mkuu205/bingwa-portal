import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PaymentMethod, type TransactionStatus, type VerificationStatus } from "@prisma/client";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { DATABASE_UNAVAILABLE_ERR_MSG, NOT_ADMIN_ERR_MSG } from "@shared/const";
import {
  getDb,
  authenticateDevice,
  getOperationsSnapshot,
  getQueuedCommandsForDevice,
  markCommandDelivered,
  searchTransactions,
  updateDeviceCommandResult,
  updateSubscriptionRecord,
  upsertPasswordUser,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, customerProcedure, publicProcedure, router } from "./_core/trpc";
import { createCustomerSession, clearCustomerSession, consumeEmailVerificationToken, createEmailVerificationToken, createPasswordResetToken, consumePasswordResetToken, customerEmail, hashPassword, verifyPassword } from "./customerAuth";
import { authenticateAdmin, clearAdminSession, createAdminSession } from "./adminAuth";
import { sendCustomerPasswordResetEmail, sendCustomerVerificationEmail } from "./email";
import { createDeviceCredential, createPairingMaterial, hashPairingSecret, normalizePairingCode } from "./pairing";
import { ENV } from "./_core/env";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const normalizeKenyanPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  throw new TRPCError({ code: "BAD_REQUEST", message: "Use a valid Kenyan phone number" });
};

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
  batteryPercent: z.number().int().min(0).max(100).optional(),
  airtimeBalance: z.number().nonnegative().optional(),
  availableTokens: z.number().int().nonnegative().optional(),
  commissionTotal: z.number().nonnegative().optional(),
  completedToday: z.number().int().nonnegative().optional(),
  pendingCount: z.number().int().nonnegative().optional(),
  scheduledCount: z.number().int().nonnegative().optional(),
  failedCount: z.number().int().nonnegative().optional(),
  successRate: z.number().min(0).max(100).optional(),
  automationEnabled: z.boolean().optional(),
  executionState: z.string().max(40).optional(),
  latencyMs: z.number().int().min(0).optional(),
});

const deviceDataPlanSyncInput = z.object({
  packageName: z.string().min(1).max(160),
  description: z.string().optional(),
  ussdCode: z.string().max(160).optional(),
  price: z.number().nonnegative().optional(),
  validity: z.string().max(80).optional(),
  dataAmount: z.string().max(80).optional(),
  category: z.string().max(100).optional(),
  isActive: z.boolean().default(true),
  commissionPerSale: z.number().nonnegative().optional(),
  executeSim: z.number().int().optional(),
  ussdMode: z.string().max(40).optional(),
  ussdSteps: z.string().optional(),
  source: z.string().max(40).optional(),
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
}).refine(
  value => Boolean(value.androidTransactionId || value.executionId || value.operationId),
  { message: "At least one Android transaction identity is required for projection" },
);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    adminMe: publicProcedure.query(opts => {
      if (opts.ctx.databaseStatus !== "up") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
      if (!opts.ctx.user && opts.ctx.customer) throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      return opts.ctx.user?.role === "admin" ? ({ id: opts.ctx.user.id, openId: opts.ctx.user.openId, name: opts.ctx.user.name, email: opts.ctx.user.email, role: opts.ctx.user.role }) : null;
    }),
    customerMe: publicProcedure.query(opts => opts.ctx.customer ?? null),
    adminLogin: publicProcedure
      .input(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.databaseStatus !== "up") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
        const user = await authenticateAdmin(input.email, input.password);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid administrator credentials" });
        await createAdminSession(ctx.req, ctx.res, user.id);
        return { success: true as const, admin: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),
    adminLogout: publicProcedure.mutation(async ({ ctx }) => {
      await clearAdminSession(ctx.req, ctx.res);
      return { success: true as const };
    }),
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
        await upsertPasswordUser({
          customerId: customer.id,
          email: customer.email,
          name: customer.name,
        });
        const token = await createEmailVerificationToken(customer.id);
        await sendCustomerVerificationEmail({ email: customer.email, name: customer.name, token });
        return { created: true as const, email: customer.email };
      }),
    loginCustomer: publicProcedure
      .input(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
        const customer = await db.customer.findUnique({ where: { email: customerEmail(input.email) } });
        if (!customer || !(await verifyPassword(input.password, customer.passwordHash)) || !customer.emailVerifiedAt || customer.status !== "ACTIVE") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials or unverified email" });
        }
        const lastSignedIn = new Date();
        await db.customer.update({ where: { id: customer.id }, data: { lastSignedInAt: lastSignedIn } });
        await upsertPasswordUser({
          customerId: customer.id,
          email: customer.email,
          name: customer.name,
          lastSignedIn,
        });
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
    resendCustomerVerification: publicProcedure
      .input(z.object({ email: z.string().email().max(320) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const customer = await db.customer.findUnique({ where: { email: customerEmail(input.email) } });
        if (customer && !customer.emailVerifiedAt && customer.status === "ACTIVE") {
          const token = await createEmailVerificationToken(customer.id);
          await sendCustomerVerificationEmail({ email: customer.email, name: customer.name, token });
        }
        return { requested: true as const };
      }),
    requestCustomerPasswordReset: publicProcedure
      .input(z.object({ email: z.string().email().max(320) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const customer = await db.customer.findUnique({ where: { email: customerEmail(input.email) } });
        if (!customer || customer.status !== "ACTIVE") return { requested: true as const };
        const token = await createPasswordResetToken(customer.id);
        await sendCustomerPasswordResetEmail({ email: customer.email, name: customer.name, token });
        return { requested: true as const };
      }),
    resetCustomerPassword: publicProcedure
      .input(z.object({ token: z.string().min(20).max(200), password: z.string().min(12).max(128) }))
      .mutation(async ({ input }) => {
        const customer = await consumePasswordResetToken(input.token, input.password);
        if (!customer) throw new Error("Password reset link is invalid or expired");
        return { reset: true as const };
      }),
    changeCustomerPassword: customerProcedure
      .input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) }))
      .mutation(async ({ input, ctx }) => {
        if (input.currentPassword === input.newPassword) throw new Error("New password must be different");
        if (!(await verifyPassword(input.currentPassword, ctx.customer.passwordHash))) throw new Error("Current password is incorrect");
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const passwordHash = await hashPassword(input.newPassword);
        await db.$transaction(async tx => {
          await tx.customer.update({ where: { id: ctx.customer.id }, data: { passwordHash } });
          await tx.customerSession.deleteMany({ where: { customerId: ctx.customer.id } });
        });
        await createCustomerSession(ctx.req, ctx.res, ctx.customer.id);
        return { changed: true as const };
      }),
    customerAccount: customerProcedure.query(({ ctx }) => ({
      id: ctx.customer.id,
      email: ctx.customer.email,
      name: ctx.customer.name,
      phone: ctx.customer.phone,
      emailVerifiedAt: ctx.customer.emailVerifiedAt,
    })),
    dashboard: customerProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [devices, subscriptions, transactions, plans] = await Promise.all([
        db.device.findMany({
          where: { customerId: ctx.customer.id },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true, deviceId: true, deviceName: true, model: true, manufacturer: true,
            androidVersion: true, appVersion: true, phoneNumber: true, simSlot: true,
            automationSimConfigured: true, batteryPercent: true, airtimeBalance: true, tokenBalance: true, commissionTotal: true, completedToday: true, pendingCount: true, scheduledCount: true, failedCount: true, successRate: true, automationEnabled: true, executionState: true, latencyMs: true,
            status: true, lastHeartbeatAt: true, lastSyncAt: true, enrolledAt: true,
          },
        }),
        db.subscription.findMany({ where: { customerId: ctx.customer.id }, orderBy: { updatedAt: "desc" }, take: 20 }),
        db.transaction.findMany({
          where: { device: { customerId: ctx.customer.id } }, orderBy: { createdAt: "desc" }, take: 50,
          select: { id: true, packageName: true, amount: true, status: true, verificationStatus: true, phoneNumber: true, createdAt: true, device: { select: { deviceName: true } } },
        }),
        db.product.findMany({
          where: { productType: "SUBSCRIPTION", status: "ACTIVE" },
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true, description: true, price: true, currency: true, durationDays: true, deviceLimit: true },
        }),
      ]);
      const devicePlans = devices.length === 0 ? [] : await db.deviceDataPlan.findMany({
        where: { deviceId: { in: devices.map(device => device.id) } },
        orderBy: { updatedAt: "desc" },
      });
      const counts = { completed: 0, pending: 0, scheduled: 0, failed: 0 };
      for (const transaction of transactions) {
        if (transaction.status === "COMPLETED") counts.completed += 1;
        else if (transaction.status === "FAILED") counts.failed += 1;
        else if (transaction.status === "WAITING") counts.scheduled += 1;
        else counts.pending += 1;
      }
      const selectedDevice = devices[0];
      const metrics = {
        airtimeBalance: selectedDevice?.airtimeBalance?.toString() ?? null,
        tokens: selectedDevice?.tokenBalance ?? subscriptions.reduce((total, subscription) => total + subscription.tokenBalance, 0),
        commissionTotal: selectedDevice?.commissionTotal?.toString() ?? null,
        completed: selectedDevice?.completedToday ?? counts.completed,
        pending: selectedDevice?.pendingCount ?? counts.pending,
        scheduled: selectedDevice?.scheduledCount ?? counts.scheduled,
        failed: selectedDevice?.failedCount ?? counts.failed,
        successRate: selectedDevice?.successRate?.toString() ?? (transactions.length ? ((counts.completed / transactions.length) * 100).toFixed(2) : null),
        automationEnabled: selectedDevice?.automationEnabled ?? null,
      };
      return {
        account: { id: ctx.customer.id, email: ctx.customer.email, name: ctx.customer.name, phone: ctx.customer.phone, emailVerifiedAt: ctx.customer.emailVerifiedAt },
        devices,
        subscriptions,
        plans: plans.map(plan => ({ ...plan, price: plan.price?.toString() ?? null })),
        devicePlans: devicePlans.map(plan => ({ ...plan, price: plan.price?.toString() ?? null, commissionPerSale: plan.commissionPerSale?.toString() ?? null })),
        transactions: transactions.map(transaction => ({ ...transaction, amount: transaction.amount.toString() })),
        tokens: metrics.tokens,
        metrics,
        counts,
      };
    }),
    activatePlan: customerProcedure
      .input(z.object({ productId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
        const product = await db.product.findFirst({ where: { id: input.productId, productType: "SUBSCRIPTION", status: "ACTIVE" } });
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Published subscription plan not found" });
        const numericPrice = product.price == null ? null : Number(product.price);
        const isFree = numericPrice == null || numericPrice === 0;
        if (numericPrice != null && (!Number.isFinite(numericPrice) || numericPrice < 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "This plan has an invalid price" });
        const renewalAt = product.durationDays ? new Date(Date.now() + product.durationDays * 86400000) : null;
        if (isFree) {
          const material = createPairingMaterial();
          const subscription = await db.$transaction(async tx => {
            const created = await tx.subscription.create({ data: { customerId: ctx.customer.id, productId: product.id, storeName: "Bingwa Portal", ownerPhone: ctx.customer.phone, planName: product.name, status: "ACTIVE", renewalAt } });
            await tx.pairingToken.create({ data: { customerId: ctx.customer.id, codeHash: material.codeHash, secretHash: material.secretHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
            await tx.auditLog.create({ data: { actorType: "CUSTOMER", actorCustomerId: ctx.customer.id, action: "FREE_PLAN_ACTIVATED", metadata: { productId: product.id, subscriptionId: created.id } } });
            return created;
          });
          return { kind: "FREE" as const, subscriptionId: subscription.id, planName: product.name, pairingCode: material.code, pairingSecret: material.secret, expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
        }
        if (numericPrice < 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Paid plans must be at least KES 1" });
        if (!ctx.customer.phone) throw new TRPCError({ code: "BAD_REQUEST", message: "Add a phone number to your account before paying for a plan" });
        if (!ENV.payflowApiKey || !ENV.payflowApiSecret || !ENV.payflowPaymentAccountId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payflow is not configured" });
        const idempotencyKey = `plan-${ctx.customer.id}-${product.id}-${randomBytes(12).toString("hex")}`;
        const payment = await db.bingwaPayment.create({ data: { customerId: ctx.customer.id, productId: product.id, idempotencyKey, phone: normalizeKenyanPhone(ctx.customer.phone), amount: numericPrice, currency: product.currency, status: "CREATED" } });
        try {
          const response = await fetch(`${ENV.payflowBaseUrl.replace(/\/$/, "")}/stkpush.php`, { method: "POST", headers: { "X-API-Key": ENV.payflowApiKey, "X-API-Secret": ENV.payflowApiSecret, "Content-Type": "application/json" }, body: JSON.stringify({ payment_account_id: Number(ENV.payflowPaymentAccountId), phone: normalizeKenyanPhone(ctx.customer.phone), amount: numericPrice, reference: payment.id, description: product.name }) });
          const result = await response.json() as { success?: boolean; message?: string; checkout_request_id?: string; merchant_request_id?: string; transaction_id?: number | string };
          if (!response.ok || !result.success || !result.checkout_request_id) throw new Error(result.message || "Payflow rejected the STK Push");
          await db.bingwaPayment.update({ where: { id: payment.id }, data: { status: "PENDING", checkoutRequestId: result.checkout_request_id, merchantRequestId: result.merchant_request_id, payflowTransactionId: result.transaction_id == null ? null : String(result.transaction_id) } });
          return { kind: "PAID" as const, paymentId: payment.id, checkoutRequestId: result.checkout_request_id, message: "STK Push sent. Complete the payment on your phone." };
        } catch (error) {
          await db.bingwaPayment.update({ where: { id: payment.id }, data: { status: "FAILED", failureMessage: error instanceof Error ? error.message : "Payflow request failed" } });
          throw new TRPCError({ code: "BAD_GATEWAY", message: "Unable to start Payflow payment" });
        }
      }),
    checkPayment: customerProcedure
      .input(z.object({ paymentId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
        const payment = await db.bingwaPayment.findFirst({ where: { id: input.paymentId, customerId: ctx.customer.id }, include: { product: true, entitlement: true } });
        if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
        if (!payment.checkoutRequestId) throw new TRPCError({ code: "BAD_REQUEST", message: "Payment has not started" });
        if (payment.status === "COMPLETED" && payment.entitlement) return { status: "COMPLETED" as const, subscriptionId: payment.entitlement.subscriptionId };
        if (!ENV.payflowApiKey || !ENV.payflowApiSecret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payflow is not configured" });
        try {
          const response = await fetch(`${ENV.payflowBaseUrl.replace(/\/$/, "")}/status.php`, { method: "POST", headers: { "X-API-Key": ENV.payflowApiKey, "X-API-Secret": ENV.payflowApiSecret, "Content-Type": "application/json" }, body: JSON.stringify({ checkout_request_id: payment.checkoutRequestId }) });
          const result = await response.json() as { success?: boolean; status?: string; mpesa_receipt?: string; message?: string };
          if (!response.ok || !result.success) throw new Error(result.message || "Payflow status request failed");
          const status = String(result.status || "pending").toLowerCase();
          if (status === "completed") {
            const activated = await db.$transaction(async tx => {
              const current = await tx.bingwaPayment.findUnique({ where: { id: payment.id }, include: { entitlement: true } });
              if (!current) throw new Error("Payment disappeared");
              if (current.status === "COMPLETED" && current.entitlement) return current.entitlement;
              const subscription = await tx.subscription.create({ data: { customerId: payment.customerId, productId: payment.productId, storeName: "Bingwa Portal", ownerPhone: payment.phone, planName: payment.product.name, status: "ACTIVE", renewalAt: payment.product.durationDays ? new Date(Date.now() + payment.product.durationDays * 86400000) : null } });
              const entitlement = await tx.entitlementGrant.create({ data: { paymentId: payment.id, customerId: payment.customerId, productId: payment.productId, subscriptionId: subscription.id } });
              await tx.bingwaPayment.update({ where: { id: payment.id }, data: { status: "COMPLETED", receiptCode: result.mpesa_receipt ?? null, completedAt: new Date(), activatedAt: new Date(), statusCheckedAt: new Date() } });
              await tx.auditLog.create({ data: { actorType: "CUSTOMER", actorCustomerId: payment.customerId, paymentId: payment.id, action: "SUBSCRIPTION_ACTIVATED", metadata: { subscriptionId: subscription.id, productId: payment.productId } } });
              return entitlement;
            });
            return { status: "COMPLETED" as const, subscriptionId: activated.subscriptionId };
          }
          const nextStatus = status === "failed" ? "FAILED" : status === "cancelled" ? "CANCELLED" : "PENDING";
          await db.bingwaPayment.update({ where: { id: payment.id }, data: { status: nextStatus, statusCheckedAt: new Date(), failureMessage: nextStatus === "FAILED" || nextStatus === "CANCELLED" ? result.message ?? null : undefined } });
          return { status: nextStatus as "PENDING" | "FAILED" | "CANCELLED" };
        } catch {
          throw new TRPCError({ code: "BAD_GATEWAY", message: "Unable to verify Payflow payment" });
        }
      }),
    createDeviceTransaction: customerProcedure
      .input(z.object({
        deviceId: z.number().int().positive(),
        planId: z.number().int().positive(),
        phoneNumber: z.string().min(7).max(40),
        simSlot: z.number().int().min(0).max(3).default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
        const phoneNumber = normalizeKenyanPhone(input.phoneNumber);
        return db.$transaction(async tx => {
          const device = await tx.device.findFirst({ where: { id: input.deviceId, customerId: ctx.customer.id }, select: { id: true, status: true } });
          if (!device) throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
          if (device.status !== "online") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Device is offline. Open BingwaAuto before running a transaction." });
          const plan = await tx.deviceDataPlan.findFirst({ where: { id: input.planId, deviceId: device.id, isActive: true } });
          if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Data plan is not available on this device" });
          if (!plan.ussdCode || !plan.price || plan.price.lessThanOrEqualTo(0)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This Android plan is missing a payable price or USSD code" });
          const operationId = randomBytes(16).toString("hex");
          const transaction = await tx.transaction.create({ data: {
            deviceId: device.id,
            operationId,
            customerName: ctx.customer.name,
            phoneNumber,
            packageName: plan.packageName,
            amount: plan.price,
            paymentMethod: "OTHER",
            status: "PENDING",
          }, select: { id: true, operationId: true, status: true, packageName: true, amount: true } });
          const command = await tx.command.create({ data: {
            deviceId: device.id,
            commandType: "QUEUE_PAYMENT",
            payload: {
              transactionId: transaction.id,
              operationId,
              executionId: operationId,
              phoneNumber,
              amount: Number(plan.price),
              packageName: plan.packageName,
              ussdCode: plan.ussdCode,
              ussdSteps: plan.ussdSteps,
              planId: plan.id,
              simSlot: input.simSlot,
            } as Prisma.InputJsonValue,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          }, select: { id: true, status: true } });
          await tx.auditLog.create({ data: { actorType: "CUSTOMER", actorCustomerId: ctx.customer.id, deviceId: device.id, action: "CUSTOMER_TRANSACTION_QUEUED", metadata: { transactionId: transaction.id, commandId: command.id, planId: plan.id } } });
          return { transaction: { ...transaction, amount: transaction.amount.toString() }, command };
        });
      }),
    enqueueCustomerCommand: customerProcedure
      .input(z.object({ deviceId: z.number().int().positive(), commandType: z.string().trim().min(1).max(80), payload: z.record(z.string(), z.unknown()).optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
        const device = await db.device.findFirst({ where: { id: input.deviceId, customerId: ctx.customer.id }, select: { id: true, status: true } });
        if (!device) throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
        if (device.status === "blocked") throw new TRPCError({ code: "FORBIDDEN", message: "This device is revoked" });
        const command = await db.command.create({ data: { deviceId: device.id, commandType: input.commandType, payload: input.payload as Prisma.InputJsonValue | undefined, expiresAt: new Date(Date.now() + 10 * 60 * 1000) }, select: { id: true, status: true } });
        await db.auditLog.create({ data: { actorType: "CUSTOMER", actorCustomerId: ctx.customer.id, deviceId: device.id, action: "CUSTOMER_COMMAND_QUEUED", metadata: { commandType: input.commandType, commandId: command.id } } });
        return command;
      }),
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
      const pairingUrl = new URL("/pair-device", ENV.appUrl);
      pairingUrl.searchParams.set("code", material.code);
      pairingUrl.searchParams.set("secret", material.secret);
      return { code: material.code, secret: material.secret, pairingUrl: pairingUrl.toString(), expiresAt };
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
  admin: router({
    customers: adminProcedure
      .input(z.object({ query: z.string().trim().max(160).optional(), status: z.enum(["ACTIVE", "SUSPENDED"]).optional(), page: z.number().int().min(0).default(0) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const where: Prisma.CustomerWhereInput = {
          status: input.status,
          OR: input.query ? [
            { email: { contains: input.query, mode: "insensitive" } },
            { name: { contains: input.query, mode: "insensitive" } },
            { phone: { contains: input.query } },
          ] : undefined,
        };
        const take = 50;
        const [items, total] = await Promise.all([
          db.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip: input.page * take, take, select: { id: true, email: true, name: true, phone: true, status: true, emailVerifiedAt: true, createdAt: true, _count: { select: { devices: true, subscriptions: true } } } }),
          db.customer.count({ where }),
        ]);
        return { items, total, page: input.page, pageSize: take };
      }),
    customerDetails: adminProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
        const customer = await db.customer.findUnique({
          where: { id: input.id },
          select: {
            id: true, email: true, name: true, phone: true, status: true, emailVerifiedAt: true, createdAt: true, lastSignedInAt: true,
            devices: { orderBy: { updatedAt: "desc" }, select: { id: true, deviceId: true, deviceName: true, status: true, lastHeartbeatAt: true } },
            subscriptions: { orderBy: { createdAt: "desc" }, select: { id: true, planName: true, status: true, tokenBalance: true, renewalAt: true, createdAt: true } },
            payments: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, amount: true, status: true, createdAt: true, receiptCode: true } },
          },
        });
        if (!customer) return null;
        const transactions = customer.phone
          ? await db.transaction.findMany({ where: { phoneNumber: customer.phone }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, packageName: true, amount: true, status: true, verificationStatus: true, createdAt: true } })
          : [];
        return { ...customer, transactions };
      }),
    updateCustomerStatus: adminProcedure
      .input(z.object({ id: z.string().min(1), status: z.enum(["ACTIVE", "SUSPENDED"]) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const result = await db.$transaction(async tx => {
          const customer = await tx.customer.update({ where: { id: input.id }, data: { status: input.status } });
          await tx.auditLog.create({ data: { actorType: "ADMIN", actorUserId: ctx.user.id, actorCustomerId: customer.id, action: "CUSTOMER_STATUS_UPDATED", metadata: { status: input.status } } });
          return customer;
        });
        return { success: true as const, customer: { id: result.id, status: result.status } };
      }),
    auditLogs: adminProcedure
      .input(z.object({ page: z.number().int().min(0).default(0), actorType: z.enum(["CUSTOMER", "ADMIN", "DEVICE", "SYSTEM"]).optional(), action: z.string().trim().max(120).optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const take = 100;
        const where: Prisma.AuditLogWhereInput = { actorType: input.actorType, action: input.action ? { contains: input.action, mode: "insensitive" } : undefined };
        const [items, total] = await Promise.all([
          db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: input.page * take, take, include: { actorUser: { select: { id: true, name: true, email: true } }, actorCustomer: { select: { id: true, email: true, name: true } }, device: { select: { id: true, deviceId: true, deviceName: true } } } }),
          db.auditLog.count({ where }),
        ]);
        return { items, total, page: input.page, pageSize: take };
      }),
  }),
  products: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.product.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }] });
    }),
    create: adminProcedure.input(z.object({
      productType: z.enum(["DEVICE", "SUBSCRIPTION"]),
      name: z.string().trim().min(1).max(160),
      slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
      description: z.string().trim().max(2000).optional(),
      price: z.number().finite().nonnegative().optional(),
      currency: z.string().trim().regex(/^[A-Z]{3}$/).default("KES"),
      durationDays: z.number().int().positive().optional(),
      deviceLimit: z.number().int().positive().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db.product.create({
        data: {
          productType: input.productType,
          name: input.name,
          slug: input.slug,
          description: input.description || null,
          price: input.price,
          currency: input.currency,
          durationDays: input.durationDays,
          deviceLimit: input.deviceLimit,
          createdBy: ctx.user.id,
        },
      });
    }),
    update: adminProcedure.input(z.object({
      id: z.string().min(1),
      productType: z.enum(["DEVICE", "SUBSCRIPTION"]).optional(),
      name: z.string().trim().min(1).max(160).optional(),
      slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180).optional(),
      description: z.string().trim().max(2000).nullable().optional(),
      price: z.number().finite().nonnegative().nullable().optional(),
      currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
      durationDays: z.number().int().positive().nullable().optional(),
      deviceLimit: z.number().int().positive().nullable().optional(),
      status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      const existing = await db.product.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return { success: false as const };
      return { success: true as const, product: await db.product.update({ where: { id }, data }) };
    }),
    archive: adminProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result = await db.product.updateMany({ where: { id: input.id }, data: { status: "ARCHIVED" } });
      return { success: result.count > 0 };
    }),
    remove: adminProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const product = await db.product.findUnique({ where: { id: input.id }, select: { id: true, _count: { select: { subscriptions: true, payments: true, entitlements: true } } } });
      if (!product) return { success: false as const, reason: "NOT_FOUND" as const };
      const used = product._count.subscriptions + product._count.payments + product._count.entitlements;
      if (used > 0) return { success: false as const, reason: "HAS_DEPENDENT_RECORDS" as const };
      await db.product.delete({ where: { id: input.id } });
      return { success: true as const };
    }),
  }),
  operations: router({
    snapshot: adminProcedure.query(async () => {
      try {
        return await getOperationsSnapshot();
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
      }
    }),
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
    renameDevice: adminProcedure
      .input(z.object({ id: z.number().int().positive(), deviceName: z.string().trim().min(1).max(160) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
        const result = await db.$transaction(async tx => {
          const device = await tx.device.update({ where: { id: input.id }, data: { deviceName: input.deviceName } });
          await tx.auditLog.create({ data: { actorType: "ADMIN", actorUserId: ctx.user.id, deviceId: device.id, action: "DEVICE_RENAMED", metadata: { deviceName: input.deviceName } } });
          return device;
        });
        return { success: true as const, device: { id: result.id, deviceName: result.deviceName } };
      }),
    revokeDevice: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
        const result = await db.$transaction(async tx => {
          const device = await tx.device.update({ where: { id: input.id }, data: { status: "blocked", enrollmentTokenHash: null } });
          await tx.deviceCredential.updateMany({ where: { deviceId: device.id, revokedAt: null }, data: { revokedAt: new Date(), rotatedAt: new Date() } });
          await tx.auditLog.create({ data: { actorType: "ADMIN", actorUserId: ctx.user.id, deviceId: device.id, action: "DEVICE_REVOKED" } });
          return device;
        });
        return { success: true as const, device: { id: result.id, status: result.status } };
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
          status: z.enum(["ACKNOWLEDGED", "EXECUTING", "SUCCEEDED", "COMPLETED", "FAILED", "EXPIRED"]),
          resultMessage: z.string().max(1000).optional(),
        }).refine(input => input.deviceToken || input.enrollmentToken, { message: "A device credential is required" })
      )
      .mutation(async ({ input }) => {
        const device = await authenticateDevice(input.deviceId, input.deviceToken ?? input.enrollmentToken ?? "");
        if (!device) return { accepted: false as const, reason: "INVALID_DEVICE_CREDENTIALS" };
        const normalizedStatus = input.status === "COMPLETED" ? "SUCCEEDED" : input.status;
        const updated = await updateDeviceCommandResult(device.id, input.commandId, normalizedStatus, input.resultMessage);
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
          dataPlans: z.array(deviceDataPlanSyncInput).max(500).optional(),
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
          ...(input.device.batteryPercent !== undefined ? { batteryPercent: input.device.batteryPercent } : {}),
          ...(input.device.airtimeBalance !== undefined ? { airtimeBalance: input.device.airtimeBalance } : {}),
          ...(input.device.availableTokens !== undefined ? { tokenBalance: input.device.availableTokens } : {}),
          ...(input.device.commissionTotal !== undefined ? { commissionTotal: input.device.commissionTotal } : {}),
          ...(input.device.completedToday !== undefined ? { completedToday: input.device.completedToday } : {}),
          ...(input.device.pendingCount !== undefined ? { pendingCount: input.device.pendingCount } : {}),
          ...(input.device.scheduledCount !== undefined ? { scheduledCount: input.device.scheduledCount } : {}),
          ...(input.device.failedCount !== undefined ? { failedCount: input.device.failedCount } : {}),
          ...(input.device.successRate !== undefined ? { successRate: input.device.successRate } : {}),
          ...(input.device.automationEnabled !== undefined ? { automationEnabled: input.device.automationEnabled } : {}),
          ...(input.device.executionState !== undefined ? { executionState: input.device.executionState } : {}),
          ...(input.device.latencyMs !== undefined ? { latencyMs: input.device.latencyMs } : {}),
          status: "online",
          lastHeartbeatAt: now,
          lastSyncAt: now,
        };
        await db.device.update({ where: { id: device.id }, data: deviceUpdate });
        if (input.dataPlans) {
          for (const plan of input.dataPlans) {
            await db.deviceDataPlan.upsert({
              where: { deviceId_packageName: { deviceId: device.id, packageName: plan.packageName } },
              create: { deviceId: device.id, ...plan, price: plan.price == null ? null : plan.price.toFixed(2), commissionPerSale: plan.commissionPerSale == null ? null : plan.commissionPerSale.toFixed(2) },
              update: { ...plan, price: plan.price == null ? null : plan.price.toFixed(2), commissionPerSale: plan.commissionPerSale == null ? null : plan.commissionPerSale.toFixed(2) },
            });
          }
        }
        for (const tx of input.transactions) {
          const projectionKey = tx.androidTransactionId
            ? `${device.id}:${tx.androidTransactionId}`
            : undefined;
          const data = {
            deviceId: device.id,
            androidTransactionId: tx.androidTransactionId,
            projectionKey,
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
          if (projectionKey) {
            await db.transaction.upsert({
              where: { projectionKey },
              create: data,
              update: data,
            });
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
