import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type TestUser = NonNullable<TrpcContext["user"]>;
const hasPostgres = /^(postgresql|postgres):\/\//.test(process.env.DATABASE_URL ?? "");

function createContext(role: "admin" | "user"): TrpcContext {
  const user: TestUser = {
    id: role === "admin" ? 10 : 11,
    openId: `${role}-operations-test`,
    email: `${role}@example.com`,
    name: role === "admin" ? "Bingwa Admin" : "Bingwa User",
    loginMethod: "test",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Bingwa operations authorization", () => {
  it("blocks non-admin users from the operations snapshot", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.operations.snapshot()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it.skipIf(!hasPostgres)("allows an admin caller to reach the operations snapshot procedure", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const snapshot = await caller.operations.snapshot();

    expect(snapshot).toHaveProperty("devices");
    expect(snapshot).toHaveProperty("transactions");
    expect(snapshot).toHaveProperty("commands");
    expect(snapshot).toHaveProperty("counts");
  });
});

describe("Bingwa Android synchronization", () => {
  it.skipIf(!hasPostgres)("rejects an unknown device enrollment token without accepting data", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    const result = await caller.deviceSync.heartbeat({
      deviceId: "unknown-android-device",
      enrollmentToken: "invalid-enrollment-token",
      device: {
        deviceName: "Unknown Bingwa Android",
        appVersion: "test",
      },
      transactions: [],
      operationalStatus: "offline",
    });

    expect(result).toEqual({
      accepted: false,
      reason: "INVALID_DEVICE_CREDENTIALS",
    });
  });
});
