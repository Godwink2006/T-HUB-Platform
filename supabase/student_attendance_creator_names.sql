begin;

create or replace function private.student_attendance_creator_names()
returns table (
  creator_id uuid,
  full_name text,
  author_role text
)
language sql
stable
security definer
set search_path = ''
as $$
  with caller_student as (
    select student.id as student_id, student.school_id
    from public.students as student
    join public.profiles as caller_profile
      on caller_profile.id = student.id
     and caller_profile.school_id = student.school_id
    where student.id = (select auth.uid())
      and lower(private.current_profile_role()) = 'student'
      and public.check_school_access(student.school_id, 'premium'::text)
  ),
  attendance_authors as (
    select distinct attendance_session.teacher_id as creator_id
    from caller_student as caller
    join public.attendance_records as attendance_record
      on attendance_record.student_id = caller.student_id
    join public.attendance as attendance_session
      on attendance_session.id = attendance_record.attendance_id
     and attendance_session.school_id = caller.school_id
    where attendance_session.teacher_id is not null
  )
  select author.creator_id, creator_profile.full_name,
    lower(btrim(creator_profile.role)) as author_role
  from attendance_authors as author
  join caller_student as caller on true
  join public.profiles as creator_profile
    on creator_profile.id = author.creator_id
   and creator_profile.school_id = caller.school_id
   and lower(btrim(creator_profile.role)) in ('admin', 'teacher')
  where (select auth.uid()) is not null;
$$;

revoke all on function private.student_attendance_creator_names()
  from public, anon;
grant execute on function private.student_attendance_creator_names()
  to authenticated;

create or replace function public.student_attendance_creator_names()
returns table (
  creator_id uuid,
  full_name text,
  author_role text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.student_attendance_creator_names();
$$;

revoke all on function public.student_attendance_creator_names()
  from public, anon;
grant execute on function public.student_attendance_creator_names()
  to authenticated;

commit;
