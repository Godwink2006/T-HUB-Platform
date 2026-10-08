-- Repair only the parent portal attendance policies. Existing staff policies are untouched.
begin;

create or replace function private.parent_portal_can_read_attendance(p_attendance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.attendance_records as ar
    join public.parent_student_links as link on link.student_id = ar.student_id
    where ar.attendance_id = p_attendance_id
      and link.parent_user_id = (select auth.uid())
      and link.status = 'active'
  )
$$;
revoke all on function private.parent_portal_can_read_attendance(uuid) from public, anon;
grant execute on function private.parent_portal_can_read_attendance(uuid) to authenticated;

drop policy if exists "parent_portal_attendance_sessions_linked_select" on public.attendance;
create policy "parent_portal_attendance_sessions_linked_select"
  on public.attendance for select to authenticated
  using (private.parent_portal_can_read_attendance(attendance.id));

drop policy if exists "parent_portal_attendance_sessions_select_scope" on public.attendance;
create policy "parent_portal_attendance_sessions_select_scope"
  on public.attendance as restrictive for select to authenticated
  using (
    coalesce(private.current_profile_role() <> 'parent', true)
    or private.parent_portal_can_read_attendance(attendance.id)
  );

commit;