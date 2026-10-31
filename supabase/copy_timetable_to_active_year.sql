-- Copies a timetable and its lessons into the school's active academic year.
-- Existing active timetables for the same class and active year are marked
-- inactive in the same transaction before the copy is created.

create or replace function private.copy_timetable_to_active_year_internal(
  p_timetable_id uuid
)
returns table (
  timetable_id uuid,
  replaced_timetables integer,
  copied_lessons integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_school_id uuid;
  v_role text;
  v_source_school_id uuid;
  v_class_id uuid;
  v_active_year_id uuid;
  v_active_year_count integer;
  v_new_timetable_id uuid;
  v_replaced_timetables integer := 0;
  v_copied_lessons integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before copying a timetable.' using errcode = '42501';
  end if;

  select profile.school_id, coalesce(lower(profile.role), '')
  into v_school_id, v_role
  from public.profiles as profile
  where profile.id = (select auth.uid());

  if v_school_id is null or v_role <> 'admin' then
    raise exception 'Only a school administrator can copy a timetable.' using errcode = '42501';
  end if;

  select timetable.school_id, timetable.class_id
  into v_source_school_id, v_class_id
  from public.timetables as timetable
  where timetable.id = p_timetable_id;

  if not found or v_source_school_id is distinct from v_school_id then
    raise exception 'The timetable was not found in your school.' using errcode = '42501';
  end if;

  select count(*)::integer, (array_agg(year.id))[1]
  into v_active_year_count, v_active_year_id
  from public.academic_years as year
  where year.school_id = v_school_id
    and lower(btrim(year.status)) = 'active';

  if v_active_year_count <> 1 then
    raise exception 'Your school must have exactly one active academic year.' using errcode = '23514';
  end if;

  select count(*)::integer
  into v_copied_lessons
  from public.timetable_lessons as lesson
  where lesson.timetable_id = p_timetable_id
    and lesson.school_id = v_school_id;

  if v_copied_lessons = 0 then
    raise exception 'This timetable has no lessons to copy.' using errcode = '23514';
  end if;

  -- Serialize copies for the same school, class, and active year so two
  -- simultaneous requests cannot leave multiple active copies behind.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_school_id::text || ':' || v_class_id::text || ':' || v_active_year_id::text,
      0
    )
  );

  update public.timetables as existing
  set status = 'Inactive'
  where existing.school_id = v_school_id
    and lower(btrim(existing.status)) = 'active'
    and (
      existing.id = p_timetable_id
      or (
        existing.class_id = v_class_id
        and existing.academic_year_id = v_active_year_id
      )
    );

  get diagnostics v_replaced_timetables = row_count;

  insert into public.timetables (
    school_id,
    class_id,
    academic_year_id,
    status
  )
  values (
    v_school_id,
    v_class_id,
    v_active_year_id,
    'Active'
  )
  returning id into v_new_timetable_id;

  insert into public.timetable_lessons (
    school_id,
    timetable_id,
    day_of_week,
    period_id,
    is_break,
    subject_id,
    teacher_id
  )
  select
    lesson.school_id,
    v_new_timetable_id,
    lesson.day_of_week,
    lesson.period_id,
    lesson.is_break,
    lesson.subject_id,
    lesson.teacher_id
  from public.timetable_lessons as lesson
  where lesson.timetable_id = p_timetable_id
    and lesson.school_id = v_school_id;

  return query
  select v_new_timetable_id, v_replaced_timetables, v_copied_lessons;
end;
$$;

create or replace function public.copy_timetable_to_active_year(
  p_timetable_id uuid
)
returns table (
  timetable_id uuid,
  replaced_timetables integer,
  copied_lessons integer
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.copy_timetable_to_active_year_internal(p_timetable_id);
$$;

revoke all on function private.copy_timetable_to_active_year_internal(uuid) from public, anon;
grant execute on function private.copy_timetable_to_active_year_internal(uuid) to authenticated;
revoke all on function public.copy_timetable_to_active_year(uuid) from public, anon;
grant execute on function public.copy_timetable_to_active_year(uuid) to authenticated;
