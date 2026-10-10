import type { Prisma } from '@prisma/client';
import { HttpError } from '../../middleware/errorHandler';
import type { EquipmentRepository, EquipmentListParams } from './repository';
import type { CreateEquipmentInput, UpdateEquipmentInput } from './schemas';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

function duplicateCode(): HttpError {
  return new HttpError(409, 'Equipment code already exists in this organisation', 'duplicate_code');
}

function notFound(): HttpError {
  return new HttpError(404, 'Equipment not found', 'not_found');
}

function invalidReference(): HttpError {
  return new HttpError(400, 'Referenced site or building is not in your organisation', 'invalid_reference');
}

function dateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function mapCreate(input: CreateEquipmentInput): Omit<Prisma.EquipmentUncheckedCreateInput, 'organizationId'> {
  return {
    code: input.code,
    name: input.name,
    category: input.category,
    siteId: input.siteId ?? null,
    buildingId: input.buildingId ?? null,
    location: input.location ?? null,
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    serialNumber: input.serialNumber ?? null,
    criticality: input.criticality,
    status: input.status,
    commissioningDate: dateOrNull(input.commissioningDate),
    warrantyProvider: input.warrantyProvider ?? null,
    warrantyStart: dateOrNull(input.warrantyStart),
    warrantyEnd: dateOrNull(input.warrantyEnd),
    maintenanceNotes: input.maintenanceNotes ?? null,
  };
}

function mapUpdate(input: UpdateEquipmentInput): Prisma.EquipmentUncheckedUpdateInput {
  const out: Prisma.EquipmentUncheckedUpdateInput = {};
  for (const key of [
    'code',
    'name',
    'category',
    'location',
    'manufacturer',
    'model',
    'serialNumber',
    'criticality',
    'status',
    'warrantyProvider',
    'maintenanceNotes',
    'siteId',
    'buildingId',
  ] as const) {
    if (key in input) {
      (out as Record<string, unknown>)[key] = input[key] ?? null;
    }
  }
  for (const key of ['commissioningDate', 'warrantyStart', 'warrantyEnd'] as const) {
    if (key in input) {
      (out as Record<string, unknown>)[key] = dateOrNull(input[key]);
    }
  }
  return out;
}

export function createEquipmentService(repo: EquipmentRepository) {
  async function assertReferences(organizationId: string, siteId?: string | null, buildingId?: string | null) {
    if (siteId) {
      const site = await repo.findSite(organizationId, siteId);
      if (!site) throw invalidReference();
    }
    if (buildingId) {
      const building = await repo.findBuilding(organizationId, buildingId);
      if (!building) throw invalidReference();
    }
  }

  return {
    async listSites(organizationId: string, page: number, pageSize: number) {
      return repo.listSites(organizationId, page, pageSize);
    },
    async createSite(organizationId: string, input: { name: string; code: string }) {
      try {
        return await repo.createSite(organizationId, input);
      } catch (err) {
        if (isUniqueViolation(err)) throw duplicateCode();
        throw err;
      }
    },
    async listBuildings(organizationId: string, page: number, pageSize: number) {
      return repo.listBuildings(organizationId, page, pageSize);
    },
    async createBuilding(organizationId: string, input: { siteId: string; name: string; code: string }) {
      const site = await repo.findSite(organizationId, input.siteId);
      if (!site) throw invalidReference();
      try {
        return await repo.createBuilding(organizationId, input);
      } catch (err) {
        if (isUniqueViolation(err)) throw duplicateCode();
        throw err;
      }
    },
    async list(organizationId: string, params: EquipmentListParams) {
      return repo.list(organizationId, params);
    },
    async getById(organizationId: string, id: string) {
      const found = await repo.findById(organizationId, id);
      if (!found) throw notFound();
      return found;
    },
    async create(organizationId: string, actorId: string, input: CreateEquipmentInput) {
      await assertReferences(organizationId, input.siteId, input.buildingId);
      try {
        return await repo.create(organizationId, mapCreate(input), actorId);
      } catch (err) {
        if (isUniqueViolation(err)) throw duplicateCode();
        throw err;
      }
    },
    async update(organizationId: string, actorId: string, id: string, input: UpdateEquipmentInput) {
      await assertReferences(organizationId, input.siteId, input.buildingId);
      try {
        const updated = await repo.update(organizationId, id, mapUpdate(input), actorId);
        if (!updated) throw notFound();
        return updated;
      } catch (err) {
        if (isUniqueViolation(err)) throw duplicateCode();
        throw err;
      }
    },
    async softDelete(organizationId: string, actorId: string, id: string) {
      const deleted = await repo.softDelete(organizationId, id, actorId, new Date());
      if (!deleted) throw notFound();
      return deleted;
    },
  };
}

export type EquipmentService = ReturnType<typeof createEquipmentService>;
