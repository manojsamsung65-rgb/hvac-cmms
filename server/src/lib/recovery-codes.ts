import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Single-use MFA recovery codes. Codes are shown to the user once (plaintext),
// while only their hashes are stored. A used code is removed from the set, so it
// cannot be replayed.
export const DEFAULT_RECOVERY_CODE_COUNT = 10;

function normalise(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function formatCode(): string {
  // 20 hex chars grouped as 4 groups of 5 for readability.
  const raw = randomBytes(10).toString('hex').toUpperCase();
  return raw.match(/.{1,5}/g)!.join('-');
}

export function generateRecoveryCodes(count: number = DEFAULT_RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => formatCode());
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalise(code)).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface ConsumeResult {
  ok: boolean;
  remaining: string[];
}

// Verifies a code against the stored hashes and returns the set with the matched
// code removed (single-use). A replayed code finds no match and is rejected.
export function consumeRecoveryCode(code: string, storedHashes: readonly string[]): ConsumeResult {
  const candidate = hashRecoveryCode(code);
  const index = storedHashes.findIndex((stored) => safeEqual(stored, candidate));
  if (index === -1) {
    return { ok: false, remaining: [...storedHashes] };
  }
  const remaining = [...storedHashes];
  remaining.splice(index, 1);
  return { ok: true, remaining };
}
