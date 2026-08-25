import { createHash, randomBytes } from "node:crypto";

export const hashPairingSecret = (value: string) => createHash("sha256").update(value).digest("hex");

const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const randomPairingCode = (length = 8) => {
  const bytes = randomBytes(length);
  return Array.from(bytes, byte => PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length]).join("");
};

export function createPairingMaterial() {
  const code = randomPairingCode();
  const secret = randomBytes(32).toString("hex");
  return {
    code,
    secret,
    codeHash: hashPairingSecret(code),
    secretHash: hashPairingSecret(secret),
  };
}

export function createDeviceCredential() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashPairingSecret(token) };
}

export function normalizePairingCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}
