-- Keep timetable conflict validation scoped to active timetables in the
-- timetable's own academic year. Historical and inactive schedules must not
-- block creating a timetable for a new academic year.

create or replace function public.validate_timetable_lesson_all()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_school_id uuid;
  v_class_id uuid;
  v_academic_year_id uuid;
  v_assignment_exists boolean;
  v_conflict_count integer;
begin
  select timetable.school_id, timetable.class_id, timetable.academic_year_id
  into v_school_id, v_class_id, v_academic_year_id
  from public.timetables as timetable
  where timetable.id = new.timetable_id;

  if v_school_id is null then
    v_school_id := new.school_id;
  end if;

  if not exists (
    select 1
    from public.classes as class_row
    where class_row.id = v_class_id
      and class_row.school_id = v_school_id
      and lower(btrim(coalesce(class_row.status, ''))) = 'active'
      and coalesce(class_row.is_archived, false) = false
  ) then
    raise exception 'The timetable class must be active and not archived.';
  end if;

  if not exists (
    select 1
    from public.academic_years as year_row
    where year_row.id = v_academic_year_id
      and year_row.school_id = v_school_id
      and lower(btrim(coalesce(year_row.status, ''))) = 'active'
  ) then
    raise exception 'The timetable academic year must be active.';
  end if;

  if not exists (
    select 1
    from public.periods as period_row
    where period_row.id = new.period_id
      and period_row.school_id = v_school_id
      and lower(btrim(coalesce(period_row.status, ''))) = 'active'
      and coalesce(period_row.is_archived, false) = false
  ) then
    raise exception 'The timetable period must be active and not archived.';
  end if;

  if coalesce(new.is_break, false) = true
     or (new.teacher_id is null and new.subject_id is null) then
    return new;
  end if;

  if not exists (
    select 1
    from public.subjects as subject_row
    where subject_row.id = new.subject_id
      and subject_row.school_id = v_school_id
      and lower(btrim(coalesce(subject_row.status, ''))) = 'active'
      and coalesce(subject_row.is_archived, false) = false
  ) then
    raise exception 'The lesson subject must be active and not archived.';
  end if;

  if not exists (
    select 1
    from public.profiles as teacher
    where teacher.id = new.teacher_id
      and teacher.school_id = v_school_id
      and lower(btrim(coalesce(teacher.role, ''))) = 'teacher'
      and lower(btrim(coalesce(teacher.status, ''))) = 'active'
      and coalesce(teacher.is_archived, false) = false
  ) then
    raise exception 'The lesson teacher must be active and not archived.';
  end if;

  select exists (
    select 1
    from public.teacher_assignments as assignment
    where assignment.school_id = v_school_id
      and assignment.class_id = v_class_id
      and assignment.teacher_id = new.teacher_id
      and assignment.subject_id = new.subject_id
      and lower(btrim(coalesce(assignment.status, ''))) = 'active'
      and coalesce(assignment.is_archived, false) = false
  )
  into v_assignment_exists;

  if not v_assignment_exists then
    raise exception 'Invalid lesson: Teacher is not actively assigned to teach this subject for this class and academic year.'
      using errcode = '23P03';
  end if;

  select count(*)::integer
  into v_conflict_count
  from public.timetable_lessons as lesson
  join public.timetables as timetable
    on timetable.id = lesson.timetable_id
  where lesson.teacher_id = new.teacher_id
    and timetable.school_id = v_school_id
    and timetable.academic_year_id = v_academic_year_id
    and lower(btrim(coalesce(timetable.status, ''))) = 'active'
    and lesson.day_of_week = new.day_of_week
    and lesson.period_id = new.period_id
    and lesson.id is distinct from new.id
    and coalesce(lesson.is_break, false) = false;

  if v_conflict_count > 0 then
    raise exception 'Teacher Conflict: This teacher is already teaching another class during this period.'
      using errcode = '23P02';
  end if;

  return new;
end;
$function$;

create or replace function public.validate_teacher_conflict()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_teacher_id uuid;
  v_academic_year_id uuid;
  v_conflict_count integer;
begin
  select assignment.teacher_id, assignment.academic_year_id
  into v_teacher_id, v_academic_year_id
  from public.teacher_assignments as assignment
  where assignment.id = new.teacher_assignment_id;

  if v_teacher_id is null then
    return new;
  end if;

  select count(*)::integer
  into v_conflict_count
  from public.timetable_lessons as lesson
  join public.teacher_assignments as assignment
    on assignment.id = lesson.teacher_assignment_id
  join public.timetables as timetable
    on timetable.id = lesson.timetable_id
  where assignment.teacher_id = v_teacher_id
    and lesson.school_id = new.school_id
    and assignment.academic_year_id = v_academic_year_id
    and timetable.academic_year_id = v_academic_year_id
    and lower(btrim(coalesce(timetable.status, ''))) = 'active'
    and lower(btrim(coalesce(assignment.status, ''))) = 'active'
    and coalesce(assignment.is_archived, false) = false
    and lesson.day_of_week = new.day_of_week
    and lesson.period_id = new.period_id
    and lesson.id is distinct from new.id;

  if v_conflict_count > 0 then
    raise exception 'Teacher Conflict: This teacher is already teaching another class during this period.'
      using errcode = '23P02';
  end if;

  return new;
end;
$function$;
