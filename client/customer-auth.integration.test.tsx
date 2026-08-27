// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let currentPath = "/customer/login";
let loginOptions: { onSuccess?: () => void } | undefined;
const navigate = vi.fn((path: string) => { currentPath = path; });

vi.mock("wouter", () => ({
  useLocation: () => [currentPath, navigate],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      loginCustomer: {
        useMutation: vi.fn((options: { onSuccess?: () => void }) => {
          loginOptions = options;
          return { mutate: vi.fn(() => options.onSuccess?.()), isPending: false };
        }),
      },
      registerCustomer: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      customerAccount: {
        useQuery: vi.fn(() => ({
          data: { name: "Router Customer", email: "router@example.invalid", phone: "0712345678" },
          isLoading: false,
          error: null,
        })),
      },
      dashboard: {
        useQuery: vi.fn(() => ({
          data: {
            account: { id: "customer-1", name: "Router Customer", email: "router@example.invalid", phone: "0712345678", emailVerifiedAt: new Date() },
            devices: [], subscriptions: [], plans: [], transactions: [], counts: { completed: 0, pending: 0, failed: 0 },
          },
          isLoading: false,
          error: null,
        })),
      },
      activatePlan: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false, data: undefined, error: null })),
      },
      customerLogout: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
    },
  },
}));

import CustomerAuth from "./src/pages/CustomerAuth";
import CustomerHome from "./src/pages/CustomerHome";

afterEach(() => {
  cleanup();
  currentPath = "/customer/login";
  loginOptions = undefined;
  navigate.mockClear();
});

describe("customer login browser flow", () => {
  it("submits login, navigates to /customer, and renders the authenticated destination", () => {
    render(<CustomerAuth />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "router@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(loginOptions).toBeDefined();
    expect(navigate).toHaveBeenCalledWith("/customer");
    expect(currentPath).toBe("/customer");

    render(<CustomerHome />);
    expect(screen.getByText("Welcome back, Router Customer")).toBeTruthy();
    expect(screen.getByText(/router@example\.invalid/)).toBeTruthy();
  });
});
