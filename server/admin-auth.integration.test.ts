import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { authenticateAdmin, clearAdminSession, createAdminSession, getAdminFromRequest } from "./adminAuth";
import { hashPassword } from "./customerAuth";

const enabled = /^(postgresql|postgres):\/\//.test(process.env.DATABASE_URL ?? "");
const describeIfDatabase = enabled ? describe : describe.skip;
const email = `admin-auth-${Date.now()}@example.invalid`;

describeIfDatabase("native admin authentication", () => {
  let userId = 0;

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("authenticates an admin with a scrypt credential and resolves a secure session", async () => {
    const user = await prisma.user.create({
      data: {
        openId: `admin-auth-${Date.now()}`,
        email,
        name: "Integration Admin",
        loginMethod: "password",
        role: "admin",
        adminCredential: { create: { passwordHash: await hashPassword("correct admin password") } },
      },
    });
    userId = user.id;

    expect((await authenticateAdmin(email.toUpperCase(), "correct admin password"))?.id).toBe(user.id);
    expect(await authenticateAdmin(email, "wrong admin password")).toBeNull();

    const cookies: Record<string, string> = {};
    const req = { headers: { cookie: "" } } as any;
    const res = { cookie: (name: string, value: string) => { cookies[name] = value; }, clearCookie: () => undefined } as any;
    await createAdminSession(req, res, user.id);
    expect(cookies["__Secure-bingwa_admin_session"]).toBeTruthy();

    req.headers.cookie = `__Secure-bingwa_admin_session=${cookies["__Secure-bingwa_admin_session"]}`;
    expect((await getAdminFromRequest(req))?.id).toBe(user.id);
    await clearAdminSession(req, res);
    expect(await prisma.adminSession.count({ where: { userId } })).toBe(0);
  });
});
