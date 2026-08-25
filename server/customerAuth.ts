import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Customer } from "@prisma/client";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { prisma } from "./prisma";
import { getSessionCookieOptions } from "./_core/cookies";

const scrypt = promisify(nodeScrypt);
export const CUSTOMER_SESSION_COOKIE = "__Host-bingwa_customer_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const EMAIL_TOKEN_TTL_MS = 1000 * 60 * 30;
const PASSWORD_RESET_TOKEN_TTL_MS = 1000 * 60 * 30;
const SCRYPT_KEY_LENGTH = 64;

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, encoded] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !encoded) return false;
  try {
    const expected = Buffer.from(encoded, "hex");
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function parseCookies(req: Request): Record<string, string> {
  return req.headers.cookie ? parseCookieHeader(req.headers.cookie) : {};
}

function setCustomerCookie(req: Request, res: Response, token: string, maxAge: number) {
  res.cookie(CUSTOMER_SESSION_COOKIE, token, {
    ...getSessionCookieOptions(req),
    maxAge,
  });
}

export async function createCustomerSession(req: Request, res: Response, customerId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.customerSession.create({
    data: { customerId, tokenHash: hashToken(token), expiresAt },
  });
  setCustomerCookie(req, res, token, SESSION_TTL_MS);
  return { expiresAt };
}

export async function getCustomerFromRequest(req: Request): Promise<Customer | null> {
  const token = parseCookies(req)[CUSTOMER_SESSION_COOKIE];
  if (!token) return null;
  const session = await prisma.customerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { customer: true },
  });
  if (!session || session.expiresAt <= new Date() || session.customer.status !== "ACTIVE") return null;
  await prisma.customerSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });
  return session.customer;
}

export async function clearCustomerSession(req: Request, res: Response) {
  const token = parseCookies(req)[CUSTOMER_SESSION_COOKIE];
  if (token) {
    await prisma.customerSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  setCustomerCookie(req, res, "", -1);
}

export async function createEmailVerificationToken(customerId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.emailVerificationToken.deleteMany({
    where: { customerId, consumedAt: null },
  });
  await prisma.emailVerificationToken.create({
    data: {
      customerId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
    },
  });
  return token;
}

export async function consumeEmailVerificationToken(token: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.consumedAt || record.expiresAt <= new Date()) return null;
  return prisma.$transaction(async tx => {
    const consumed = await tx.emailVerificationToken.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) return null;
    return tx.customer.update({
      where: { id: record.customerId },
      data: { emailVerifiedAt: new Date() },
    });
  });
}

export async function createPasswordResetToken(customerId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.deleteMany({ where: { customerId, consumedAt: null } });
  await prisma.passwordResetToken.create({
    data: {
      customerId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    },
  });
  return token;
}

export async function consumePasswordResetToken(token: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.consumedAt || record.expiresAt <= new Date()) return null;
  const passwordHash = await hashPassword(newPassword);
  return prisma.$transaction(async tx => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) return null;
    const customer = await tx.customer.update({ where: { id: record.customerId }, data: { passwordHash } });
    await tx.customerSession.deleteMany({ where: { customerId: customer.id } });
    return customer;
  });
}

export const customerEmail = normalizeEmail;
export { normalizeEmail };
