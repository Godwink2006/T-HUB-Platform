begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null
    references public.schools(id) on delete restrict,
  actor_id uuid
    references public.profiles(id) on delete set null,
  actor_display_name text,
  actor_role text,
  action text not null
    check (length(btrim(action)) > 0),
  module text not null
    check (length(btrim(module)) > 0),
  entity_table text,
  entity_id text,
  description text not null
    check (length(btrim(description)) > 0),
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_school_created_at_idx
  on public.audit_logs (school_id, created_at desc);

create index if not exists audit_logs_school_actor_created_at_idx
  on public.audit_logs (school_id, actor_id, created_at desc);

create index if not exists audit_logs_school_module_created_at_idx
  on public.audit_logs (school_id, module, created_at desc);

create index if not exists audit_logs_school_action_created_at_idx
  on public.audit_logs (school_id, action, created_at desc);

create or replace function private.can_read_audit_logs(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.school_id = p_school_id
      and lower(btrim(coalesce(p.role::text, ''))) = 'admin'
      and lower(btrim(coalesce(p.status::text, ''))) = 'active'
  );
$$;

revoke all on function private.can_read_audit_logs(uuid) from public, anon;
grant execute on function private.can_read_audit_logs(uuid) to authenticated;

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_active_school_admin
  on public.audit_logs;

create policy audit_logs_select_active_school_admin
  on public.audit_logs
  for select
  to authenticated
  using ((select private.can_read_audit_logs(school_id)));

-- No client-side write path. The database trigger below records events.
revoke all on table public.audit_logs from public, anon, authenticated;
grant select on table public.audit_logs to authenticated;

create or replace function private.audit_redact_json(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_value is null then
    return null;
  end if;

  case jsonb_typeof(p_value)
    when 'object' then
      select coalesce(
        jsonb_object_agg(entry.key, private.audit_redact_json(entry.value)),
        '{}'::jsonb
      )
      into v_result
      from jsonb_each(p_value) as entry(key, value)
      where lower(entry.key) <> all (array[
        'password', 'password_hash', 'encrypted_password',
        'access_token', 'refresh_token', 'token', 'secret', 'otp',
        'temporary_password', 'email', 'phone', 'phone_number',
        'address', 'date_of_birth', 'dob', 'national_id',
        'guardian', 'guardian_name', 'medical', 'avatar_url',
        'photo_url', 'credential', 'credentials'
      ]::text[]);
      return v_result;

    when 'array' then
      select coalesce(
        jsonb_agg(private.audit_redact_json(item.value)),
        '[]'::jsonb
      )
      into v_result
      from jsonb_array_elements(p_value) as item(value);
      return v_result;

    else
      return p_value;
  end case;
end;
$$;

revoke all on function private.audit_redact_json(jsonb) from public, anon, authenticated;

create or replace function private.log_audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_old_redacted jsonb;
  v_new_redacted jsonb;
  v_old_changes jsonb := '{}'::jsonb;
  v_new_changes jsonb := '{}'::jsonb;
  v_key text;
  v_school_id uuid;
  v_actor_id uuid := (select auth.uid());
  v_actor_display_name text;
  v_actor_role text;
  v_entity_id text;
  v_module text := coalesce(nullif(btrim(tg_argv[0]), ''), initcap(tg_table_name));
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new);
  end if;

  v_school_id := nullif(
    coalesce(
      v_new ->> 'school_id',
      v_old ->> 'school_id',
      case
        when tg_table_name = 'schools'
          then coalesce(v_new ->> 'id', v_old ->> 'id')
      end
    ),
    ''
  )::uuid;

  -- Rows without a school cannot be assigned safely to a school's audit trail.
  if v_school_id is null then
    return null;
  end if;

  v_entity_id := coalesce(v_new ->> 'id', v_old ->> 'id');
  v_actor_display_name := 'System process';
  v_actor_role := 'system';

  if v_actor_id is not null then
    select nullif(btrim(p.full_name), ''),
           nullif(lower(btrim(p.role::text)), '')
      into v_actor_display_name, v_actor_role
    from public.profiles as p
    where p.id = v_actor_id;

    v_actor_display_name := coalesce(v_actor_display_name, 'Unknown user');
    v_actor_role := coalesce(v_actor_role, 'unknown');
  end if;

  v_old_redacted := private.audit_redact_json(v_old);
  v_new_redacted := private.audit_redact_json(v_new);

  if tg_op = 'UPDATE' then
    for v_key in
      select keys.key
      from jsonb_object_keys(v_old_redacted || v_new_redacted) as keys(key)
    loop
      if (v_old_redacted -> v_key) is distinct from (v_new_redacted -> v_key) then
        v_old_changes := v_old_changes || jsonb_build_object(v_key, v_old_redacted -> v_key);
        v_new_changes := v_new_changes || jsonb_build_object(v_key, v_new_redacted -> v_key);
      end if;
    end loop;

    v_old_redacted := v_old_changes;
    v_new_redacted := v_new_changes;
  elsif tg_op = 'DELETE' then
    v_new_redacted := null;
  else
    v_old_redacted := null;
  end if;

  insert into public.audit_logs (
    school_id,
    actor_id,
    actor_display_name,
    actor_role,
    action,
    module,
    entity_table,
    entity_id,
    description,
    old_data,
    new_data,
    metadata
  ) values (
    v_school_id,
    v_actor_id,
    v_actor_display_name,
    v_actor_role,
    tg_op,
    v_module,
    tg_table_name,
    v_entity_id,
    format('%s %s a %s record', v_actor_display_name, lower(tg_op), v_module),
    v_old_redacted,
    v_new_redacted,
    jsonb_build_object(
      'source', 'database_trigger',
      'schema', tg_table_schema
    )
  );

  -- This is an AFTER trigger; the row return value is ignored.
  return null;
