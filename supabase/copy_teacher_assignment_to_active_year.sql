-- Copies one teacher assignment into the school's active academic year.
-- The source assignment and any exact active duplicate in the target year are
-- inactivated before the copy is created, in the same transaction.

create or replace function private.copy_teacher_assignment_to_active_year_internal(
  p_assignment_id uuid
)
returns table (
  assignment_id uuid,
  replaced_assignments integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_role text;
  v_source_school_id uuid;
  v_teacher_id uuid;
  v_subject_id uuid;
  v_class_id uuid;
  v_is_class_teacher boolean;
  v_description text;
  v_active_year_id uuid;
  v_active_year_count integer;
  v_new_assignment_id uuid;
  v_replaced_assignments integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before copying a teacher assignment.' using errcode = '42501';
  end if;

  select profile.school_id, coalesce(lower(profile.role), '')
  into v_school_id, v_role
  from public.profiles as profile
  where profile.id = (select auth.uid());

  if v_school_id is null or v_role <> 'admin' then
    raise exception 'Only a school administrator can copy a teacher assignment.' using errcode = '42501';
  end if;

  select
    assignment.school_id,
    assignment.teacher_id,
    assignment.subject_id,
    assignment.class_id,
    assignment.is_class_teacher,
    assignment.description
  into
    v_source_school_id,
    v_teacher_id,
    v_subject_id,
    v_class_id,
    v_is_class_teacher,
    v_description
  from public.teacher_assignments as assignment
  where assignment.id = p_assignment_id;

  if not found or v_source_school_id is distinct from v_school_id then
    raise exception 'The teacher assignment was not found in your school.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles as teacher
    where teacher.id = v_teacher_id
      and teacher.school_id = v_school_id
      and lower(teacher.role) = 'teacher'
  ) or not exists (
    select 1
    from public.subjects as subject
    where subject.id = v_subject_id
      and subject.school_id = v_school_id
  ) or not exists (
    select 1
    from public.classes as class
    where class.id = v_class_id
      and class.school_id = v_school_id
  ) then
    raise exception 'The assignment must reference a teacher, subject, and class in your school.' using errcode = '23503';
  end if;

  select count(*)::integer, (array_agg(year.id))[1]
  into v_active_year_count, v_active_year_id
  from public.academic_years as year
  where year.school_id = v_school_id
    and lower(btrim(year.status)) = 'active';

  if v_active_year_count <> 1 then
    raise exception 'Your school must have exactly one active academic year.' using errcode = '23514';
  end if;

  -- Serialize assignment copies for this class and year, including class
  -- teacher copies whose uniqueness rule applies across subjects and teachers.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_school_id::text || ':' || v_class_id::text || ':' || v_active_year_id::text,
      0
    )
  );

  update public.teacher_assignments as existing
  set status = 'inactive',
      updated_at = pg_catalog.now()
  where existing.school_id = v_school_id
    and lower(btrim(existing.status)) = 'active'
    and (
      existing.id = p_assignment_id
      or (
        existing.teacher_id = v_teacher_id
        and existing.subject_id = v_subject_id
        and existing.class_id = v_class_id
        and existing.academic_year_id = v_active_year_id
      )
    );

  get diagnostics v_replaced_assignments = row_count;

  if v_is_class_teacher and exists (
    select 1
    from public.teacher_assignments as existing
    where existing.school_id = v_school_id
      and existing.class_id = v_class_id
      and existing.academic_year_id = v_active_year_id
      and existing.is_class_teacher
      and lower(btrim(existing.status)) = 'active'
  ) then
    raise exception 'This class already has an active class teacher for the active academic year.'
      using errcode = '23505';
  end if;

  insert into public.teacher_assignments (
    school_id,
    teacher_id,
    subject_id,
    class_id,
    academic_year_id,
    is_class_teacher,
    status,
    description
  )
  values (
    v_school_id,
    v_teacher_id,
    v_subject_id,
    v_class_id,
    v_active_year_id,
    v_is_class_teacher,
    'active',
    v_description
  )
  returning id into v_new_assignment_id;

  return query
  select v_new_assignment_id, v_replaced_assignments;
end;
$$;

create or replace function public.copy_teacher_assignment_to_active_year(
  p_assignment_id uuid
)
returns table (
  assignment_id uuid,
  replaced_assignments integer
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.copy_teacher_assignment_to_active_year_internal(p_assignment_id);
$$;

revoke all on function private.copy_teacher_assignment_to_active_year_internal(uuid) from public, anon;
grant execute on function private.copy_teacher_assignment_to_active_year_internal(uuid) to authenticated;
revoke all on function public.copy_teacher_assignment_to_active_year(uuid) from public, anon;
grant execute on function public.copy_teacher_assignment_to_active_year(uuid) to authenticated;
