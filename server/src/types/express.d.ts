import type { Role } from '../auth/policy';

// Request augmentation for the authenticated context. Populated by requireAuth.
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        organizationId: string;
        role: Role;
        aal: 'aal1' | 'aal2';
      };
    }
  }
}

export {};
