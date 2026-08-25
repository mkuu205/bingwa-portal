import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  commands,
  devices,
  InsertUser,
  services,
  subscriptions,
  syncEvents,
  transactions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOperationsSnapshot() {
  const db = await getDb();
  if (!db) return { devices: [], transactions: [], commands: [], subscriptions: [], services: [], counts: { devices: 0, onlineDevices: 0, transactions: 0, pendingTransactions: 0, failedTransactions: 0, queuedCommands: 0 } };
  const [deviceRows, transactionRows, commandRows, subscriptionRows, serviceRows] = await Promise.all([
    db.select().from(devices).orderBy(desc(devices.lastHeartbeatAt)).limit(50),
    db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(50),
    db.select().from(commands).orderBy(desc(commands.requestedAt)).limit(30),
    db.select().from(subscriptions).orderBy(desc(subscriptions.updatedAt)).limit(30),
    db.select().from(services).orderBy(services.serviceName),
  ]);
  const [[deviceCount], [onlineCount], [transactionCount], [pendingCount], [failedCount], [queuedCount]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(devices),
    db.select({ count: sql<number>`count(*)` }).from(devices).where(or(eq(devices.status, "online"), eq(devices.status, "idle"))),
    db.select({ count: sql<number>`count(*)` }).from(transactions),
    db.select({ count: sql<number>`count(*)` }).from(transactions).where(or(eq(transactions.status, "PENDING"), eq(transactions.status, "PROCESSING"), eq(transactions.status, "WAITING"))),
    db.select({ count: sql<number>`count(*)` }).from(transactions).where(eq(transactions.status, "FAILED")),
    db.select({ count: sql<number>`count(*)` }).from(commands).where(or(eq(commands.status, "QUEUED"), eq(commands.status, "DELIVERED"), eq(commands.status, "ACKNOWLEDGED"), eq(commands.status, "EXECUTING"))),
  ]);
  return {
    devices: deviceRows,
    transactions: transactionRows,
    commands: commandRows,
    subscriptions: subscriptionRows,
    services: serviceRows,
    counts: {
      devices: Number(deviceCount?.count ?? 0),
      onlineDevices: Number(onlineCount?.count ?? 0),
      transactions: Number(transactionCount?.count ?? 0),
      pendingTransactions: Number(pendingCount?.count ?? 0),
      failedTransactions: Number(failedCount?.count ?? 0),
      queuedCommands: Number(queuedCount?.count ?? 0),
    },
  };
}

export async function searchTransactions(query?: string) {
  const db = await getDb();
  if (!db) return [];
  if (!query?.trim()) return db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(100);
  const q = `%${query.trim()}%`;
  return db.select().from(transactions).where(or(like(transactions.phoneNumber, q), like(transactions.customerName, q), like(transactions.packageName, q), like(transactions.status, q), like(transactions.receiptCode, q))).orderBy(desc(transactions.createdAt)).limit(100);
}

export async function getDeviceByToken(deviceId: string, tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(devices).where(and(eq(devices.deviceId, deviceId), eq(devices.enrollmentTokenHash, tokenHash))).limit(1);
  return result[0];
}

export async function getQueuedCommandsForDevice(deviceId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(commands)
    .where(and(eq(commands.deviceId, deviceId), or(eq(commands.status, "QUEUED"), eq(commands.status, "DELIVERED"))))
    .orderBy(commands.requestedAt)
    .limit(Math.min(Math.max(limit, 1), 50));
}

export async function markCommandDelivered(deviceId: number, commandId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(commands)
    .set({ status: "DELIVERED", deliveredAt: new Date() })
    .where(and(eq(commands.id, commandId), eq(commands.deviceId, deviceId), eq(commands.status, "QUEUED")));
  return Number(result[0].affectedRows ?? 0) > 0;
}

export type CommandStatus = "QUEUED" | "DELIVERED" | "ACKNOWLEDGED" | "EXECUTING" | "SUCCEEDED" | "FAILED" | "EXPIRED";

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

export async function updateDeviceCommandResult(deviceId: number, commandId: number, status: Exclude<CommandStatus, "QUEUED" | "DELIVERED">, resultMessage?: string) {
  const db = await getDb();
  if (!db) return false;
  const current = await db.select({ status: commands.status }).from(commands)
    .where(and(eq(commands.id, commandId), eq(commands.deviceId, deviceId))).limit(1);
  const currentStatus = current[0]?.status as CommandStatus | undefined;
  if (!currentStatus || !isValidCommandStatusTransition(currentStatus, status)) return false;
  const terminal = ["SUCCEEDED", "FAILED", "EXPIRED"].includes(status);
  const result = await db.update(commands)
    .set({ status, resultMessage: resultMessage ?? null, executedAt: terminal ? new Date() : undefined })
    .where(and(eq(commands.id, commandId), eq(commands.deviceId, deviceId), eq(commands.status, currentStatus)));
  return Number(result[0].affectedRows ?? 0) > 0;
}

export async function updateSubscriptionRecord(id: number, patch: { status?: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED"; planName?: string; tokenBalance?: number; renewalAt?: Date | null }) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(subscriptions).set({ ...patch, updatedAt: new Date() }).where(eq(subscriptions.id, id));
  return Number(result[0].affectedRows ?? 0) > 0;
}
