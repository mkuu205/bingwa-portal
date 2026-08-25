import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { prisma } from "./prisma";
import { hashPairingSecret } from "./pairing";

type TestCustomer = NonNullable<TrpcContext["customer"]>;

function customerContext(customer: TestCustomer): TrpcContext {
  return {
    customer,
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const hasPostgres = /^(postgresql|postgres):\/\//.test(process.env.DATABASE_URL ?? "");

describe.skipIf(!hasPostgres)("live PostgreSQL customer pairing", () => {
  it("claims a device once, authenticates heartbeat with the rotated credential, and revokes it on unpair", async () => {
    const suffix = randomUUID();
    const email = `pairing-${suffix}@example.com`;
    const secondEmail = `pairing-second-${suffix}@example.com`;
    const deviceKey = `pairing-device-${suffix}`;
    let customerId: number | undefined;
    let secondCustomerId: number | undefined;
    let deviceId: number | undefined;
    let pairingId: number | undefined;
    let secondPairingId: number | undefined;
      let rotationPairingId: number | undefined;

    try {
      const customer = await prisma.customer.create({
        data: { email, passwordHash: "integration-test-hash", name: "Pairing Test Customer", phone: "254700000001" },
      });
      customerId = customer.id;
      const secondCustomer = await prisma.customer.create({
        data: { email: secondEmail, passwordHash: "integration-test-hash", name: "Second Pairing Customer", phone: "254700000002" },
      });
      secondCustomerId = secondCustomer.id;

      const owner = appRouter.createCaller(customerContext(customer));
      const secondOwner = appRouter.createCaller(customerContext(secondCustomer));
      const device = appRouter.createCaller({
        customer: null,
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      });

      const material = await owner.auth.createPairingToken();
      const storedPairing = await prisma.pairingToken.findFirst({ where: { customerId, consumedAt: null } });
      pairingId = storedPairing?.id;
      expect(storedPairing?.codeHash).toBe(hashPairingSecret(material.code));
      expect(storedPairing?.secretHash).toBe(hashPairingSecret(material.secret));

      const claimed = await device.deviceSync.pairDevice({
        code: material.code,
        secret: material.secret,
        device: { deviceId: deviceKey, deviceName: "Paired Android Device", model: "Test Model", appVersion: "test" },
      });
      expect(claimed.accepted).toBe(true);
      if (!claimed.accepted) throw new Error("pairing did not return a device credential");
      deviceId = (await prisma.device.findUnique({ where: { deviceId: deviceKey }, select: { id: true } }))?.id;
      expect(deviceId).toBeDefined();

      await expect(device.deviceSync.pairDevice({
        code: material.code,
        secret: material.secret,
        device: { deviceId: `${deviceKey}-second-attempt`, deviceName: "Should Not Pair" },
      })).resolves.toMatchObject({ accepted: false, reason: "INVALID_OR_EXPIRED_PAIRING" });

      const listed = await owner.auth.devices();
      expect(listed).toHaveLength(1);
      expect(listed[0]?.deviceId).toBe(deviceKey);

      const heartbeat = await device.deviceSync.heartbeat({
        deviceId: deviceKey,
        deviceToken: claimed.deviceToken,
        device: { deviceName: "Updated Paired Android Device", appVersion: "test-2" },
        operationalStatus: "ready",
        transactions: [],
      });
      expect(heartbeat.accepted).toBe(true);

      await expect(device.deviceSync.heartbeat({
        deviceId: deviceKey,
        deviceToken: "0".repeat(32),
        device: {},
        transactions: [],
      })).resolves.toMatchObject({ accepted: false, reason: "INVALID_DEVICE_CREDENTIALS" });

      const rotationMaterial = await owner.auth.createPairingToken();
      const rotationStoredPairing = await prisma.pairingToken.findFirst({ where: { customerId, consumedAt: null }, orderBy: { createdAt: "desc" } });
      rotationPairingId = rotationStoredPairing?.id;
      const rotated = await device.deviceSync.pairDevice({
        code: rotationMaterial.code,
        secret: rotationMaterial.secret,
        device: { deviceId: deviceKey, deviceName: "Re-paired Android Device", model: "Rotated Model", appVersion: "test-3" },
      });
      expect(rotated.accepted).toBe(true);
      if (!rotated.accepted) throw new Error("credential rotation did not return a new device credential");
      await expect(device.deviceSync.heartbeat({ deviceId: deviceKey, deviceToken: claimed.deviceToken, device: {}, transactions: [] })).resolves.toMatchObject({ accepted: false, reason: "INVALID_DEVICE_CREDENTIALS" });
      await expect(device.deviceSync.heartbeat({ deviceId: deviceKey, deviceToken: rotated.deviceToken, device: {}, transactions: [] })).resolves.toMatchObject({ accepted: true });

      const secondMaterial = await secondOwner.auth.createPairingToken();
      const secondStoredPairing = await prisma.pairingToken.findFirst({ where: { customerId: secondCustomerId, consumedAt: null } });
      secondPairingId = secondStoredPairing?.id;
      await expect(device.deviceSync.pairDevice({
        code: secondMaterial.code,
        secret: secondMaterial.secret,
        device: { deviceId: deviceKey, deviceName: "Conflicting Owner" },
      })).resolves.toMatchObject({ accepted: false, reason: "DEVICE_ALREADY_OWNED" });

      await expect(owner.auth.unpairDevice({ deviceId: deviceId! })).resolves.toEqual({ success: true });
      await expect(device.deviceSync.heartbeat({
        deviceId: deviceKey,
        deviceToken: claimed.deviceToken,
        device: {},
        transactions: [],
      })).resolves.toMatchObject({ accepted: false, reason: "INVALID_DEVICE_CREDENTIALS" });
      await expect(owner.auth.devices()).resolves.toHaveLength(0);
    } finally {
      if (deviceId) {
        await prisma.deviceCredential.deleteMany({ where: { deviceId } });
        await prisma.pairingToken.deleteMany({ where: { deviceId } });
        await prisma.device.deleteMany({ where: { id: deviceId } });
      }
      if (pairingId) await prisma.pairingToken.deleteMany({ where: { id: pairingId } });
      if (secondPairingId) await prisma.pairingToken.deleteMany({ where: { id: secondPairingId } });
      if (rotationPairingId) await prisma.pairingToken.deleteMany({ where: { id: rotationPairingId } });
      if (secondCustomerId) await prisma.customer.deleteMany({ where: { id: secondCustomerId } });
      if (customerId) await prisma.customer.deleteMany({ where: { id: customerId } });
    }
  }, 30_000);

  afterAll(async () => prisma.$disconnect());
});

void randomUUID;
void hashPairingSecret;