end;
$$;

revoke all on function private.log_audit_change() from public, anon, authenticated;

-- Attach one row-level trigger to each audited business table that exists.
do $$
declare
  target record;
  trigger_name text;
begin
  for target in
    select * from (values
      ('profiles', 'Accounts'),
      ('schools', 'School Settings'),
      ('academic_years', 'Academics'),
      ('announcements', 'Announcements'),
      ('assessment_categories', 'Assessments'),
      ('assessments', 'Assessments'),
      ('departments', 'Academics'),
      ('classes', 'Academics'),
      ('subjects', 'Academics'),
      ('terms', 'Academics'),
      ('periods', 'Academics'),
      ('teacher_assignments', 'Academics'),
      ('teachers', 'Staff'),
      ('students', 'Students'),
      ('student_enrollments', 'Enrollment'),
      ('grades', 'Grades'),
      ('grade_records', 'Grades'),
      ('attendance', 'Attendance'),
      ('attendance_records', 'Attendance'),
      ('fee_structures', 'Finance'),
      ('fee_structure_items', 'Finance'),
      ('student_fees', 'Finance'),
      ('payment_transactions', 'Finance'),
      ('payment_allocations', 'Finance'),
      ('books', 'Library'),
      ('book_borrowings', 'Library'),
      ('notifications', 'Notifications'),
      ('parent_student_links', 'Parents'),
      ('student_transfer_admins', 'Transfers'),
      ('student_transfers', 'Transfers'),
      ('student_transfer_history', 'Transfers'),
      ('timetables', 'Timetable'),
      ('timetable_lessons', 'Timetable'),
      ('subscriptions', 'Billing')
    ) as audited(table_name, module_name)
  loop
    if to_regclass(format('public.%I', target.table_name)) is null then
      raise notice 'Skipping audit trigger: public.% does not exist', target.table_name;
      continue;
    end if;

    trigger_name := 'audit_log_' || target.table_name;

    execute format(
      'drop trigger if exists %I on public.%I',
      trigger_name,
      target.table_name
    );

    if target.table_name = 'schools' then
      -- Audit school metadata changes without blocking the school's deletion.
      execute format(
        'create trigger %I after insert or update on public.%I for each row execute function private.log_audit_change(%L)',
        trigger_name,
        target.table_name,
        target.module_name
      );
    else
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function private.log_audit_change(%L)',
        trigger_name,
        target.table_name,
        target.module_name
      );
    end if;
  end loop;
end;
$$;

commit;
