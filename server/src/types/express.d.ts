// Request augmentation for the authenticated context. Populated only once real
// authentication exists; optional for now.
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        organizationId: string;
        role: string;
      };
    }
  }
}

export {};
