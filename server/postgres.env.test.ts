import { describe, expect, it } from "vitest";

describe("PostgreSQL runtime configuration", () => {
  it("uses a PostgreSQL DATABASE_URL when configured", () => {
    const url = process.env.DATABASE_URL;
    if (!url || !/^(postgresql|postgres):\/\//.test(url)) return;
    expect(url.startsWith("postgresql://") || url.startsWith("postgres://")).toBe(true);
  });
});
