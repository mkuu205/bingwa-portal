import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

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
  const appUrl = new URL(ENV.appUrl);
  const production = ENV.isProduction;
  const requestHost = typeof req.get === "function" ? req.get("host") : undefined;
  const hostname = req.hostname ?? requestHost?.split(":")[0] ?? "";
  const localRequest = LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);

  return {
    domain: production && !localRequest ? appUrl.hostname : undefined,
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: production || isSecureRequest(req),
  };
}
