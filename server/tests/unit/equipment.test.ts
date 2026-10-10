import { describe, it, expect } from 'vitest';
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  listEquipmentQuerySchema,
  createSiteSchema,
} from '../../src/modules/equipment/schemas';
import { createEquipmentRepository } from '../../src/modules/equipment/repository';
import { can } from '../../src/auth/policy';
import type { PrismaClient } from '@prisma/client';

describe('equipment schemas', () => {
  it('accepts a minimal valid payload and applies defaults', () => {
    const parsed = createEquipmentSchema.parse({ code: 'CH-1', name: 'Chiller', category: 'Chiller' });
    expect(parsed.criticality).toBe('medium');
    expect(parsed.status).toBe('active');
  });

  it('rejects an invalid code', () => {
    expect(() => createEquipmentSchema.parse({ code: 'bad code', name: 'n', category: 'c' })).toThrow();
  });

  it('rejects unknown fields', () => {
    expect(() =>
      createEquipmentSchema.parse({ code: 'OK-1', name: 'n', category: 'c', surprise: true }),
    ).toThrow();
  });

  it('rejects a warranty end before the start', () => {
    expect(() =>
      createEquipmentSchema.parse({
        code: 'OK-2',
        name: 'n',
        category: 'c',
        warrantyStart: '2024-05-01',
        warrantyEnd: '2024-01-01',
      }),
    ).toThrow();
  });

  it('allows a partial update with no fields', () => {
    expect(updateEquipmentSchema.parse({})).toEqual({});
  });

  it('rejects an invalid enum value', () => {
    expect(() => createEquipmentSchema.parse({ code: 'OK-3', name: 'n', category: 'c', status: 'bogus' })).toThrow();
  });

  it('rejects an oversized page size and non-positive page', () => {
    expect(() => listEquipmentQuerySchema.parse({ pageSize: '1000' })).toThrow();
    expect(() => listEquipmentQuerySchema.parse({ page: '0' })).toThrow();
  });

  it('coerces includeDeleted to a boolean', () => {
    expect(listEquipmentQuerySchema.parse({ includeDeleted: 'true' }).includeDeleted).toBe(true);
    expect(listEquipmentQuerySchema.parse({ includeDeleted: 'false' }).includeDeleted).toBe(false);
  });

  it('rejects an unknown query parameter', () => {
    expect(() => listEquipmentQuerySchema.parse({ nope: '1' })).toThrow();
  });

  it('validates site codes', () => {
    expect(() => createSiteSchema.parse({ name: 'HQ', code: 'bad code' })).toThrow();
  });
});

describe('equipment repository tenant guard', () => {
  // The guard throws before any database access, so a stub client is sufficient.
  const repo = createEquipmentRepository({} as unknown as PrismaClient);

  it('refuses a query without an organisation scope', async () => {
    await expect(repo.list(undefined as unknown as string, { page: 1, pageSize: 20 })).rejects.toThrow(
      /Tenant scope is required/,
    );
  });

  it('refuses findById without an organisation scope', async () => {
    await expect(repo.findById(undefined as unknown as string, 'x')).rejects.toThrow(/Tenant scope is required/);
  });
});

describe('equipment RBAC policy additions', () => {
  it('lets every role view equipment', () => {
    for (const role of ['super_admin', 'admin', 'supervisor', 'technician', 'read_only'] as const) {
      expect(can(role, 'equipment:view')).toBe(true);
    }
  });

  it('restricts manage and delete appropriately', () => {
    expect(can('technician', 'equipment:manage')).toBe(false);
    expect(can('read_only', 'equipment:manage')).toBe(false);
    expect(can('supervisor', 'equipment:manage')).toBe(true);
    expect(can('supervisor', 'equipment:delete')).toBe(false);
    expect(can('admin', 'equipment:delete')).toBe(true);
  });
});
