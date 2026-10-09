import { hash, verify, Algorithm } from '@node-rs/argon2';

// Argon2id password hashing (OWASP-baseline parameters). Plaintext passwords are
// never stored; only the encoded hash (salt + params) is persisted.
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
};

export const MIN_PASSWORD_LENGTH = 12;

export function isPasswordAcceptable(password: string): boolean {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    // Malformed/absent hash must fail closed, never throw to the caller.
    return false;
  }
}
