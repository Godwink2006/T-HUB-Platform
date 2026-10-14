create or replace function public.get_school_transfer_fee_history()
returns table (
  transfer_id uuid,
  source_school_id uuid,
  source_school_name text,
  student_id uuid,
  student_name text,
  student_code text,
  source_record_id text,
  fee_snapshot jsonb,
  captured_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_school_id uuid;
  v_role text;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Sign in to view transferred fee history.'
      using errcode = '42501';
  end if;

  select profile.school_id, lower(coalesce(profile.role::text, '')),
         lower(coalesce(profile.status::text, ''))
  into v_school_id, v_role, v_status
  from public.profiles as profile
  where profile.id = v_user_id;

  if v_school_id is null or v_status <> 'active'
     or v_role not in ('admin', 'accountant') then
    raise exception 'Only active school administrators and accountants can view transferred fee history.'
      using errcode = '42501';
  end if;

  return query
  select
    history.transfer_id,
    history.source_school_id,
    source_school.school_name,
    history.target_student_id,
    coalesce(
      nullif(pg_catalog.btrim(student_profile.full_name), ''),
      nullif(pg_catalog.btrim(source_enrollment.student_name_snapshot), ''),
      'Transferred Student'
    ),
    coalesce(
      nullif(pg_catalog.btrim(source_enrollment.student_code_snapshot), ''),
      nullif(pg_catalog.btrim(transfer.source_student_code), ''),
      student_record.student_id,
      ''
    ),
    history.source_record_id,
    history.record_snapshot,
    history.captured_at
  from public.student_transfer_history as history
  join public.student_transfers as transfer
    on transfer.id = history.transfer_id
   and transfer.target_school_id = v_school_id
   and lower(transfer.status::text) = 'completed'
  left join public.profiles as student_profile
    on student_profile.id = history.target_student_id
   and student_profile.school_id = v_school_id
   and lower(student_profile.role::text) = 'student'
  left join public.student_enrollments as source_enrollment
    on source_enrollment.id = transfer.source_enrollment_id
   and source_enrollment.student_id = history.source_student_id
   and source_enrollment.school_id = history.source_school_id
  left join public.students as student_record
    on student_record.id = history.target_student_id
   and student_record.school_id = v_school_id
  left join public.schools as source_school
    on source_school.id = history.source_school_id
  where history.target_school_id = v_school_id
    and history.record_type = 'fee'
  order by history.captured_at desc;
end;
$$;

revoke all on function public.get_school_transfer_fee_history()
  from public, anon, authenticated;
