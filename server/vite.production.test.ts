import express from "express";
import { describe, expect, it } from "vitest";
import { serveStatic } from "./_core/vite";

describe("production static serving", () => {
  it("mounts without evaluating development-only Vite configuration", () => {
    const app = express();

    expect(() => serveStatic(app)).not.toThrow();
  });
});

export {};

// This test intentionally exercises only module loading and middleware registration.
// The production server's liveness contract is covered by health.test.ts.
void express;
void serveStatic;
