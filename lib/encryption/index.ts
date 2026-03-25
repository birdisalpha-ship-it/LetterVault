/**
 * Encryption utilities for LetterVault.
 *
 * Confidential letters (FERPA-waived) must be encrypted so that even the
 * platform cannot serve their content directly to applicants — only to
 * verified institution inboxes.
 *
 * Phase 1 status: S3 server-side encryption (AES-256) is active at rest.
 * Client-side envelope encryption (AES-256-GCM + AWS KMS) is planned for
 * Phase 2 to achieve true zero-knowledge storage for confidential letters.
 *
 * @see https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html
 */

/**
 * The app-level encryption key used for symmetric operations.
 * Must be a 256-bit (32-byte) base64-encoded secret in production.
 * Generate with: openssl rand -base64 32
 */
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

/**
 * Derive a 256-bit AES key from the raw base64 ENCRYPTION_KEY env var.
 * Uses the Web Crypto API (available in Node.js 18+ and all modern runtimes).
 */
export async function getAesKey(): Promise<CryptoKey> {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  const raw = Buffer.from(ENCRYPTION_KEY, "base64");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypt an arbitrary buffer with AES-256-GCM.
 * Returns `[iv (12 bytes) | ciphertext]` concatenated as a single Uint8Array.
 *
 * TODO (Phase 2): wrap the AES key with AWS KMS before storing, so that
 * key material never touches the application server.
 */
export async function encryptBuffer(plaintext: Uint8Array): Promise<Uint8Array> {
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );
  const result = new Uint8Array(12 + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), 12);
  return result;
}

/**
 * Decrypt a buffer produced by `encryptBuffer`.
 * Expects the first 12 bytes to be the IV, followed by the ciphertext.
 */
export async function decryptBuffer(encrypted: Uint8Array): Promise<Uint8Array> {
  const key = await getAesKey();
  const iv = encrypted.slice(0, 12);
  const ciphertext = encrypted.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new Uint8Array(plaintext);
}
