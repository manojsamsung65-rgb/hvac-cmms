import type { Criticality, EquipmentStatus, Prisma, PrismaClient } from '@prisma/client';

export interface EquipmentListParams {
  page: number;
  pageSize: number;
  status?: EquipmentStatus;
  category?: string;
  criticality?: Criticality;
  siteId?: string;
  q?: string;
  includeDeleted?: boolean;
}

// Every read and write is scoped by this guard. A missing organisation scope is a
// programming error, not a user error, so it throws rather than silently returning
// cross-tenant data.
function requireOrg(organizationId: string | undefined | null): string {
  if (!organizationId) {
    throw new Error('Tenant scope is required: organizationId must be provided');
  }
  return organizationId;
}

// Prisma's Json input does not accept Date values; serialise records to plain JSON.
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function createEquipmentRepository(prisma: PrismaClient) {
  return {
    async listSites(organizationId: string, page: number, pageSize: number) {
      const org = requireOrg(organizationId);
      const where: Prisma.SiteWhereInput = { organizationId: org };
      const [data, total] = await Promise.all([
        prisma.site.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
        prisma.site.count({ where }),
      ]);
      return { data, total };
    },

    async createSite(organizationId: string, input: { name: string; code: string }) {
      const org = requireOrg(organizationId);
      return prisma.site.create({ data: { organizationId: org, name: input.name, code: input.code } });
    },

    async findSite(organizationId: string, siteId: string) {
      return prisma.site.findFirst({ where: { organizationId: requireOrg(organizationId), id: siteId } });
    },

    async listBuildings(organizationId: string, page: number, pageSize: number) {
      const org = requireOrg(organizationId);
      const where: Prisma.BuildingWhereInput = { organizationId: org };
      const [data, total] = await Promise.all([
        prisma.building.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
        prisma.building.count({ where }),
      ]);
      return { data, total };
    },

    async createBuilding(organizationId: string, input: { siteId: string; name: string; code: string }) {
      const org = requireOrg(organizationId);
      return prisma.building.create({
        data: { organizationId: org, siteId: input.siteId, name: input.name, code: input.code },
      });
    },

    async findBuilding(organizationId: string, buildingId: string) {
      return prisma.building.findFirst({ where: { organizationId: requireOrg(organizationId), id: buildingId } });
    },

    async list(organizationId: string, p: EquipmentListParams) {
      const org = requireOrg(organizationId);
      const where: Prisma.EquipmentWhereInput = { organizationId: org };
      if (!p.includeDeleted) where.deletedAt = null;
      if (p.status) where.status = p.status;
      if (p.criticality) where.criticality = p.criticality;
      if (p.category) where.category = p.category;
      if (p.siteId) where.siteId = p.siteId;
      if (p.q) {
        where.OR = [
          { code: { contains: p.q, mode: 'insensitive' } },
          { name: { contains: p.q, mode: 'insensitive' } },
          { serialNumber: { contains: p.q, mode: 'insensitive' } },
        ];
      }
      const [data, total] = await Promise.all([
        prisma.equipment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (p.page - 1) * p.pageSize,
          take: p.pageSize,
        }),
        prisma.equipment.count({ where }),
      ]);
      return { data, total };
    },

    async findById(organizationId: string, id: string, opts?: { includeDeleted?: boolean }) {
      const where: Prisma.EquipmentWhereInput = { organizationId: requireOrg(organizationId), id };
      if (!opts?.includeDeleted) where.deletedAt = null;
      return prisma.equipment.findFirst({ where });
    },

    // Create + audit are written in one transaction: if the audit insert fails, the
    // equipment row is rolled back (and vice versa).
    async create(organizationId: string, data: Omit<Prisma.EquipmentUncheckedCreateInput, 'organizationId'>, actorId: string) {
      const org = requireOrg(organizationId);
      return prisma.$transaction(async (tx) => {
        const created = await tx.equipment.create({ data: { ...data, organizationId: org, createdBy: actorId } });
        await tx.auditLog.create({
          data: {
            organizationId: org,
            actorId,
            action: 'equipment.create',
            entityType: 'equipment',
            entityId: created.id,
            after: toJson(created),
          },
        });
        return created;
      });
    },

    async update(
      organizationId: string,
      id: string,
      data: Prisma.EquipmentUncheckedUpdateInput,
      actorId: string,
    ) {
      const org = requireOrg(organizationId);
      return prisma.$transaction(async (tx) => {
        const before = await tx.equipment.findFirst({ where: { organizationId: org, id, deletedAt: null } });
        if (!before) return null;
        const after = await tx.equipment.update({ where: { id }, data });
        await tx.auditLog.create({
          data: {
            organizationId: org,
            actorId,
            action: 'equipment.update',
            entityType: 'equipment',
            entityId: id,
            before: toJson(before),
            after: toJson(after),
          },
        });
        return after;
      });
    },

    async softDelete(organizationId: string, id: string, actorId: string, at: Date) {
      const org = requireOrg(organizationId);
      return prisma.$transaction(async (tx) => {
        const before = await tx.equipment.findFirst({ where: { organizationId: org, id, deletedAt: null } });
        if (!before) return null;
        const after = await tx.equipment.update({ where: { id }, data: { deletedAt: at } });
        await tx.auditLog.create({
          data: {
            organizationId: org,
            actorId,
            action: 'equipment.delete',
            entityType: 'equipment',
            entityId: id,
            before: toJson(before),
            after: toJson(after),
          },
        });
        return after;
      });
    },
  };
}

export type EquipmentRepository = ReturnType<typeof createEquipmentRepository>;
