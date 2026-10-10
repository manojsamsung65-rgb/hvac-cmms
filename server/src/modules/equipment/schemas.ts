import { z } from 'zod';

export const CRITICALITY = ['low', 'medium', 'high', 'critical'] as const;
export const EQUIPMENT_STATUS = ['active', 'inactive', 'under_maintenance', 'retired'] as const;

const CODE = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9-]+$/, 'Only letters, digits and hyphens are allowed');

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD');

const equipmentShape = {
  code: CODE,
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  siteId: z.string().uuid().nullish(),
  buildingId: z.string().uuid().nullish(),
  location: z.string().trim().max(200).nullish(),
  manufacturer: z.string().trim().max(200).nullish(),
  model: z.string().trim().max(200).nullish(),
  serialNumber: z.string().trim().max(200).nullish(),
  criticality: z.enum(CRITICALITY),
  status: z.enum(EQUIPMENT_STATUS),
  commissioningDate: ISO_DATE.nullish(),
  warrantyProvider: z.string().trim().max(200).nullish(),
  warrantyStart: ISO_DATE.nullish(),
  warrantyEnd: ISO_DATE.nullish(),
  maintenanceNotes: z.string().trim().max(5000).nullish(),
};

function warrantyOrder(
  value: { warrantyStart?: string | null; warrantyEnd?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (value.warrantyStart && value.warrantyEnd && value.warrantyEnd < value.warrantyStart) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['warrantyEnd'],
      message: 'warrantyEnd must be on or after warrantyStart',
    });
  }
}

export const createEquipmentSchema = z
  .object({
    ...equipmentShape,
    criticality: equipmentShape.criticality.default('medium'),
    status: equipmentShape.status.default('active'),
  })
  .strict()
  .superRefine(warrantyOrder);

export const updateEquipmentSchema = z
  .object(equipmentShape)
  .partial()
  .strict()
  .superRefine(warrantyOrder);

const booleanish = z.enum(['true', 'false']).transform((v) => v === 'true');

export const listEquipmentQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(EQUIPMENT_STATUS).optional(),
    category: z.string().trim().max(100).optional(),
    criticality: z.enum(CRITICALITY).optional(),
    siteId: z.string().uuid().optional(),
    q: z.string().trim().max(100).optional(),
    includeDeleted: booleanish.optional(),
  })
  .strict();

export const createSiteSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    code: CODE,
  })
  .strict();

export const createBuildingSchema = z
  .object({
    siteId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    code: CODE,
  })
  .strict();

export const listSimpleQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;
export type ListEquipmentQuery = z.infer<typeof listEquipmentQuerySchema>;
