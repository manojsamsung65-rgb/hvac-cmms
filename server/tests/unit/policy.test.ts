import { describe, it, expect } from 'vitest';
import { can } from '../../src/auth/policy';

describe('RBAC policy', () => {
  it('only Super Admin may create a tenant', () => {
    expect(can('super_admin', 'organization:create')).toBe(true);
    expect(can('admin', 'organization:create')).toBe(false);
    expect(can('supervisor', 'organization:create')).toBe(false);
  });

  it('admins manage settings/users/audit; supervisors do not', () => {
    expect(can('admin', 'settings:manage')).toBe(true);
    expect(can('admin', 'audit:view')).toBe(true);
    expect(can('supervisor', 'settings:manage')).toBe(false);
    expect(can('supervisor', 'users:manage')).toBe(false);
  });

  it('technicians may only act on assigned work orders and checklists', () => {
    expect(can('technician', 'workorders:update_assigned')).toBe(true);
    expect(can('technician', 'checklists:execute')).toBe(true);
    expect(can('technician', 'workorders:manage')).toBe(false);
    expect(can('technician', 'records:delete')).toBe(false);
  });

  it('read-only users may only view reports', () => {
    expect(can('read_only', 'reports:view')).toBe(true);
    expect(can('read_only', 'equipment:manage')).toBe(false);
    expect(can('read_only', 'records:delete')).toBe(false);
  });

  it('only admins may delete records', () => {
    expect(can('admin', 'records:delete')).toBe(true);
    expect(can('supervisor', 'records:delete')).toBe(false);
    expect(can('technician', 'records:delete')).toBe(false);
  });
});
