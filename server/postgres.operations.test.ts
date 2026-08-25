import { afterAll, describe, expect, it } from "vitest";
import {
  getOperationsSnapshot,
  getQueuedCommandsForDevice,
  searchTransactions,
  updateSubscriptionRecord,
} from "./db";
import { prisma } from "./prisma";

const hasPostgres = /^(postgresql|postgres):\/\//.test(process.env.DATABASE_URL ?? "");

describe.skipIf(!hasPostgres)("PostgreSQL Portal operation contracts", () => {
  it("reads migrated operational tables safely", async () => {
    const snapshot = await getOperationsSnapshot();
    expect(snapshot.counts.transactions).toBeGreaterThanOrEqual(0);
    expect(snapshot.counts.pendingTransactions).toBeGreaterThanOrEqual(0);
    expect(snapshot.counts.failedTransactions).toBeGreaterThanOrEqual(0);
    expect(snapshot.counts.queuedCommands).toBeGreaterThanOrEqual(0);
    expect(snapshot.counts.devices).toBeGreaterThanOrEqual(0);
    expect(await searchTransactions("0720000000")).toEqual([]);
    expect(await getQueuedCommandsForDevice(999999)).toEqual([]);
  }, 15_000);

  it("does not report a subscription update for a missing record", async () => {
    await expect(
      updateSubscriptionRecord(999999, { status: "ACTIVE" })
    ).resolves.toBe(false);
  }, 15_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
