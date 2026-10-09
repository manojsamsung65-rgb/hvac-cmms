# HVAC CMMS

HVAC Computerized Maintenance Management System (CMMS) - a multi-tenant maintenance
management platform for industrial plants, HVAC laboratories, factories and multiple
customer sites.

> Status: **Phase 2 - initial application foundation.** This repository currently contains
> the application shell and tooling only. No MVP modules are implemented yet, and no
> Supabase project, database, or deployment is configured.

## Stack

- Frontend: React + TypeScript + Vite
- Backend (planned): Supabase PostgreSQL, Auth, Storage, Row-Level Security
- Hosting (planned): Cloudflare Pages
- Tests: Vitest (unit/integration) and Playwright (E2E)

## Requirements

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
cp .env.example .env   # then fill in values locally; never commit .env
npm run dev
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |
| `npm run typecheck` | Type-check only |
| `npm run test` | Run unit tests (Vitest) |
| `npm run e2e` | Run E2E tests (Playwright) |

## Folder structure

```
src/
  app/          # shell, providers, router
  components/ui # shared design-system primitives
  features/     # one folder per module (dashboard implemented; others reserved)
  lib/          # supabase client and helpers
  i18n/         # locale files (en; hi planned)
  styles/       # global styles
  types/        # shared domain types
supabase/       # migrations, functions, tests, seed (reserved; not yet used)
tests/          # unit/ and e2e/
.github/workflows # CI
```

## Security notes

- Only the publishable/anon Supabase key may appear in frontend code.
- The service-role key must never be committed or shipped to the browser.
- `.env.example` lists variable names only; real values live outside git.

## CI

`.github/workflows/ci.yml` runs lint, typecheck, unit tests and a production build on
pushes and pull requests to `main`. It does not deploy.
