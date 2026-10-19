begin;

-- Announcement SELECT has permissive school/audience policies. This restrictive
-- guard ensures they cannot expose announcements to a parent whose linked
-- students have all graduated from or transferred out of that school.
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
