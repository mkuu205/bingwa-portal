import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { prisma } from "./prisma";

type TestUser = NonNullable<TrpcContext["user"]>;

function context(role: "admin" | "user", id: number): TrpcContext {
  const user: TestUser = {
    id,
    openId: `products-${role}-${id}`,
    email: `${role}-${id}@example.com`,
    name: `Products ${role}`,
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

describe("live PostgreSQL product administration", () => {
  const productIds: string[] = [];
  const userIds = [981, 983];

  it("enforces admin access and persists optional pricing plus full edits", async () => {
    if (!process.env.POSTGRES_DATABASE_URL) throw new Error("POSTGRES_DATABASE_URL is required for this test");
    const suffix = randomUUID().slice(0, 8);
    await prisma.user.upsert({ where: { id: 981 }, update: { role: "admin" }, create: { id: 981, openId: `products-admin-981-${suffix}`, email: `products-admin-981-${suffix}@example.com`, name: "Products admin", role: "admin", loginMethod: "vitest" } });
    const admin = appRouter.createCaller(context("admin", 981));
    const user = appRouter.createCaller(context("user", 982));

    await expect(user.products.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    const created = await admin.products.create({
      productType: "SUBSCRIPTION",
      name: `Integration product ${suffix}`,
      slug: `integration-product-${suffix}`,
      description: "Owner-configured product",
    });
    productIds.push(created.id);
    expect(created.price).toBeNull();

    const updated = await admin.products.update({
      id: created.id,
      name: `Edited product ${suffix}`,
      slug: `edited-product-${suffix}`,
      description: "Edited description",
      price: 125,
      currency: "KES",
      durationDays: 30,
      deviceLimit: 2,
    });
    expect(updated.success).toBe(true);
    expect(updated.product?.price.toString()).toBe("125");
    expect(updated.product?.durationDays).toBe(30);
    expect(updated.product?.deviceLimit).toBe(2);

    const listed = await admin.products.list();
    const persisted = listed.find(product => product.id === created.id);
    expect(persisted?.name).toBe(`Edited product ${suffix}`);
    expect(persisted?.slug).toBe(`edited-product-${suffix}`);
    expect(persisted?.price?.toString()).toBe("125");
  }, 15_000);

  it("refuses deletion after a dependent subscription and allows deletion while unused", async () => {
    if (!process.env.POSTGRES_DATABASE_URL) throw new Error("POSTGRES_DATABASE_URL is required for this test");
    const suffix = randomUUID().slice(0, 8);
    await prisma.user.upsert({ where: { id: 983 }, update: { role: "admin" }, create: { id: 983, openId: `products-admin-983-${suffix}`, email: `products-admin-983-${suffix}@example.com`, name: "Products admin", role: "admin", loginMethod: "vitest" } });
    const admin = appRouter.createCaller(context("admin", 983));
    const created = await admin.products.create({
      productType: "DEVICE",
      name: `Deletion product ${suffix}`,
      slug: `deletion-product-${suffix}`,
    });
    productIds.push(created.id);
    const customer = await prisma.customer.create({
      data: { email: `product-${suffix}@example.com`, passwordHash: "integration", name: `Product client ${suffix}`, emailVerifiedAt: new Date() },
    });
    const device = await prisma.device.create({ data: { deviceId: `product-device-${suffix}`, deviceName: "Product integration device" } });
    await prisma.subscription.create({ data: { productId: created.id, customerId: customer.id, deviceId: device.id, storeName: "Integration", planName: created.name } });

    await expect(admin.products.remove({ id: created.id })).resolves.toEqual({ success: false, reason: "HAS_DEPENDENT_RECORDS" });
    await prisma.subscription.deleteMany({ where: { productId: created.id } });
    await prisma.device.delete({ where: { id: device.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await expect(admin.products.remove({ id: created.id })).resolves.toEqual({ success: true });
    productIds.splice(productIds.indexOf(created.id), 1);
  }, 15_000);

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });
});
