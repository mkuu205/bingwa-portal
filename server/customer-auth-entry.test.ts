import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const appSource = readFileSync(resolve(projectRoot, "client/src/App.tsx"), "utf8");
const navigationSource = readFileSync(resolve(projectRoot, "client/src/components/DashboardLayout.tsx"), "utf8");
const adminLoginSource = readFileSync(resolve(projectRoot, "client/src/pages/AdminLogin.tsx"), "utf8");

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

  it("keeps the native administrator workspace behind /admin", () => {
    expect(appSource).toContain('<Route path={"/admin"} component={Home} />');
    expect(appSource).toContain('<Route path={"/admin/dashboard"} component={Home} />');
    for (const path of ["devices", "transactions", "commands", "services", "subscriptions", "products", "customers", "audit", "settings"]) {
      expect(appSource).toContain(`<Route path={"/admin/${path}"} component={Home} />`);
    }
    expect(navigationSource).toContain("<AdminLogin />");
    expect(adminLoginSource).toContain("trpc.auth.adminLogin.useMutation");
    expect(adminLoginSource).toContain("Administrator Login");
    expect(navigationSource).not.toContain("startLogin");
    expect(readFileSync(resolve(projectRoot, "client/src/pages/Home.tsx"), "utf8")).not.toContain("This workspace requires an administrator account or the operations database is unavailable.");
    expect(navigationSource).toContain('path: "/admin"');
    expect(navigationSource).toContain('path: "/admin/devices"');
    expect(navigationSource).not.toContain('path: "/?view=devices"');
  });
});
