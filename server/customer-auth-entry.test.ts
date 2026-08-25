import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const appSource = readFileSync(resolve(projectRoot, "client/src/App.tsx"), "utf8");
const navigationSource = readFileSync(resolve(projectRoot, "client/src/components/DashboardLayout.tsx"), "utf8");

describe("native customer authentication entry points", () => {
  it("routes the public root and short auth URLs to CustomerAuth", () => {
    expect(appSource).toContain('<Route path={"/"} component={CustomerAuth} />');
    expect(appSource).toContain('<Route path={"/login"} component={CustomerAuth} />');
    expect(appSource).toContain('<Route path={"/register"} component={CustomerAuth} />');
    expect(appSource).toContain('<Route path={"/forgot-password"} component={PasswordReset} />');
    expect(appSource).toContain('<Route path={"/resend-verification"} component={ResendVerification} />');
    expect(appSource).toContain('<Route path={"/change-password"} component={ChangePassword} />');
    expect(appSource).not.toContain('<Route path={"/"} component={Home} />');
  });

  it("keeps native verification and password procedures in the auth router", () => {
    const routerSource = readFileSync(resolve(projectRoot, "server/routers.ts"), "utf8");
    expect(routerSource).toContain("resendCustomerVerification: publicProcedure");
    expect(routerSource).toContain("requestCustomerPasswordReset: publicProcedure");
    expect(routerSource).toContain("resetCustomerPassword: publicProcedure");
    expect(routerSource).toContain("changeCustomerPassword: customerProcedure");
  });

  it("keeps the Manus-authenticated operations workspace behind /admin", () => {
    expect(appSource).toContain('<Route path={"/admin"} component={Home} />');
    expect(navigationSource).toContain('path: "/admin"');
    expect(navigationSource).toContain('path: "/admin?view=devices"');
    expect(navigationSource).not.toContain('path: "/?view=devices"');
  });
});
