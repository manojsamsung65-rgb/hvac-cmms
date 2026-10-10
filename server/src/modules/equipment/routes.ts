import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { HttpError } from '../../middleware/errorHandler';
import { createRequireAuth } from '../../middleware/requireAuth';
import { authorize } from '../../middleware/authorize';
import { csrfProtection } from '../../middleware/csrf';
import type { AuthRepositories } from '../../auth/types';
import { createEquipmentRepository } from './repository';
import { createEquipmentService } from './service';
import {
  createBuildingSchema,
  createEquipmentSchema,
  createSiteSchema,
  listEquipmentQuerySchema,
  listSimpleQuerySchema,
  updateEquipmentSchema,
} from './schemas';

export interface EquipmentModuleDeps {
  prisma: PrismaClient;
  authRepositories: AuthRepositories;
}

function actor(req: Express.Request): { organizationId: string; userId: string } {
  if (!req.auth) throw new HttpError(401, 'Authentication required', 'unauthenticated');
  return { organizationId: req.auth.organizationId, userId: req.auth.userId };
}

export function createEquipmentModule(deps: EquipmentModuleDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth({
    sessions: deps.authRepositories.sessions,
    users: deps.authRepositories.users,
  });
  const service = createEquipmentService(createEquipmentRepository(deps.prisma));

  // Sites (minimal: create + list). Full Site CRUD is a later module.
  router.post('/api/v1/sites', requireAuth, authorize('sites:manage'), csrfProtection, async (req, res, next) => {
    try {
      const { organizationId } = actor(req);
      res.status(201).json(await service.createSite(organizationId, createSiteSchema.parse(req.body)));
    } catch (err) {
      next(err);
    }
  });

  router.get('/api/v1/sites', requireAuth, authorize('sites:view'), async (req, res, next) => {
    try {
      const { organizationId } = actor(req);
      const q = listSimpleQuerySchema.parse(req.query);
      const result = await service.listSites(organizationId, q.page, q.pageSize);
      res.json({ data: result.data, page: q.page, pageSize: q.pageSize, total: result.total });
    } catch (err) {
      next(err);
    }
  });

  // Buildings (minimal: create + list).
  router.post('/api/v1/buildings', requireAuth, authorize('sites:manage'), csrfProtection, async (req, res, next) => {
    try {
      const { organizationId } = actor(req);
      res.status(201).json(await service.createBuilding(organizationId, createBuildingSchema.parse(req.body)));
    } catch (err) {
      next(err);
    }
  });

  router.get('/api/v1/buildings', requireAuth, authorize('sites:view'), async (req, res, next) => {
    try {
      const { organizationId } = actor(req);
      const q = listSimpleQuerySchema.parse(req.query);
      const result = await service.listBuildings(organizationId, q.page, q.pageSize);
      res.json({ data: result.data, page: q.page, pageSize: q.pageSize, total: result.total });
    } catch (err) {
      next(err);
    }
  });

  // Equipment.
  router.get('/api/v1/equipment', requireAuth, authorize('equipment:view'), async (req, res, next) => {
    try {
      const { organizationId } = actor(req);
      const q = listEquipmentQuerySchema.parse(req.query);
      const result = await service.list(organizationId, q);
      res.json({ data: result.data, page: q.page, pageSize: q.pageSize, total: result.total });
    } catch (err) {
      next(err);
    }
  });

  router.get('/api/v1/equipment/:id', requireAuth, authorize('equipment:view'), async (req, res, next) => {
    try {
      const { organizationId } = actor(req);
      res.json(await service.getById(organizationId, req.params.id));
    } catch (err) {
      next(err);
    }
  });

  router.post('/api/v1/equipment', requireAuth, authorize('equipment:manage'), csrfProtection, async (req, res, next) => {
    try {
      const { organizationId, userId } = actor(req);
      const input = createEquipmentSchema.parse(req.body);
      res.status(201).json(await service.create(organizationId, userId, input));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/api/v1/equipment/:id', requireAuth, authorize('equipment:manage'), csrfProtection, async (req, res, next) => {
    try {
      const { organizationId, userId } = actor(req);
      const input = updateEquipmentSchema.parse(req.body);
      res.json(await service.update(organizationId, userId, req.params.id, input));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/api/v1/equipment/:id', requireAuth, authorize('equipment:delete'), csrfProtection, async (req, res, next) => {
    try {
      const { organizationId, userId } = actor(req);
      await service.softDelete(organizationId, userId, req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
