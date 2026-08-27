import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { prisma } from "./prisma";
import { customerEmail, hashPassword, verifyPassword } from "./customerAuth";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";

export const ADMIN_SESSION_COOKIE = "__Secure-bingwa_admin_session";
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const normalizeAdminEmail = customerEmail;

function cookies(req: Request) {
  return req.headers.cookie ? parseCookieHeader(req.headers.cookie) : {};
}

function setAdminCookie(req: Request, res: Response, token: string, maxAge: number) {
  res.cookie(ADMIN_SESSION_COOKIE, token, {
    ...getSessionCookieOptions(req),
    sameSite: "lax",
    maxAge,
  });
}

export async function bootstrapAdminFromEnvironment() {
  const configuredEmail = ENV.adminEmail.trim();
  const configuredPassword = ENV.adminPassword;
  if (!configuredEmail && !configuredPassword) return { bootstrapped: false, reason: "not_configured" as const };
  if (!configuredEmail || !configuredPassword) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be configured together");
  if (configuredPassword.length < 1 || configuredPassword.length > 128) throw new Error("ADMIN_PASSWORD must be between 1 and 128 characters");

  const email = normalizeAdminEmail(configuredEmail);
  const existing = await prisma.user.findFirst({ where: { email }, include: { adminCredential: true }, orderBy: { createdAt: "asc" } });
  if (existing && existing.role !== "admin") {
    throw new Error("ADMIN_EMAIL belongs to a non-admin user; refusing to elevate it automatically");
  }

  const passwordHash = await hashPassword(configuredPassword);
  const userId = existing?.id ?? (await prisma.user.create({
    data: {
      openId: `admin_${randomBytes(16).toString("hex")}`,
      email,
      name: ENV.adminName.trim() || "Bingwa Administrator",
      loginMethod: "password",
      role: "admin",
    },
  })).id;

  await prisma.adminCredential.upsert({
    where: { userId },
    create: { userId, passwordHash },
    update: existing?.adminCredential ? {} : { passwordHash },
  });
  return { bootstrapped: !existing, userId };
}

export async function authenticateAdmin(emailInput: string, password: string) {
  const email = normalizeAdminEmail(emailInput);
  const user = await prisma.user.findFirst({
    where: { email, role: "admin" },
    include: { adminCredential: true },
  });
  if (!user?.adminCredential || !(await verifyPassword(password, user.adminCredential.passwordHash))) return null;
  return user;
}

export async function createAdminSession(req: Request, res: Response, userId: number) {
  const token = randomBytes(32).toString("base64url");
  await prisma.adminSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS) },
  });
  setAdminCookie(req, res, token, ADMIN_SESSION_TTL_MS);
}

export async function getAdminFromRequest(req: Request) {
  const token = cookies(req)[ADMIN_SESSION_COOKIE];
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date() || session.user.role !== "admin") return null;
  await prisma.adminSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
  return session.user;
}

export async function clearAdminSession(req: Request, res: Response) {
  const token = cookies(req)[ADMIN_SESSION_COOKIE];
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  setAdminCookie(req, res, "", -1);
}

export const adminSessionTtlMs = ADMIN_SESSION_TTL_MS;
export const adminAppUrl = ENV.appUrl;
