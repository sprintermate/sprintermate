import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN   = 32; // 256-bit
const IV_LEN    = 12; // 96-bit — recommended for GCM
const TAG_LEN   = 16;

/**
 * Returns the 32-byte encryption key derived from the ENCRYPTION_KEY env var.
 * The env var can be any length; it is SHA-256 hashed to produce a fixed-size key.
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a plaintext string and returns a base64-encoded blob.
 * Format: base64(iv [12 bytes] + authTag [16 bytes] + ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv  = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Concatenate iv + tag + ciphertext then base64-encode
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypts a base64-encoded blob produced by `encrypt`.
 */
export function decrypt(blob: string): string {
  const key  = getKey();
  const data = Buffer.from(blob, 'base64');

  const iv         = data.subarray(0, IV_LEN);
  const tag        = data.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = data.subarray(IV_LEN + TAG_LEN);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
