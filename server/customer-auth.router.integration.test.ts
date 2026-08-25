import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("./email", () => ({ sendCustomerVerificationEmail: vi.fn().mockResolvedValue(undefined) }));

import { appRouter } from "./routers";
import { prisma } from "./prisma";
import { createEmailVerificationToken, CUSTOMER_SESSION_COOKIE, getCustomerFromRequest, hashPassword } from "./customerAuth";

const enabled = Boolean(process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL);
const describeIfDatabase = enabled ? describe : describe.skip;
const email = `vitest-router-${Date.now()}@example.invalid`;

type CookieResponse = { cookie: (name: string, value: string) => void; clearCookie: (name: string) => void };
function makeContext(cookie = "") {
  const responseCookies: Record<string, string> = {};
  const res: CookieResponse = {
    cookie: (name, value) => { responseCookies[name] = value; },
    clearCookie: name => { delete responseCookies[name]; },
  };
  const req = { headers: { cookie } } as any;
  return { ctx: { req, res, user: null, customer: null } as any, responseCookies };
}

describeIfDatabase("customer auth router flow", () => {
  let customerId = "";

  afterAll(async () => {
    if (customerId) await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  it("registers, verifies, logs in, resolves the session, and logs out", async () => {
    const registration = makeContext();
    const registered = await appRouter.createCaller(registration.ctx).auth.registerCustomer({
      email,
      password: "correct horse battery staple",
      name: "Router Customer",
      phone: "0712345678",
    });
    expect(registered).toEqual({ created: true, email });

    const customer = await prisma.customer.findUnique({ where: { email } });
    expect(customer).toBeTruthy();
    customerId = customer!.id;
    expect(customer!.emailVerifiedAt).toBeNull();

    const rawToken = await createEmailVerificationToken(customerId);
    const verification = makeContext();
    const verified = await appRouter.createCaller(verification.ctx).auth.verifyCustomerEmail({ token: rawToken });
    expect(verified).toEqual({ verified: true, email });

    const login = makeContext();
    const signedIn = await appRouter.createCaller(login.ctx).auth.loginCustomer({ email, password: "correct horse battery staple" });
    expect(signedIn.success).toBe(true);
    expect(login.responseCookies[CUSTOMER_SESSION_COOKIE]).toBeTruthy();

    const sessionCookie = `${CUSTOMER_SESSION_COOKIE}=${login.responseCookies[CUSTOMER_SESSION_COOKIE]}`;
    const sessionContext = makeContext(sessionCookie);
    sessionContext.ctx.customer = await getCustomerFromRequest(sessionContext.ctx.req);
    const account = await appRouter.createCaller(sessionContext.ctx).auth.customerAccount();
    expect(account.email).toBe(email);
    expect(account.name).toBe("Router Customer");

    const logout = await appRouter.createCaller(sessionContext.ctx).auth.customerLogout();
    expect(logout).toEqual({ success: true });
    expect(await prisma.customerSession.count({ where: { customerId } })).toBe(0);
  });

  it("rejects login before email verification", async () => {
    const unverifiedEmail = `vitest-unverified-${Date.now()}@example.invalid`;
    const customer = await prisma.customer.create({
      data: { email: unverifiedEmail, passwordHash: await hashPassword("correct horse battery staple"), name: "Unverified" },
    });
    const context = makeContext();
    await expect(appRouter.createCaller(context.ctx).auth.loginCustomer({ email: unverifiedEmail, password: "correct horse battery staple" })).rejects.toThrow("Invalid credentials or unverified email");
    await prisma.customer.delete({ where: { id: customer.id } });
  });
});
