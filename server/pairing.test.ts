import { describe, expect, it } from "vitest";
import { createDeviceCredential, createPairingMaterial, hashPairingSecret, normalizePairingCode } from "./pairing";

describe("pairing primitives", () => {
  it("normalizes human-entered pairing codes before hashing", () => {
    expect(normalizePairingCode(" ab12  cd ")).toBe("AB12CD");
    expect(hashPairingSecret("AB12CD")).toHaveLength(64);
  });

  it("creates high-entropy material without returning hashes as secrets", () => {
    const first = createPairingMaterial();
    const second = createPairingMaterial();
    expect(first.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(first.secret).toMatch(/^[a-f0-9]{64}$/);
    expect(first.codeHash).toBe(hashPairingSecret(first.code));
    expect(first.secretHash).toBe(hashPairingSecret(first.secret));
    expect(first.codeHash).not.toBe(first.code);
    expect(first.secretHash).not.toBe(first.secret);
    expect(`${first.code}:${first.secret}`).not.toBe(`${second.code}:${second.secret}`);
  });

  it("creates independently hashable device credentials", () => {
    const credential = createDeviceCredential();
    expect(credential.token).toMatch(/^[a-f0-9]{64}$/);
    expect(credential.tokenHash).toBe(hashPairingSecret(credential.token));
    expect(credential.tokenHash).not.toBe(credential.token);
  });
});
