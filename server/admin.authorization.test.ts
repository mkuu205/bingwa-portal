import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type TestUser = NonNullable<TrpcContext["user"]>;

function contextFor(role: "admin" | "user"): TrpcContext {
  const user: TestUser = {
    id: role === "admin" ? 901 : 902,
    openId: `admin-boundary-${role}`,
    email: `${role}@example.invalid`,
    name: role === "admin" ? "Test Admin" : "Test User",
    loginMethod: "test",
    role,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    lastSignedIn: new Date(0),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    databaseStatus: "up",
  };
}

describe("admin customer and audit workspace authorization", () => {
  it("requires authentication for the administrator workspace", async () => {
    const context = contextFor("user");
    context.user = null;
    const caller = appRouter.createCaller(context);
    await expect(caller.admin.customers({ page: 0 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("blocks a customer from listing the customer workspace", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.admin.customers({ page: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks a customer from reading the audit workspace", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.admin.auditLogs({ page: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an administrator through customer authorization before database access", async () => {
    const caller = appRouter.createCaller(contextFor("admin"));
    await expect(caller.admin.customers({ page: 0 })).rejects.toThrow("Database unavailable");
  });

  it("allows an administrator through audit authorization before database access", async () => {
    const caller = appRouter.createCaller(contextFor("admin"));
    await expect(caller.admin.auditLogs({ page: 0 })).rejects.toThrow("Database unavailable");
  });
});
