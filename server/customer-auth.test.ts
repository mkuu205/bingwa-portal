import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./customerAuth";

describe("native customer authentication primitives", () => {
  it("hashes passwords with a non-reversible salted representation", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("rejects malformed or unsupported password hashes", async () => {
    expect(await verifyPassword("anything", "plain-text-password")).toBe(false);
    expect(await verifyPassword("anything", "bcrypt$salt$not-a-valid-scrypt-digest")).toBe(false);
  });
});
