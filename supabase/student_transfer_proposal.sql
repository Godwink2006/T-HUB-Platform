-- Review proposal only. This file is not a migration and has not been applied.
-- It adds transfer-only tables and one source-school code-generation function.
-- Existing application tables and policies are not changed.

-- Populate this allowlist through a trusted administrator workflow. Do not
-- expose INSERT/UPDATE access to browser clients; it is the authorization
-- source for the SECURITY DEFINER functions in this proposal.
-- After manually verifying the admin and school IDs, provision access with:
-- insert into public.student_transfer_admins (user_id, school_id)
-- values ('<verified-auth-user-uuid>', '<verified-school-uuid>');
create table public.student_transfer_admins (
  user_id uuid not null references public.profiles (id),
  school_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, school_id)
);

create table public.student_transfers (
  id uuid primary key default gen_random_uuid(),
  source_school_id uuid not null,
  target_school_id uuid,
  source_student_id uuid not null references public.students (id),
  target_student_id uuid references public.students (id),
  source_enrollment_id uuid not null references public.student_enrollments (id),
  code_hash bytea not null unique,
  status text not null default 'code_issued'
    check (status in ('code_issued', 'accepted', 'completed', 'revoked', 'expired')),
  code_expires_at timestamptz not null,
  created_by uuid not null references public.profiles (id),
  accepted_by uuid references public.profiles (id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_transfers_different_schools
    check (target_school_id is null or target_school_id <> source_school_id)
);

create index student_transfers_source_school_created_idx
  on public.student_transfers (source_school_id, created_at desc);

create index student_transfers_source_student_status_idx
  on public.student_transfers (source_school_id, source_student_id, status);

create unique index student_transfers_one_live_code_per_student_idx
  on public.student_transfers (source_school_id, source_student_id)
  where status = 'code_issued';

create table public.student_transfer_history (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.student_transfers (id) on delete restrict,
  source_school_id uuid not null,
  target_school_id uuid not null,
  source_student_id uuid not null references public.students (id),
  target_student_id uuid references public.students (id),
  record_type text not null
    check (record_type in ('attendance', 'grade', 'fee', 'payment')),
  source_record_id text not null,
  record_snapshot jsonb not null,
  captured_at timestamptz not null default now(),
  constraint student_transfer_history_record_once
    unique (transfer_id, record_type, source_record_id),
  constraint student_transfer_history_different_schools
    check (target_school_id <> source_school_id)
);

create index student_transfer_history_target_student_idx
  on public.student_transfer_history (target_school_id, target_student_id, record_type);

create index student_transfer_history_source_student_idx
  on public.student_transfer_history (source_school_id, source_student_id, record_type);

alter table public.student_transfer_admins enable row level security;
alter table public.student_transfers enable row level security;
alter table public.student_transfer_history enable row level security;

-- No direct browser table access. Preview and acceptance are defined in the
-- separately reviewed student_transfer_acceptance.sql file. A history-read
-- function must be added before exposing snapshots in the student UI.
revoke all on table public.student_transfer_admins from public, anon, authenticated;
revoke all on table public.student_transfers from public, anon, authenticated;
revoke all on table public.student_transfer_history from public, anon, authenticated;

create function public.generate_student_transfer_code(
  p_source_enrollment_id uuid,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_school_id uuid;
  v_student_id uuid;
  v_transfer_id uuid;
  v_expires_at timestamptz := now() + interval '5 days';
begin
  if v_actor_id is null then
    raise exception 'Sign in as a school administrator to generate a transfer code.';
  end if;

  if p_code_hash is null or p_code_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'A valid SHA-256 code hash is required.';
  end if;

  select enrollment.student_id, enrollment.school_id
    into v_student_id, v_school_id
  from public.student_enrollments as enrollment
  join public.profiles as student_profile
    on student_profile.id = enrollment.student_id
   and student_profile.school_id = enrollment.school_id
  join public.student_transfer_admins as transfer_admin
    on transfer_admin.school_id = enrollment.school_id
   and transfer_admin.user_id = v_actor_id
  where enrollment.id = p_source_enrollment_id
    and coalesce(enrollment.enrollment_status, 'Normal') not in ('Transferred', 'Graduated');

  if v_student_id is null then
    raise exception 'You are not authorized for this school, or the selected enrollment is unavailable or ineligible.';
  end if;

  update public.student_transfers as transfer
  set status = case
        when transfer.code_expires_at <= now() then 'expired'
        else 'revoked'
      end,
      updated_at = now()
  where transfer.source_school_id = v_school_id
    and transfer.source_student_id = v_student_id
    and transfer.status = 'code_issued';

  insert into public.student_transfers (
    source_school_id,
    source_student_id,
    source_enrollment_id,
    code_hash,
    code_expires_at,
    created_by
  ) values (
    v_school_id,
    v_student_id,
    p_source_enrollment_id,
    pg_catalog.decode(pg_catalog.lower(p_code_hash), 'hex'),
    v_expires_at,
    v_actor_id
  )
  returning id into v_transfer_id;

  return pg_catalog.jsonb_build_object(
    'transfer_id', v_transfer_id,
    'expires_at', v_expires_at
  );
end;
$$;

revoke all on function public.generate_student_transfer_code(uuid, text) from public, anon;
grant execute on function public.generate_student_transfer_code(uuid, text) to authenticated;
