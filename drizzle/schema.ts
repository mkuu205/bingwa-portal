import {
  datetime,
  decimal,
  int,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 128 }).notNull().unique(),
  deviceName: varchar("deviceName", { length: 160 }).notNull(),
  model: varchar("model", { length: 160 }),
  manufacturer: varchar("manufacturer", { length: 120 }),
  androidVersion: varchar("androidVersion", { length: 40 }),
  sdkVersion: varchar("sdkVersion", { length: 40 }),
  appVersion: varchar("appVersion", { length: 80 }),
  appBuild: varchar("appBuild", { length: 40 }),
  phoneNumber: varchar("phoneNumber", { length: 40 }),
  simSlot: int("simSlot"),
  subscriptionId: int("subscriptionId"),
  carrierName: varchar("carrierName", { length: 120 }),
  iccId: varchar("iccId", { length: 160 }),
  automationSimConfigured: int("automationSimConfigured").default(0).notNull(),
  status: mysqlEnum("status", ["pending", "online", "idle", "offline", "blocked"]).default("pending").notNull(),
  lastHeartbeatAt: datetime("lastHeartbeatAt"),
  lastSyncAt: datetime("lastSyncAt"),
  enrollmentTokenHash: varchar("enrollmentTokenHash", { length: 128 }),
  enrolledAt: datetime("enrolledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  enrollmentLookupIdx: index("devices_enrollment_lookup_idx").on(table.deviceId, table.enrollmentTokenHash),
  heartbeatIdx: index("devices_heartbeat_idx").on(table.status, table.lastHeartbeatAt),
}));

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").references(() => devices.id),
  androidTransactionId: varchar("androidTransactionId", { length: 128 }),
  executionId: varchar("executionId", { length: 128 }),
  operationId: varchar("operationId", { length: 160 }),
  customerName: varchar("customerName", { length: 180 }),
  phoneNumber: varchar("phoneNumber", { length: 40 }).notNull(),
  packageName: varchar("packageName", { length: 160 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["MPESA", "AIRTEL_MONEY", "AIRTIME", "OTHER"]),
  status: mysqlEnum("status", ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "WAITING"]).default("PENDING").notNull(),
  verificationStatus: mysqlEnum("verificationStatus", ["NOT_REQUIRED", "PENDING", "VERIFIED", "FAILED"]),
  verificationMessage: text("verificationMessage"),
  receiptCode: varchar("receiptCode", { length: 120 }),
  issue: text("issue"),
  executedAt: datetime("executedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  transactionSearchIdx: index("transactions_search_idx").on(table.phoneNumber, table.status, table.createdAt),
  transactionDeviceIdx: index("transactions_device_idx").on(table.deviceId, table.createdAt),
}));

export const commands = mysqlTable("commands", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull().references(() => devices.id),
  commandType: varchar("commandType", { length: 80 }).notNull(),
  payload: json("payload"),
  status: mysqlEnum("status", ["QUEUED", "DELIVERED", "ACKNOWLEDGED", "EXECUTING", "SUCCEEDED", "FAILED", "EXPIRED"]).default("QUEUED").notNull(),
  requestedBy: int("requestedBy").references(() => users.id),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  deliveredAt: datetime("deliveredAt"),
  executedAt: datetime("executedAt"),
  resultMessage: text("resultMessage"),
  expiresAt: datetime("expiresAt"),
}, (table) => ({
  commandPollIdx: index("commands_poll_idx").on(table.deviceId, table.status, table.requestedAt),
  commandResultIdx: index("commands_result_idx").on(table.deviceId, table.id, table.status),
}));

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").references(() => devices.id),
  storeName: varchar("storeName", { length: 180 }).notNull(),
  ownerPhone: varchar("ownerPhone", { length: 40 }),
  planName: varchar("planName", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"]).default("TRIAL").notNull(),
  tokenBalance: int("tokenBalance").default(0).notNull(),
  renewalAt: datetime("renewalAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  subscriptionDeviceIdx: index("subscriptions_device_idx").on(table.deviceId, table.status),
}));

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  serviceKey: varchar("serviceKey", { length: 100 }).notNull().unique(),
  serviceName: varchar("serviceName", { length: 160 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["OPERATIONAL", "DEGRADED", "OUTAGE", "MAINTENANCE"]).default("OPERATIONAL").notNull(),
  lastCheckedAt: datetime("lastCheckedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const syncEvents = mysqlTable("sync_events", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull().references(() => devices.id),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  payload: json("payload"),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  accepted: int("accepted").default(1).notNull(),
  rejectionReason: text("rejectionReason"),
}, (table) => ({
  syncDeviceIdx: index("sync_events_device_idx").on(table.deviceId, table.receivedAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Command = typeof commands.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Service = typeof services.$inferSelect;
export type SyncEvent = typeof syncEvents.$inferSelect;
