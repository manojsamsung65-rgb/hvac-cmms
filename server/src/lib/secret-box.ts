import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Authenticated encryption (AES-256-GCM) for secrets at rest (e.g. TOTP secrets).
// Format: v1.<iv>.<authTag>.<ciphertext>, all base64url. The key is supplied via
// environment configuration and must never be committed.
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export function parseKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`Encryption key must be ${KEY_BYTES} bytes (base64-encoded)`);
  }
  return key;
}

export function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = parseKey(keyBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(payload: string, keyBase64: string): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Unsupported secret format');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = parseKey(keyBase64);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export function isEncrypted(payload: string): boolean {
  return typeof payload === 'string' && payload.startsWith('v1.');
}
