begin;

drop policy if exists "teachers_read_attendance_transfer_snapshots"
  on public.student_enrollments;
create policy "teachers_read_attendance_transfer_snapshots"
  on public.student_enrollments
  for select
  to authenticated
  using (
    student_name_snapshot is not null
    and school_id = public.get_auth_user_school_id()
    and lower(coalesce(public.get_auth_user_role(), '')) = 'teacher'
    and exists (
      select 1
      from public.attendance_records as attendance_record
      join public.attendance as attendance_session
        on attendance_session.id = attendance_record.attendance_id
      where attendance_record.student_id = student_enrollments.student_id
        and attendance_record.school_id = student_enrollments.school_id
        and attendance_session.school_id = student_enrollments.school_id
        and attendance_session.teacher_id = (select auth.uid())
    )
  );

commit;
