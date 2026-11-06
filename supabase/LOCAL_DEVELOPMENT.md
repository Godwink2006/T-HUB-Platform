# Supabase local development

The Supabase CLI is pinned in `package.json`. Run it from the repository root with `pnpm exec supabase` or the scripts in `package.json`.

## Before starting the local stack

- Install and start Docker Desktop (or another Docker-compatible runtime). The CLI uses containers for local Postgres, Auth, and Studio.
- Check the hosted database's Postgres major version with `SHOW server_version;` and make `[db].major_version` in `config.toml` match it. The generated config currently says `17`; verify that before starting.
- The files in `migrations/` currently contain incremental changes and depend on existing tables and functions. They are not a complete schema for a fresh database. Do not run `supabase db reset` until we have reconciled the migration history and created a correct baseline.
- The browser app currently has the hosted Supabase project URL configured in `js/supabase.js`. Starting local Supabase alone will not switch the app to local; do not use the app for local database testing until its URL and anon key are configured for the local stack.

## Local CLI commands

```powershell
pnpm exec supabase --version
pnpm supabase:start
pnpm supabase:status
pnpm supabase:stop
pnpm supabase:new-migration add_a_short_description
```

`supabase:start` and `supabase:stop` only control the local containers. A local migration should be reviewed and applied to a local database before it is considered for a hosted environment.

## Production migration safety

The hosted database has received changes through the Supabase Dashboard SQL Editor. Those changes are not automatically represented by the local migration files. Before the first production `db push`, compare the hosted migration history with this folder, capture/reconcile the existing schema, and verify the resulting migration plan. Do not use `db push` as the way to discover or baseline existing production changes.

Once the baseline is reconciled, make schema changes in new timestamped files under `migrations/`, review them, and apply them through a staged migration workflow. Keep the production project linked only when intentionally inspecting or deploying to it.
