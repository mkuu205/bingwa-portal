import {
  CommandStatus,
  Prisma,
  TransactionStatus,
  type User as PrismaUser,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { ENV } from "./_core/env";
import { prisma } from "./prisma";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const hasValidPostgresUrl = /^(postgresql|postgres):\/\//.test(process.env.DATABASE_URL ?? "");

export type InsertUser = {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: "user" | "admin";
  lastSignedIn?: Date;
};

export async function getDb() {
  if (!hasValidPostgresUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL must use the PostgreSQL protocol in production");
    }
    return null;
  }
  return prisma;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : undefined);
  await db.user.upsert({
    where: { openId: user.openId },
    create: {
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: role ?? "user",
      lastSignedIn: user.lastSignedIn ?? new Date(),
    },
    update: {
      ...(user.name !== undefined ? { name: user.name } : {}),
      ...(user.email !== undefined ? { email: user.email } : {}),
      ...(user.loginMethod !== undefined ? { loginMethod: user.loginMethod } : {}),
      ...(role !== undefined ? { role } : {}),
      lastSignedIn: user.lastSignedIn ?? new Date(),
    },
  });
}

export async function getUserByOpenId(openId: string): Promise<PrismaUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.user.findUnique({ where: { openId } })) ?? undefined;
}

const emptySnapshot = {
  devices: [],
  transactions: [],
  commands: [],
  subscriptions: [],
  services: [],
  counts: {
    devices: 0,
    onlineDevices: 0,
    transactions: 0,
    pendingTransactions: 0,
    failedTransactions: 0,
    queuedCommands: 0,
  },
};

export async function getOperationsSnapshot() {
  const db = await getDb();
  if (!db) return emptySnapshot;

  const [deviceRows, transactionRows, commandRows, subscriptionRows, serviceRows] = await Promise.all([
    db.device.findMany({ orderBy: { lastHeartbeatAt: "desc" }, take: 50 }),
    db.transaction.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.command.findMany({ orderBy: { requestedAt: "desc" }, take: 30 }),
    db.subscription.findMany({ orderBy: { updatedAt: "desc" }, take: 30 }),
    db.service.findMany({ orderBy: { serviceName: "asc" } }),
  ]);

  const [deviceCount, onlineCount, transactionCount, pendingCount, failedCount, queuedCount] = await Promise.all([
    db.device.count(),
    db.device.count({ where: { status: { in: ["online", "idle"] } } }),
    db.transaction.count(),
    db.transaction.count({ where: { status: { in: ["PENDING", "PROCESSING", "WAITING"] } } }),
    db.transaction.count({ where: { status: "FAILED" } }),
    db.command.count({ where: { status: { in: ["QUEUED", "DELIVERED", "ACKNOWLEDGED", "EXECUTING"] } } }),
  ]);

  return {
    devices: deviceRows,
    transactions: transactionRows,
    commands: commandRows,
    subscriptions: subscriptionRows,
    services: serviceRows,
    counts: {
      devices: deviceCount,
      onlineDevices: onlineCount,
      transactions: transactionCount,
      pendingTransactions: pendingCount,
      failedTransactions: failedCount,
      queuedCommands: queuedCount,
    },
  };
}

export async function searchTransactions(query?: string) {
  const db = await getDb();
  if (!db) return [];
  if (!query?.trim()) {
    return db.transaction.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  }

  const term = query.trim();
  const searchable: Prisma.TransactionWhereInput[] = [
    { phoneNumber: { contains: term, mode: "insensitive" } },
    { customerName: { contains: term, mode: "insensitive" } },
    { packageName: { contains: term, mode: "insensitive" } },
    { receiptCode: { contains: term, mode: "insensitive" } },
  ];
  if ((Object.values(TransactionStatus) as string[]).includes(term.toUpperCase())) {
    searchable.push({ status: term.toUpperCase() as TransactionStatus });
  }

  return db.transaction.findMany({
    where: { OR: searchable },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getDeviceByToken(deviceId: string, tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.device.findFirst({ where: { deviceId, enrollmentTokenHash: tokenHash } })) ?? undefined;
}

export async function getDeviceByCredential(deviceId: string, tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const credential = await db.deviceCredential.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      device: { deviceId },
    },
    include: { device: true },
  });
  if (!credential) return undefined;
  await db.deviceCredential.update({ where: { id: credential.id }, data: { lastUsedAt: new Date() } });
  return credential.device;
}

export async function authenticateDevice(deviceId: string, token: string) {
  const tokenHash = hashToken(token);
  return (await getDeviceByCredential(deviceId, tokenHash)) ?? (await getDeviceByToken(deviceId, tokenHash));
}

export async function getQueuedCommandsForDevice(deviceId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.command.findMany({
    where: { deviceId, status: { in: ["QUEUED", "DELIVERED"] } },
    orderBy: { requestedAt: "asc" },
    take: Math.min(Math.max(limit, 1), 50),
  });
}

export async function markCommandDelivered(deviceId: number, commandId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.command.updateMany({
    where: { id: commandId, deviceId, status: "QUEUED" },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
  return result.count > 0;
}

export type CommandStatusName = CommandStatus;

const COMMAND_STATUS_TRANSITIONS: Record<CommandStatus, readonly CommandStatus[]> = {
  QUEUED: ["QUEUED", "DELIVERED"],
  DELIVERED: ["DELIVERED", "ACKNOWLEDGED", "FAILED", "EXPIRED"],
  ACKNOWLEDGED: ["ACKNOWLEDGED", "EXECUTING", "FAILED", "EXPIRED"],
  EXECUTING: ["EXECUTING", "SUCCEEDED", "FAILED", "EXPIRED"],
  SUCCEEDED: ["SUCCEEDED"],
  FAILED: ["FAILED"],
  EXPIRED: ["EXPIRED"],
};

export function isValidCommandStatusTransition(current: CommandStatus, next: CommandStatus) {
  return COMMAND_STATUS_TRANSITIONS[current].includes(next);
}

export async function updateDeviceCommandResult(
  deviceId: number,
  commandId: number,
  status: Exclude<CommandStatus, "QUEUED" | "DELIVERED">,
  resultMessage?: string
) {
  const db = await getDb();
  if (!db) return false;

  const current = await db.command.findFirst({
    where: { id: commandId, deviceId },
    select: { status: true },
  });
  const currentStatus = current?.status;
  if (!currentStatus || !isValidCommandStatusTransition(currentStatus, status)) return false;

  const terminal = ["SUCCEEDED", "FAILED", "EXPIRED"].includes(status);
  const result = await db.command.updateMany({
    where: { id: commandId, deviceId, status: currentStatus },
    data: {
      status,
      resultMessage: resultMessage ?? null,
      ...(status === "ACKNOWLEDGED" ? { acknowledgedAt: new Date() } : {}),
      ...(terminal ? { executedAt: new Date() } : {}),
    },
  });
  return result.count > 0;
}

export async function updateSubscriptionRecord(
  id: number,
  patch: {
    status?: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";
    planName?: string;
    tokenBalance?: number;
    renewalAt?: Date | null;
  }
) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.subscription.updateMany({ where: { id }, data: patch });
  return result.count > 0;
}
