import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getEnv } from "@/env";

/**
 * Application-level encryption for connector secrets and OAuth tokens.
 *
 * Algorithm: AES-256-GCM (authenticated encryption).
 * Key:       32-byte key from WOLF365_ENCRYPTION_KEY (base64).
 * Format:    "v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>"
 *
 * GCM provides confidentiality + integrity: tampering with the ciphertext or
 * IV causes decryption to throw, so we never act on corrupted secrets. The
 * version prefix allows future algorithm/key rotation without ambiguity.
 *
 * This is layered on top of Neon's encryption at rest, so secrets are
 * protected even if a raw database dump leaks.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const VERSION = "v1";

function getKey(): Buffer {
  const key = Buffer.from(getEnv().WOLF365_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    // env.ts already validates this; defensive double-check.
    throw new Error("Encryption key must be exactly 32 bytes");
  }
  return key;
}

/** Encrypt a UTF-8 string. Returns the versioned, self-describing ciphertext. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Decrypt a value produced by {@link encrypt}. Throws if tampered/invalid. */
export function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed or unsupported ciphertext");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64!, "base64");
  const authTag = Buffer.from(tagB64!, "base64");
  const data = Buffer.from(dataB64!, "base64");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

/** Encrypt a JSON-serializable object (e.g. a secrets bag). */
export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

/** Decrypt and parse a value produced by {@link encryptJson}. */
export function decryptJson<T = unknown>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}

/** Constant-time string comparison for tokens/HMACs. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
