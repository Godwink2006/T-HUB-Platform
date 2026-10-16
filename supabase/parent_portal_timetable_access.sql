
begin;

create or replace function private.parent_portal_can_read_timetable(
  p_timetable_id uuid,
  p_school_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select private.current_profile_role()) = 'parent'
    and exists (
      select 1
      from public.timetables as timetable
      join public.students as student
        on student.class_id = timetable.class_id
       and student.school_id = timetable.school_id
      join public.parent_student_links as link
        on link.student_id = student.id
       and link.school_id = student.school_id
      where timetable.id = p_timetable_id
        and timetable.school_id = p_school_id
        and lower(timetable.status) = 'active'
        and link.parent_user_id = (select auth.uid())
        and link.status = 'active'
    );
$$;

revoke all on function private.parent_portal_can_read_timetable(uuid, uuid)
  from public, anon;
grant execute on function private.parent_portal_can_read_timetable(uuid, uuid)
  to authenticated;

drop policy if exists "parent_portal_timetables_linked_class_select"
  on public.timetables;
create policy "parent_portal_timetables_linked_class_select"
  on public.timetables for select to authenticated
  using ((select private.parent_portal_can_read_timetable(id, school_id)));

drop policy if exists "parent_portal_timetables_select_scope"
  on public.timetables;
create policy "parent_portal_timetables_select_scope"
  on public.timetables as restrictive for select to authenticated
  using (
    coalesce((select private.current_profile_role()) <> 'parent', true)
    or (select private.parent_portal_can_read_timetable(id, school_id))
  );

drop policy if exists "parent_portal_timetable_lessons_linked_class_select"
  on public.timetable_lessons;
create policy "parent_portal_timetable_lessons_linked_class_select"
  on public.timetable_lessons for select to authenticated
  using (
    (select private.parent_portal_can_read_timetable(timetable_id, school_id))
  );

drop policy if exists "parent_portal_timetable_lessons_select_scope"
  on public.timetable_lessons;
create policy "parent_portal_timetable_lessons_select_scope"
  on public.timetable_lessons as restrictive for select to authenticated
  using (
    coalesce((select private.current_profile_role()) <> 'parent', true)
    or (select private.parent_portal_can_read_timetable(timetable_id, school_id))
  );

drop policy if exists "parent_portal_timetable_subject_labels_select"
  on public.subjects;
create policy "parent_portal_timetable_subject_labels_select"
  on public.subjects for select to authenticated
  using (
    exists (
      select 1
      from public.timetable_lessons as lesson
      join public.timetables as timetable
        on timetable.id = lesson.timetable_id
       and timetable.school_id = lesson.school_id
      where lesson.subject_id = subjects.id
        and lesson.school_id = subjects.school_id
        and (select private.parent_portal_can_read_timetable(timetable.id, timetable.school_id))
    )
  );

drop policy if exists "parent_portal_timetable_period_labels_select"
  on public.periods;
create policy "parent_portal_timetable_period_labels_select"
  on public.periods for select to authenticated
  using (
    exists (
      select 1
      from public.timetable_lessons as lesson
      join public.timetables as timetable
        on timetable.id = lesson.timetable_id
       and timetable.school_id = lesson.school_id
      where lesson.period_id = periods.id
        and lesson.school_id = periods.school_id
        and (select private.parent_portal_can_read_timetable(timetable.id, timetable.school_id))
    )
  );

commit;
