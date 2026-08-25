import { describe, expect, it, afterAll } from "vitest";
import { prisma } from "./prisma";
import { createCustomerSession, createEmailVerificationToken, consumeEmailVerificationToken, clearCustomerSession, hashPassword, getCustomerFromRequest } from "./customerAuth";

const enabled = /^(postgresql|postgres):\/\//.test(process.env.DATABASE_URL ?? "");
const describeIfDatabase = enabled ? describe : describe.skip;
const email = `vitest-customer-${Date.now()}@example.invalid`;

describeIfDatabase("native customer auth on PostgreSQL", () => {
  let customerId = "";

  afterAll(async () => {
    if (customerId) await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  it("consumes a single-use email token and resolves a secure session", async () => {
    const customer = await prisma.customer.create({
      data: { email, passwordHash: await hashPassword("correct horse battery staple"), name: "Vitest Customer" },
    });
    customerId = customer.id;

    const token = await createEmailVerificationToken(customer.id);
    const verified = await consumeEmailVerificationToken(token);
    expect(verified?.id).toBe(customer.id);
    expect(verified?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(await consumeEmailVerificationToken(token)).toBeNull();

    const cookieValues: Record<string, string> = {};
    const response = { cookie: (name: string, value: string) => { cookieValues[name] = value; }, clearCookie: () => undefined } as any;
    const request = { headers: { cookie: "" } } as any;
    await createCustomerSession(request, response, customer.id);
    expect(cookieValues["__Host-bingwa_customer_session"]).toBeTruthy();

    request.headers.cookie = `__Host-bingwa_customer_session=${cookieValues["__Host-bingwa_customer_session"]}`;
    const resolved = await getCustomerFromRequest(request);
    expect(resolved?.id).toBe(customer.id);
    await clearCustomerSession(request, response);
  });
});
