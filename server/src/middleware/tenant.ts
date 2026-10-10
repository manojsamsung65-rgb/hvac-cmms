import type { Request } from 'express';

// PLACEHOLDER - tenant scoping is NOT implemented. Intended contract: derive the
// organization id from the authenticated session (NEVER from client input such
// as a query/body parameter) and attach it to the request so the data-access
// layer can enforce it on every query.
export interface TenantContext {
  organizationId: string;
}

export function getTenant(_req: Request): TenantContext | null {
  return null;
}
