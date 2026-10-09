# HVAC CMMS API (server)

Node.js + Express + TypeScript API with Prisma (PostgreSQL). Part of the HVAC CMMS
project. See the repository root README for the full project.

> Status: **foundation skeleton only.** Health/readiness endpoints, configuration
> validation, structured logging, error handling and Prisma scaffolding exist.
> **Authentication, sessions, RBAC, tenant scoping and all domain modules are NOT
> implemented yet.** No database connection is configured and no migrations have
> been applied.

## Requirements

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
cp .env.example .env   # fill in locally; never commit .env
npm run prisma:generate
npm run dev
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the API in watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Type-check only |
| `npm run test` | Unit tests (Vitest) |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Create/apply migrations (requires a database) |

## Endpoints (this milestone)

- `GET /health` - liveness.
- `GET /ready` - readiness; reports whether `DATABASE_URL` is configured (it does
  not yet verify database connectivity).

## Security notes

- Only server-side environment variables hold credentials; never expose them to
  the browser or commit them.
- The tenant id must always be derived from the authenticated session, never from
  client input.
- `requireAuth` / `getTenant` are placeholders documenting the intended contract;
  they are not wired to routes and authentication is not yet functional.
