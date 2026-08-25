// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  path: "/?view=customers",
  customers: { data: undefined as any, isLoading: false, error: null as Error | null },
  auditLogs: { data: undefined as any, isLoading: false, error: null as Error | null },
}));

vi.mock("wouter", () => ({ useLocation: () => [state.path, vi.fn()] }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    operations: { snapshot: { useQuery: vi.fn(() => ({ data: { counts: {} }, isLoading: false, error: null })) } },
    admin: {
      customers: { useQuery: vi.fn(() => state.customers) },
      auditLogs: { useQuery: vi.fn(() => state.auditLogs) },
      updateCustomerStatus: { useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })) },
    },
    useUtils: vi.fn(() => ({ products: { list: { invalidate: vi.fn() } }, operations: { snapshot: { invalidate: vi.fn() } } })),
  },
}));

import Home from "./src/pages/Home";

afterEach(() => {
  cleanup();
  state.path = "/?view=customers";
  state.customers = { data: undefined, isLoading: false, error: null };
  state.auditLogs = { data: undefined, isLoading: false, error: null };
});

describe("admin workspace UI states", () => {
  it("renders customer loading, error, empty, and populated states", () => {
    state.customers = { data: undefined, isLoading: true, error: null };
    const { unmount, rerender } = render(<Home />);
    expect(screen.getByText("Loading customers…")).toBeTruthy();

    state.customers = { data: undefined, isLoading: false, error: new Error("offline") };
    rerender(<Home />);
    expect(screen.getByText("Unable to load customers.")).toBeTruthy();

    state.customers = { data: { items: [], total: 0, page: 0, pageSize: 50 }, isLoading: false, error: null };
    rerender(<Home />);
    expect(screen.getByText("No customers found")).toBeTruthy();

    state.customers = { data: { items: [{ id: "c1", name: "Amina Client", email: "amina@example.invalid", phone: "0712345678", status: "ACTIVE", emailVerifiedAt: new Date(), createdAt: new Date(), _count: { devices: 1, subscriptions: 2 } }], total: 1, page: 0, pageSize: 50 }, isLoading: false, error: null };
    rerender(<Home />);
    expect(screen.getByText("Amina Client")).toBeTruthy();
    expect(screen.getByText(/amina@example.invalid/)).toBeTruthy();
    unmount();
  });

  it("renders audit loading, error, empty, populated, and pagination states", () => {
    state.path = "/?view=audit";
    state.auditLogs = { data: undefined, isLoading: true, error: null };
    const { rerender } = render(<Home />);
    expect(screen.getByText("Loading audit events…")).toBeTruthy();

    state.auditLogs = { data: undefined, isLoading: false, error: new Error("offline") };
    rerender(<Home />);
    expect(screen.getByText("Unable to load audit events.")).toBeTruthy();

    state.auditLogs = { data: { items: [], total: 0, page: 0, pageSize: 100 }, isLoading: false, error: null };
    rerender(<Home />);
    expect(screen.getByText("No audit events")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);

    state.auditLogs = { data: { items: [{ id: "a1", action: "CUSTOMER_STATUS_UPDATED", actorType: "ADMIN", actorUser: { email: "admin@example.invalid" }, actorCustomer: null, device: null, createdAt: new Date() }], total: 101, page: 0, pageSize: 100 }, isLoading: false, error: null };
    rerender(<Home />);
    expect(screen.getByText("CUSTOMER_STATUS_UPDATED")).toBeTruthy();
    expect(screen.getByText(/admin@example.invalid/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
