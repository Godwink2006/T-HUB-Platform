-- Add parent read access to announcements relevant to an actively linked
-- student. Existing announcement policies are intentionally left untouched.
-- Requires parent_portal_data_access.sql (private.current_profile_role()).

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

commit;
