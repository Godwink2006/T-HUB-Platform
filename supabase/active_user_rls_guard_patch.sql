-- Active-account enforcement for existing RLS-protected public tables.
-- Review and apply only to the intended Supabase project.
--
-- This patch DOES NOT enable RLS on tables that currently have it disabled:
-- enabling RLS without reviewing the existing permissive policies can break
-- legitimate application access. The DO block reports those tables for review.
--
-- This patch adds RESTRICTIVE policies, so it only narrows existing access;
-- it does not grant rows or operations that existing permissive policies deny.
-- Service-role operations intentionally bypass these authenticated-user policies.
--
-- IMPORTANT: SECURITY DEFINER RPCs and service-role Edge Functions need their
-- own active-profile checks. This patch cannot enforce account status inside
-- privileged code that bypasses RLS.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Use the current Auth identity and the current database profile, not role or
-- status claims supplied by browser input. SECURITY DEFINER avoids recursive
-- profiles RLS evaluation. A fixed empty search_path and qualified relation
-- references reduce search_path object-substitution risk.
create or replace function private.is_active_authenticated_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and lower(btrim(coalesce(p.status, ''))) = 'active'
  );
$function$;

revoke all on function private.is_active_authenticated_user() from public, anon;
grant execute on function private.is_active_authenticated_user() to authenticated;

do $block$
declare
  t record;
  missing_rls text;
begin
  -- Add gates only where RLS is already enabled. Never turn RLS on blindly.
  for t in
    select n.nspname as schema_name, c.relname as table_name
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
    order by c.relname
  loop
    -- Existing permissive SELECT policies still decide which rows are
    -- readable. This restrictive layer additionally requires active status.
    -- Keep the current user's own profile readable for deactivation handling;
    -- existing permissive policies still control whether that row is visible.
    if t.table_name = 'profiles' then
      execute format(
        'drop policy if exists %I on %I.%I',
        'active_user_gate_select', t.schema_name, t.table_name
      );
      execute format(
        'create policy %I on %I.%I as restrictive for select to authenticated using (private.is_active_authenticated_user() or id = (select auth.uid()))',
        'active_user_gate_select', t.schema_name, t.table_name
      );
    else
      execute format(
        'drop policy if exists %I on %I.%I',
        'active_user_gate_select', t.schema_name, t.table_name
      );
      execute format(
        'create policy %I on %I.%I as restrictive for select to authenticated using (private.is_active_authenticated_user())',
        'active_user_gate_select', t.schema_name, t.table_name
      );
    end if;

    execute format(
      'drop policy if exists %I on %I.%I',
      'active_user_gate_insert', t.schema_name, t.table_name
    );
    execute format(
      'create policy %I on %I.%I as restrictive for insert to authenticated with check (private.is_active_authenticated_user())',
      'active_user_gate_insert', t.schema_name, t.table_name
    );

    execute format(
      'drop policy if exists %I on %I.%I',
      'active_user_gate_update', t.schema_name, t.table_name
    );
    execute format(
      'create policy %I on %I.%I as restrictive for update to authenticated using (private.is_active_authenticated_user()) with check (private.is_active_authenticated_user())',
      'active_user_gate_update', t.schema_name, t.table_name
    );

    execute format(
      'drop policy if exists %I on %I.%I',
      'active_user_gate_delete', t.schema_name, t.table_name
    );
    execute format(
      'create policy %I on %I.%I as restrictive for delete to authenticated using (private.is_active_authenticated_user())',
      'active_user_gate_delete', t.schema_name, t.table_name
    );
  end loop;

  select string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by c.relname)
    into missing_rls
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity;

  if missing_rls is not null then
    raise warning 'Active-user RLS gates were NOT installed on tables without RLS enabled. Review these tables and their intended access policies before enabling RLS: %', missing_rls;
  end if;
end;
$block$;

commit;

-- After applying, verify policy coverage:
-- select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and policyname like 'active_user_gate_%'
-- order by tablename, cmd;
--
-- Then test with separate accounts:
-- 1) active user: existing permitted reads/writes still work;
-- 2) inactive user: own profile remains readable where existing policies allow,
--    but protected data reads and writes are denied;
-- 3) no-profile user: protected data reads and writes are denied;
-- 4) service role: server-side workflows remain functional.
--
-- This does not replace active-status checks inside SECURITY DEFINER RPCs or
-- Edge Functions that use service_role. Audit those functions separately.
