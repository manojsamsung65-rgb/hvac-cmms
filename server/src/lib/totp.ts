import { authenticator } from 'otplib';

// TOTP (RFC 6238) for administrator MFA. Uses otplib's authenticator; no custom
// crypto. A +/-1 step window tolerates minor clock skew. `epoch` is optional and
// used only to make time-based behaviour deterministic in tests.
export const TOTP_STEP_SECONDS = 30;

function make(epoch?: number) {
  return authenticator.clone({ window: 1, ...(epoch ? { epoch } : {}) });
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpKeyUri(accountName: string, issuer: string, secret: string): string {
  return authenticator.keyuri(accountName, issuer, secret);
}

export function generateTotp(secret: string, epoch?: number): string {
  return make(epoch).generate(secret);
}

export function verifyTotp(secret: string, token: string, epoch?: number): boolean {
  if (!secret || !token) return false;
  try {
    return make(epoch).verify({ token, secret });
  } catch {
    return false;
  }
}

// The current TOTP time-step, used for replay protection.
export function currentTotpStep(epochMs: number = Date.now()): number {
  return Math.floor(epochMs / 1000 / TOTP_STEP_SECONDS);
}
