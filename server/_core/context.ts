import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Customer, User } from "@prisma/client";
import { getCustomerFromRequest } from "../customerAuth";
import { getDatabaseStatus, type DatabaseStatus } from "../db";
import { getAdminFromRequest } from "../adminAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  customer?: Customer | null;
  databaseStatus: DatabaseStatus;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Legacy OAuth authentication remains optional and isolated from native auth.
    user = null;
  }

  try {
    user = (await getAdminFromRequest(opts.req)) ?? user;
  } catch {
    // Native admin authentication remains optional for public/customer requests.
  }

  const databaseStatus = await getDatabaseStatus();

  let customer = null;
  try {
    customer = await getCustomerFromRequest(opts.req);
  } catch {
    // Customer auth remains optional for public/admin requests when the database is unavailable.
    customer = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    customer,
    databaseStatus,
  };
}
