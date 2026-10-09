-- Replay protection for TOTP verification
ALTER TABLE "mfa_factors" ADD COLUMN "lastTotpStep" INTEGER;
