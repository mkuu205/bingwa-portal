import { describe, expect, it } from "vitest";
import { isValidCommandStatusTransition, type CommandStatus } from "./db";

const valid = (current: CommandStatus, next: CommandStatus) =>
  expect(isValidCommandStatusTransition(current, next)).toBe(true);

const invalid = (current: CommandStatus, next: CommandStatus) =>
  expect(isValidCommandStatusTransition(current, next)).toBe(false);

describe("device command lifecycle", () => {
  it("allows the normal queued-to-successful execution path", () => {
    valid("QUEUED", "DELIVERED");
    valid("DELIVERED", "ACKNOWLEDGED");
    valid("ACKNOWLEDGED", "EXECUTING");
    valid("EXECUTING", "SUCCEEDED");
  });

  it("allows device failure and expiry reports from active delivery states", () => {
    valid("DELIVERED", "FAILED");
    valid("ACKNOWLEDGED", "FAILED");
    valid("EXECUTING", "FAILED");
    valid("DELIVERED", "EXPIRED");
    valid("ACKNOWLEDGED", "EXPIRED");
    valid("EXECUTING", "EXPIRED");
  });

  it("rejects terminal-state regressions and impossible jumps", () => {
    invalid("SUCCEEDED", "EXECUTING");
    invalid("SUCCEEDED", "FAILED");
    invalid("FAILED", "SUCCEEDED");
    invalid("EXPIRED", "ACKNOWLEDGED");
    invalid("QUEUED", "SUCCEEDED");
    invalid("QUEUED", "EXECUTING");
  });

  it("keeps duplicate status reports idempotent", () => {
    valid("QUEUED", "QUEUED");
    valid("EXECUTING", "EXECUTING");
    valid("SUCCEEDED", "SUCCEEDED");
    valid("FAILED", "FAILED");
  });
});
