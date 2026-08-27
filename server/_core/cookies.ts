import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const production = ENV.isProduction;

  return {
    // __Host-bingwa_customer_session and __Host-oauth_state must never carry a Domain attribute.
    // Host-only cookies are correct for this single-origin Portal and prevent browsers from rejecting them.
    domain: undefined,
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: production || isSecureRequest(req),
  };
}
