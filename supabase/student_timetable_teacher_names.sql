
begin;

create or replace function private.student_timetable_teacher_names(
  p_class_id uuid
)
returns table (
  teacher_id uuid,
  full_name text,
  is_class_teacher boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with caller_student as (
    select student.id as student_id, student.class_id, student.school_id
    from public.students as student
    join public.profiles as caller_profile
      on caller_profile.id = student.id
     and caller_profile.school_id = student.school_id
    where student.id = (select auth.uid())
      and lower(private.current_profile_role()) = 'student'
      and public.check_school_access(student.school_id, 'premium'::text)
  ),
  authorized_class as (
    select caller.class_id, caller.school_id
    from caller_student as caller
    where caller.class_id = p_class_id

    union

    select p_class_id, caller.school_id
    from caller_student as caller
    where exists (
      select 1
      from public.grade_records as grade_record
      join public.grades as grade
        on grade.id = grade_record.grade_id
      where grade_record.student_id = caller.student_id
        and grade.class_id = p_class_id
        and grade.school_id = caller.school_id
    )
    or exists (
      select 1
      from public.attendance_records as attendance_record
      join public.attendance as attendance_session
        on attendance_session.id = attendance_record.attendance_id
      where attendance_record.student_id = caller.student_id
        and attendance_session.class_id = p_class_id
        and attendance_session.school_id = caller.school_id
    )
  ),
  class_teachers as (
    select assignment.teacher_id, true as is_class_teacher
    from authorized_class as caller
    join public.teacher_assignments as assignment
      on assignment.class_id = caller.class_id
     and assignment.school_id = caller.school_id
    where assignment.is_class_teacher is true
      and lower(assignment.status) = 'active'
      and assignment.teacher_id is not null
  ),
  timetable_teachers as (
    select lesson.teacher_id, false as is_class_teacher
    from authorized_class as caller
    join public.timetables as timetable
      on timetable.class_id = caller.class_id
     and timetable.school_id = caller.school_id
    join public.timetable_lessons as lesson
      on lesson.timetable_id = timetable.id
     and lesson.school_id = timetable.school_id
    where lower(timetable.status) = 'active'
      and lesson.teacher_id is not null
  ),
  record_teachers as (
    select grade.created_by as teacher_id, false as is_class_teacher
    from caller_student as caller
    join public.grade_records as grade_record
      on grade_record.student_id = caller.student_id
    join public.grades as grade
      on grade.id = grade_record.grade_id
     and grade.class_id = p_class_id
     and grade.school_id = caller.school_id
    where grade.created_by is not null

    union all

    select attendance_session.teacher_id as teacher_id, false as is_class_teacher
    from caller_student as caller
    join public.attendance_records as attendance_record
      on attendance_record.student_id = caller.student_id
    join public.attendance as attendance_session
      on attendance_session.id = attendance_record.attendance_id
     and attendance_session.class_id = p_class_id
     and attendance_session.school_id = caller.school_id
    where attendance_session.teacher_id is not null
  ),
  allowed_teachers as (
    select teacher_id, bool_or(is_class_teacher) as is_class_teacher
    from (
      select * from class_teachers
      union all
      select * from timetable_teachers
      union all
      select * from record_teachers
    ) as linked_teachers
    group by teacher_id
  )
  select allowed.teacher_id, teacher_profile.full_name, allowed.is_class_teacher
  from allowed_teachers as allowed
  join caller_student as caller on true
  join public.profiles as teacher_profile
    on teacher_profile.id = allowed.teacher_id
   and teacher_profile.school_id = caller.school_id
   and lower(teacher_profile.role) = 'teacher'
  where (select auth.uid()) is not null;
$$;

revoke all on function private.student_timetable_teacher_names(uuid)
  from public, anon, authenticated;
grant execute on function private.student_timetable_teacher_names(uuid)
  to authenticated;

create or replace function public.student_timetable_teacher_names(
  p_class_id uuid
)
returns table (
  teacher_id uuid,
  full_name text,
  is_class_teacher boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.student_timetable_teacher_names(p_class_id);
$$;

revoke all on function public.student_timetable_teacher_names(uuid)
  from public, anon;
grant execute on function public.student_timetable_teacher_names(uuid)
  to authenticated;

commit;
