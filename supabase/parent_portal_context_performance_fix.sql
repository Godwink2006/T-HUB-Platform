-- Optimize parent portal label lookups to avoid nested RLS scans/timeouts.
-- Only policies with the parent_portal_ prefix are replaced.
begin;
-- Parent-visible labels are checked in a private SECURITY DEFINER helper so
-- these lookups do not recursively re-run RLS across the record tables.
create or replace function private.parent_portal_can_view_context(p_context text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_context
    when 'school' then
      exists (
        select 1 from public.parent_student_links l
        where l.parent_user_id = (select auth.uid()) and l.status = 'active'
          and (
            l.school_id = p_id
            or exists (select 1 from public.students s where s.id = l.student_id and s.school_id = p_id)
            or exists (select 1 from public.student_enrollments e where e.student_id = l.student_id and e.school_id = p_id)
            or exists (select 1 from public.student_fees f where f.student_id = l.student_id and f.school_id = p_id)
            or exists (select 1 from public.payment_transactions pt where pt.student_id = l.student_id and pt.school_id = p_id)
            or exists (select 1 from public.attendance a join public.attendance_records ar on ar.attendance_id = a.id where ar.student_id = l.student_id and a.school_id = p_id)
            or exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id where gr.student_id = l.student_id and g.school_id = p_id)
          )
      )
    when 'class' then
      exists (select 1 from public.student_enrollments e join public.parent_student_links l on l.student_id = e.student_id where e.class_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
      or exists (select 1 from public.student_fees f join public.parent_student_links l on l.student_id = f.student_id where f.class_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
      or exists (select 1 from public.attendance a join public.attendance_records ar on ar.attendance_id = a.id join public.parent_student_links l on l.student_id = ar.student_id where a.class_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
      or exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id join public.parent_student_links l on l.student_id = gr.student_id where g.class_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
    when 'academic_year' then
      exists (select 1 from public.student_enrollments e join public.parent_student_links l on l.student_id = e.student_id where e.academic_year_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
      or exists (select 1 from public.student_fees f join public.parent_student_links l on l.student_id = f.student_id where f.academic_year_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
      or exists (select 1 from public.attendance a join public.attendance_records ar on ar.attendance_id = a.id join public.parent_student_links l on l.student_id = ar.student_id where a.academic_year_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
      or exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id join public.parent_student_links l on l.student_id = gr.student_id where g.academic_year_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
    when 'term' then
      exists (select 1 from public.student_enrollments e join public.parent_student_links l on l.student_id = e.student_id where e.term_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
      or exists (select 1 from public.student_fees f join public.parent_student_links l on l.student_id = f.student_id where f.term_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
      or exists (select 1 from public.attendance a join public.attendance_records ar on ar.attendance_id = a.id join public.parent_student_links l on l.student_id = ar.student_id where a.term_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
      or exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id join public.parent_student_links l on l.student_id = gr.student_id where g.term_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
    when 'subject' then
      exists (select 1 from public.attendance a join public.attendance_records ar on ar.attendance_id = a.id join public.parent_student_links l on l.student_id = ar.student_id where a.subject_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
      or exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id join public.parent_student_links l on l.student_id = gr.student_id where g.subject_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
    when 'period' then
      exists (select 1 from public.attendance a join public.attendance_records ar on ar.attendance_id = a.id join public.parent_student_links l on l.student_id = ar.student_id where a.period_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
    when 'assessment' then
      exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id join public.parent_student_links l on l.student_id = gr.student_id where g.assessment_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
    when 'assessment_category' then
      exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id join public.parent_student_links l on l.student_id = gr.student_id where g.category_id = p_id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
    else false
  end
$$;
revoke all on function private.parent_portal_can_view_context(text, uuid) from public, anon;
grant execute on function private.parent_portal_can_view_context(text, uuid) to authenticated;

drop policy if exists "parent_portal_classes_linked_labels" on public.classes;
create policy "parent_portal_classes_linked_labels" on public.classes for select to authenticated
using (private.parent_portal_can_view_context('class', classes.id));

drop policy if exists "parent_portal_years_linked_labels" on public.academic_years;
create policy "parent_portal_years_linked_labels" on public.academic_years for select to authenticated
using (private.parent_portal_can_view_context('academic_year', academic_years.id));

drop policy if exists "parent_portal_terms_linked_labels" on public.terms;
create policy "parent_portal_terms_linked_labels" on public.terms for select to authenticated
using (private.parent_portal_can_view_context('term', terms.id));

drop policy if exists "parent_portal_subjects_linked_labels" on public.subjects;
create policy "parent_portal_subjects_linked_labels" on public.subjects for select to authenticated
using (private.parent_portal_can_view_context('subject', subjects.id));

drop policy if exists "parent_portal_periods_linked_labels" on public.periods;
create policy "parent_portal_periods_linked_labels" on public.periods for select to authenticated
using (private.parent_portal_can_view_context('period', periods.id));

drop policy if exists "parent_portal_assessments_linked_labels" on public.assessments;
create policy "parent_portal_assessments_linked_labels" on public.assessments for select to authenticated
using (private.parent_portal_can_view_context('assessment', assessments.id));

drop policy if exists "parent_portal_assessment_categories_linked_labels" on public.assessment_categories;
create policy "parent_portal_assessment_categories_linked_labels" on public.assessment_categories for select to authenticated
using (private.parent_portal_can_view_context('assessment_category', assessment_categories.id));

drop policy if exists "parent_portal_schools_linked_labels" on public.schools;
create policy "parent_portal_schools_linked_labels" on public.schools for select to authenticated
using (private.parent_portal_can_view_context('school', schools.id));

commit;
