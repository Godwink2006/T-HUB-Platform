
begin;

grant select on public.announcements to authenticated;

drop policy if exists "parent_portal_announcements_linked_students_select"
  on public.announcements;
create policy "parent_portal_announcements_linked_students_select"
  on public.announcements
  for select
  to authenticated
  using (
    private.current_profile_role() = 'parent'
    and exists (
      select 1
      from public.parent_student_links as link
      where link.parent_user_id = (select auth.uid())
        and link.school_id = announcements.school_id
        and link.status = 'active'
    )
    and exists (
      select 1
      from unnest(string_to_array(lower(coalesce(announcements.target_audience, '')), ',')) as audience(value)
      where btrim(audience.value) in ('all', 'everyone', 'student', 'students', 'parent', 'parents')
    )
  );

-- This is restrictive because announcements also have broader school/audience
-- policies. A parent must still have at least one active student at the
-- announcement's school before any permissive policy can expose the row.
drop policy if exists "parent_portal_announcements_active_student_scope"
  on public.announcements;
create policy "parent_portal_announcements_active_student_scope"
  on public.announcements
  as restrictive
  for select
  to authenticated
  using (
    coalesce((select private.current_profile_role()), '') <> 'parent'
    or exists (
      select 1
      from public.parent_student_links as link
      join public.student_enrollments as enrollment
        on enrollment.student_id = link.student_id
       and enrollment.school_id = announcements.school_id
      where link.parent_user_id = (select auth.uid())
        and link.school_id = announcements.school_id
        and lower(btrim(coalesce(link.status, ''))) = 'active'
        and lower(btrim(coalesce(enrollment.enrollment_status, 'normal')))
          not in ('graduated', 'transferred')
    )
  );

commit;
