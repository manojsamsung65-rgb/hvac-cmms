// Pure RBAC policy. No I/O, no dependencies - fully unit-testable. This is the
// single source of truth for the role/action matrix enforced by middleware.

export type Role = 'super_admin' | 'admin' | 'supervisor' | 'technician' | 'read_only';

export type Action =
  | 'organization:create'
  | 'settings:manage'
  | 'users:manage'
  | 'sites:manage'
  | 'equipment:manage'
  | 'pm:manage'
  | 'workorders:manage'
  | 'workorders:update_assigned'
  | 'checklists:execute'
  | 'reports:view'
  | 'audit:view'
  | 'records:delete';

const SUPERVISOR: Action[] = [
  'sites:manage',
  'equipment:manage',
  'pm:manage',
  'workorders:manage',
  'workorders:update_assigned',
  'checklists:execute',
  'reports:view',
];

const TECHNICIAN: Action[] = [
  'workorders:update_assigned',
  'checklists:execute',
  'reports:view',
];

const READ_ONLY: Action[] = ['reports:view'];

const ALL: Action[] = [
  'organization:create',
  'settings:manage',
  'users:manage',
  'sites:manage',
  'equipment:manage',
  'pm:manage',
  'workorders:manage',
  'workorders:update_assigned',
  'checklists:execute',
  'reports:view',
  'audit:view',
  'records:delete',
];

// Admin: everything except creating new tenants (Super Admin only).
const ADMIN: Action[] = ALL.filter((a) => a !== 'organization:create');

const MATRIX: Record<Role, ReadonlySet<Action>> = {
  super_admin: new Set(ALL),
  admin: new Set(ADMIN),
  supervisor: new Set(SUPERVISOR),
  technician: new Set(TECHNICIAN),
  read_only: new Set(READ_ONLY),
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role]?.has(action) ?? false;
}

export function isRole(value: string): value is Role {
  return value in MATRIX;
}
