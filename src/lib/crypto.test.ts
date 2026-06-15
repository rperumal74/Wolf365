import { describe, it, expect } from "vitest";
import {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
  safeEqual,
} from "@/lib/crypto";

describe("crypto (AES-256-GCM)", () => {
  it("round-trips a string", () => {
    const plaintext = "super-secret-client-secret-value";
    const enc = encrypt(plaintext);
    expect(enc).not.toContain(plaintext);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decrypt(enc)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same");
    expect(decrypt(b)).toBe("same");
  });

  it("round-trips JSON secret bags", () => {
    const secrets = { clientId: "abc", refreshToken: "xyz", n: 42 };
    const enc = encryptJson(secrets);
    expect(decryptJson(enc)).toEqual(secrets);
  });

  it("rejects tampered ciphertext via the auth tag", () => {
    const enc = encrypt("integrity-protected");
    const parts = enc.split(":");
    // Flip a byte in the ciphertext segment.
    const data = Buffer.from(parts[3]!, "base64");
    data[0] = data[0]! ^ 0xff;
    parts[3] = data.toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("rejects malformed payloads", () => {
    expect(() => decrypt("not-a-valid-payload")).toThrow();
    expect(() => decrypt("v2:a:b:c")).toThrow();
  });

  it("safeEqual compares correctly", () => {
    expect(safeEqual("token", "token")).toBe(true);
    expect(safeEqual("token", "other")).toBe(false);
    expect(safeEqual("a", "ab")).toBe(false);
  });
});
