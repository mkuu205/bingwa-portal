import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Customer, User } from "@prisma/client";
import { getCustomerFromRequest } from "../customerAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  customer?: Customer | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

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
  };
}
