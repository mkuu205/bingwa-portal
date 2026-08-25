import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { prisma } from "./prisma";
import { searchTransactions } from "./db";

type TestUser = NonNullable<TrpcContext["user"]>;

function context(role: "admin" | "user", id = role === "admin" ? 901 : 902): TrpcContext {
  const user: TestUser = {
    id,
    openId: `postgres-lifecycle-${role}`,
    email: `${role}@example.com`,
    name: `Postgres ${role}`,
    loginMethod: "vitest",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const hasPostgres = /^(postgresql|postgres):\/\//.test(process.env.DATABASE_URL ?? "");

describe.skipIf(!hasPostgres)("live PostgreSQL Portal lifecycle", () => {
  it("persists and advances service, subscription, transaction, and command flows", async () => {
    const suffix = randomUUID();
    const deviceKey = `vitest-device-${suffix}`;
    const enrollmentToken = `vitest-token-${suffix}`;
    const serviceKey = `vitest-service-${suffix}`;
    const phoneNumber = `2547${suffix.replace(/-/g, "").slice(0, 8)}`;
    let userId: number | undefined;
    let deviceId: number | undefined;
    let serviceId: number | undefined;
    let subscriptionId: number | undefined;
    let transactionId: number | undefined;
    let commandId: number | undefined;

    try {
      const adminUser = await prisma.user.create({
        data: {
          openId: `postgres-lifecycle-admin-${suffix}`,
          email: `postgres-lifecycle-${suffix}@example.com`,
          name: "Postgres Lifecycle Admin",
          loginMethod: "vitest",
          role: "admin",
        },
      });
      userId = adminUser.id;

      const device = await prisma.device.create({
        data: {
          deviceId: deviceKey,
          deviceName: "Vitest PostgreSQL Device",
          enrollmentTokenHash: createHash("sha256").update(enrollmentToken).digest("hex"),
          status: "pending",
        },
      });
      deviceId = device.id;

      const service = await prisma.service.create({
        data: { serviceKey, serviceName: "Vitest Service", status: "OPERATIONAL" },
      });
      serviceId = service.id;

      const subscription = await prisma.subscription.create({
        data: {
          storeName: "Vitest Store",
          planName: "Vitest Plan",
          status: "TRIAL",
          deviceId,
        },
      });
      subscriptionId = subscription.id;

      const admin = appRouter.createCaller(context("admin", userId));
      const deviceCaller = appRouter.createCaller({
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      });

      await expect(admin.operations.updateService({ id: serviceId, status: "DEGRADED" })).resolves.toEqual({ success: true });
      await expect(
        admin.operations.updateSubscription({ id: subscriptionId, status: "ACTIVE", tokenBalance: 250 })
      ).resolves.toEqual({ success: true });

      const heartbeat = await deviceCaller.deviceSync.heartbeat({
        deviceId: deviceKey,
        enrollmentToken,
        device: { deviceName: "Vitest PostgreSQL Device", appVersion: "test" },
        operationalStatus: "ready",
        transactions: [
          {
            androidTransactionId: `android-${suffix}`,
            phoneNumber,
            packageName: "Vitest Package",
            amount: 19,
            status: "COMPLETED",
            verificationStatus: "NOT_REQUIRED",
            receiptCode: `R-${suffix.slice(0, 8)}`,
          },
        ],
      });
      expect(heartbeat.accepted).toBe(true);

      const persisted = await prisma.transaction.findFirst({ where: { deviceId, phoneNumber } });
      expect(persisted?.packageName).toBe("Vitest Package");
      transactionId = persisted?.id;
      expect(await searchTransactions(phoneNumber)).toHaveLength(1);

      const duplicateHeartbeat = {
        deviceId: deviceKey,
        enrollmentToken,
        device: { deviceName: "Vitest PostgreSQL Device", appVersion: "test" },
        operationalStatus: "ready",
        transactions: [{
          androidTransactionId: `android-${suffix}`,
          phoneNumber,
          packageName: "Vitest Package Updated",
          amount: 19,
          status: "COMPLETED" as const,
          verificationStatus: "NOT_REQUIRED" as const,
          receiptCode: `R-${suffix.slice(0, 8)}`,
        }],
      };
      await Promise.all([
        deviceCaller.deviceSync.heartbeat(duplicateHeartbeat),
        deviceCaller.deviceSync.heartbeat(duplicateHeartbeat),
      ]);
      await expect(prisma.transaction.count({ where: { projectionKey: `${deviceId}:android-${suffix}` } })).resolves.toBe(1);
      await expect(prisma.transaction.findUnique({ where: { id: transactionId } })).resolves.toMatchObject({ packageName: "Vitest Package Updated" });

      const queued = await admin.operations.enqueueCommand({
        deviceId,
        commandType: "REFRESH_STATUS",
        payload: { source: "vitest" },
      });
      commandId = queued.id;

      const polled = await deviceCaller.deviceSync.pollCommands({ deviceId: deviceKey, enrollmentToken });
      expect(polled.accepted).toBe(true);
      expect(polled.commands?.some(command => command.id === commandId)).toBe(true);

      for (const status of ["ACKNOWLEDGED", "EXECUTING", "SUCCEEDED"] as const) {
        await expect(
          deviceCaller.deviceSync.reportCommand({ deviceId: deviceKey, enrollmentToken, commandId, status })
        ).resolves.toEqual({ accepted: true });
      }

      await expect(prisma.service.findUnique({ where: { id: serviceId } })).resolves.toMatchObject({ status: "DEGRADED" });
      await expect(prisma.subscription.findUnique({ where: { id: subscriptionId } })).resolves.toMatchObject({ status: "ACTIVE", tokenBalance: 250 });
      await expect(prisma.command.findUnique({ where: { id: commandId } })).resolves.toMatchObject({ status: "SUCCEEDED" });
    } finally {
      if (transactionId) await prisma.transaction.deleteMany({ where: { id: transactionId } });
      if (commandId) await prisma.command.deleteMany({ where: { id: commandId } });
      if (deviceId) await prisma.syncEvent.deleteMany({ where: { deviceId } });
      if (subscriptionId) await prisma.subscription.deleteMany({ where: { id: subscriptionId } });
      if (deviceId) await prisma.device.deleteMany({ where: { id: deviceId } });
      if (serviceId) await prisma.service.deleteMany({ where: { id: serviceId } });
      if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    }
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
