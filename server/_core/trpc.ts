import { DATABASE_UNAVAILABLE_ERR_MSG, NOT_ADMIN_ERR_MSG, NOT_AUTHENTICATED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: NOT_AUTHENTICATED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const requireCustomer = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.customer || ctx.customer.status !== "ACTIVE") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: NOT_AUTHENTICATED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      customer: ctx.customer,
    },
  });
});

export const customerProcedure = t.procedure.use(requireCustomer);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: NOT_AUTHENTICATED_ERR_MSG });
    }
    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    if (ctx.databaseStatus !== "up") {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: DATABASE_UNAVAILABLE_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
