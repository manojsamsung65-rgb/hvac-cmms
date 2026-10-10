import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app';
import { createPrismaRepositories } from '../../src/repositories/prisma';
import { hashPassword } from '../../src/lib/password';

// These tests require a real PostgreSQL database (ephemeral Postgres in CI).
// Locally they are skipped when DATABASE_URL is unset.
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('equipment integration (PostgreSQL)', () => {
  const prisma = new PrismaClient();
  const password = 'correct horse battery staple';
  let orgA = '';
  let orgB = '';
  let app: ReturnType<typeof createApp>;
  const auth: Record<string, { cookie: string; csrf: string }> = {};

  function rand(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  async function makeUser(orgId: string, roleName: string, tag: string): Promise<string> {
    const email = `${tag}-${rand()}@example.com`.toLowerCase();
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { organizationId: orgId, email, fullName: tag, passwordHash } });
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.userRole.create({ data: { organizationId: orgId, userId: user.id, roleId: role.id } });
    return email;
  }

  async function login(email: string): Promise<{ cookie: string; csrf: string }> {
    const res = await request(app).post('/auth/login').send({ email, password });
    const setCookie = res.headers['set-cookie'];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!raw) throw new Error('login failed: ' + res.status + ' ' + JSON.stringify(res.body));
    return { cookie: raw.split(';')[0], csrf: res.body.csrfToken };
  }

  function post(path: string, who: { cookie: string; csrf: string }, body: unknown) {
    return request(app).post(path).set('Cookie', who.cookie).set('x-csrf-token', who.csrf).send(body as object);
  }
  function patch(path: string, who: { cookie: string; csrf: string }, body: unknown) {
    return request(app).patch(path).set('Cookie', who.cookie).set('x-csrf-token', who.csrf).send(body as object);
  }
  function del(path: string, who: { cookie: string; csrf: string }) {
    return request(app).delete(path).set('Cookie', who.cookie).set('x-csrf-token', who.csrf);
  }
  function get(path: string, who: { cookie: string; csrf: string }) {
    return request(app).get(path).set('Cookie', who.cookie);
  }

  beforeAll(async () => {
    for (const name of ['super_admin', 'admin', 'supervisor', 'technician', 'read_only']) {
      await prisma.role.upsert({ where: { name }, create: { name }, update: {} });
    }
    const suffix = rand();
    orgA = (await prisma.organization.create({ data: { name: 'Org A', slug: `eq-a-${suffix}` } })).id;
    orgB = (await prisma.organization.create({ data: { name: 'Org B', slug: `eq-b-${suffix}` } })).id;
    app = createApp({ repositories: createPrismaRepositories(prisma), prisma });
    auth.adminA = await login(await makeUser(orgA, 'admin', 'adminA'));
    auth.supervisorA = await login(await makeUser(orgA, 'supervisor', 'supA'));
    auth.techA = await login(await makeUser(orgA, 'technician', 'techA'));
    auth.readonlyA = await login(await makeUser(orgA, 'read_only', 'roA'));
    auth.adminB = await login(await makeUser(orgB, 'admin', 'adminB'));
  });

  afterAll(async () => {
    if (hasDb) {
      const where = { organizationId: { in: [orgA, orgB] } };
      await prisma.auditLog.deleteMany({ where });
      await prisma.equipment.deleteMany({ where });
      await prisma.building.deleteMany({ where });
      await prisma.site.deleteMany({ where });
      await prisma.recoveryCode.deleteMany({ where });
      await prisma.mfaFactor.deleteMany({ where });
      await prisma.session.deleteMany({ where });
      await prisma.userRole.deleteMany({ where });
      await prisma.user.deleteMany({ where });
      await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    }
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests', async () => {
    expect((await request(app).get('/api/v1/equipment')).status).toBe(401);
  });

  it('creates, reads, updates and soft-deletes equipment', async () => {
    const who = auth.adminA;
    const site = await post('/api/v1/sites', who, { name: 'HQ', code: `HQ-${rand()}` });
    expect(site.status).toBe(201);
    const building = await post('/api/v1/buildings', who, {
      siteId: site.body.id,
      name: 'Block A',
      code: `BLK-${rand()}`,
    });
    expect(building.status).toBe(201);

    const code = `CH-${rand()}`;
    const created = await post('/api/v1/equipment', who, {
      code,
      name: 'Chiller 1',
      category: 'Chiller',
      siteId: site.body.id,
      buildingId: building.body.id,
      criticality: 'high',
    });
    expect(created.status).toBe(201);
    expect(created.body.code).toBe(code);
    const id = created.body.id;

    const got = await get(`/api/v1/equipment/${id}`, who);
    expect(got.status).toBe(200);
    expect(got.body.id).toBe(id);

    const updated = await patch(`/api/v1/equipment/${id}`, who, { status: 'under_maintenance' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('under_maintenance');

    expect((await del(`/api/v1/equipment/${id}`, who)).status).toBe(204);
    expect((await get(`/api/v1/equipment/${id}`, who)).status).toBe(404);
  });

  it('enforces RBAC for view, manage and delete', async () => {
    expect((await get('/api/v1/equipment', auth.techA)).status).toBe(200);
    expect((await post('/api/v1/equipment', auth.techA, { code: `T-${rand()}`, name: 'n', category: 'c' })).status).toBe(403);
    expect((await post('/api/v1/equipment', auth.readonlyA, { code: `R-${rand()}`, name: 'n', category: 'c' })).status).toBe(403);

    const made = await post('/api/v1/equipment', auth.supervisorA, { code: `S-${rand()}`, name: 'n', category: 'c' });
    expect(made.status).toBe(201);
    expect((await del(`/api/v1/equipment/${made.body.id}`, auth.supervisorA)).status).toBe(403);
  });

  it('denies cross-organisation access by direct id', async () => {
    const a = auth.adminA;
    const b = auth.adminB;
    const created = await post('/api/v1/equipment', a, { code: `XT-${rand()}`, name: 'n', category: 'c' });
    const id = created.body.id;

    expect((await get(`/api/v1/equipment/${id}`, b)).status).toBe(404);
    expect((await patch(`/api/v1/equipment/${id}`, b, { name: 'hacked' })).status).toBe(404);
    expect((await del(`/api/v1/equipment/${id}`, b)).status).toBe(404);

    const listB = await get('/api/v1/equipment?pageSize=100', b);
    expect(listB.body.data.find((e: { id: string }) => e.id === id)).toBeUndefined();
  });

  it('rejects referencing another organisation site', async () => {
    const siteA = await post('/api/v1/sites', auth.adminA, { name: 'A site', code: `AS-${rand()}` });
    const res = await post('/api/v1/equipment', auth.adminB, {
      code: `CS-${rand()}`,
      name: 'n',
      category: 'c',
      siteId: siteA.body.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_reference');
  });

  it('enforces organisation-scoped unique equipment codes', async () => {
    const code = `DUP-${rand()}`;
    expect((await post('/api/v1/equipment', auth.adminA, { code, name: 'n', category: 'c' })).status).toBe(201);
    const dup = await post('/api/v1/equipment', auth.adminA, { code, name: 'n2', category: 'c' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('duplicate_code');
    // The same code is allowed in a different organisation.
    expect((await post('/api/v1/equipment', auth.adminB, { code, name: 'n', category: 'c' })).status).toBe(201);
  });

  it('resolves concurrent duplicate code creation deterministically', async () => {
    const code = `CONC-${rand()}`;
    const fire = () => post('/api/v1/equipment', auth.adminA, { code, name: 'n', category: 'c' });
    const [x, y] = await Promise.all([fire(), fire()]);
    const statuses = [x.status, y.status].sort((p, q) => p - q);
    expect(statuses).toEqual([201, 409]);
  });

  it('rejects invalid payloads and pagination limits', async () => {
    const a = auth.adminA;
    expect((await post('/api/v1/equipment', a, { code: 'bad code', name: 'n', category: 'c' })).status).toBe(400);
    expect((await post('/api/v1/equipment', a, { code: `U-${rand()}`, name: 'n', category: 'c', extra: 1 })).status).toBe(400);
    expect((await post('/api/v1/equipment', a, { code: `U-${rand()}`, name: 'n', category: 'c', status: 'bogus' })).status).toBe(400);
    expect((await get('/api/v1/equipment?pageSize=1000', a)).status).toBe(400);
    expect((await get('/api/v1/equipment?page=0', a)).status).toBe(400);
  });

  it('hides soft-deleted equipment unless includeDeleted is set', async () => {
    const a = auth.adminA;
    const created = await post('/api/v1/equipment', a, { code: `SD-${rand()}`, name: 'n', category: 'c' });
    const id = created.body.id;
    expect((await del(`/api/v1/equipment/${id}`, a)).status).toBe(204);

    const list = await get('/api/v1/equipment?pageSize=100', a);
    expect(list.body.data.find((e: { id: string }) => e.id === id)).toBeUndefined();

    const withDeleted = await get('/api/v1/equipment?pageSize=100&includeDeleted=true', a);
    expect(withDeleted.body.data.find((e: { id: string }) => e.id === id)).toBeTruthy();
  });

  it('writes exactly one audit row per change and none on rollback', async () => {
    const a = auth.adminA;
    const created = await post('/api/v1/equipment', a, { code: `AU-${rand()}`, name: 'n', category: 'c' });
    const id = created.body.id;
    await patch(`/api/v1/equipment/${id}`, a, { name: 'n2' });
    await del(`/api/v1/equipment/${id}`, a);

    const rows = await prisma.auditLog.findMany({
      where: { organizationId: orgA, entityId: id },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.action)).toEqual(['equipment.create', 'equipment.update', 'equipment.delete']);
    expect(rows.every((r) => r.actorId !== null)).toBe(true);

    // A duplicate-code create fails inside the transaction: no equipment, no audit row.
    const dup = `RB-${rand()}`;
    expect((await post('/api/v1/equipment', a, { code: dup, name: 'n', category: 'c' })).status).toBe(201);
    const before = await prisma.auditLog.count({ where: { organizationId: orgA } });
    expect((await post('/api/v1/equipment', a, { code: dup, name: 'n', category: 'c' })).status).toBe(409);
    const after = await prisma.auditLog.count({ where: { organizationId: orgA } });
    expect(after).toBe(before);
  });

  it('exposes no API to modify audit logs', async () => {
    const a = auth.adminA;
    expect((await get('/api/v1/audit-logs', a)).status).toBe(404);
    expect((await patch('/api/v1/audit-logs/1', a, {})).status).toBe(404);
  });

  it('returns the paginated envelope', async () => {
    const res = await get('/api/v1/equipment?page=1&pageSize=5', auth.adminA);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 5 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });
});
