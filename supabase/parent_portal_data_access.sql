-- Apply after parent_portal_schema_proposal.sql and after the profiles role
-- constraint accepts the `parent` role. This adds read-only access to records
-- belonging to actively linked students. Existing school-wide permissive
-- policies are kept for staff; restrictive policies below narrow parent reads
-- so those existing policies cannot expose classmates' records.

begin;


-- Private, parameterless helper avoids recursively querying profiles from its
-- own RLS policy. It can only return the role attached to the current JWT user.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role::text
  from public.profiles as p
  where p.id = (select auth.uid())
  limit 1
$$;
revoke all on function private.current_profile_role() from public, anon;
grant execute on function private.current_profile_role() to authenticated;
-- SECURITY DEFINER prevents attendance/attendance_records RLS policies from
-- recursively evaluating each other. The result is scoped to auth.uid().
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

-- A parent can read only their own profile and the profiles of linked students.
drop policy if exists "parent_portal_profile_select_scope" on public.profiles;
create policy "parent_portal_profile_select_scope"
  on public.profiles as restrictive for select to authenticated
  using (
    coalesce(private.current_profile_role() <> 'parent', true)
    or id = (select auth.uid())
    or exists (
      select 1 from public.parent_student_links as link
      where link.parent_user_id = (select auth.uid())
        and link.student_id = profiles.id
        and link.status = 'active'
    )
  );

-- Students: linked parents get the selected child, not the school roster.
drop policy if exists "parent_portal_students_linked_select" on public.students;
create policy "parent_portal_students_linked_select"
  on public.students for select to authenticated
  using (exists (
    select 1 from public.parent_student_links as link
    where link.parent_user_id = (select auth.uid())
      and link.student_id = students.id and link.status = 'active'
  ));
drop policy if exists "parent_portal_students_select_scope" on public.students;
create policy "parent_portal_students_select_scope"
  on public.students as restrictive for select to authenticated
  using (
    coalesce(private.current_profile_role() <> 'parent', true)
    or exists (select 1 from public.parent_student_links l where l.parent_user_id = (select auth.uid()) and l.student_id = students.id and l.status = 'active')
  );

-- Enrollments.
drop policy if exists "parent_portal_enrollments_linked_select" on public.student_enrollments;
create policy "parent_portal_enrollments_linked_select"
  on public.student_enrollments for select to authenticated
  using (exists (
    select 1 from public.parent_student_links l
    where l.parent_user_id = (select auth.uid()) and l.student_id = student_enrollments.student_id and l.status = 'active'
  ));
drop policy if exists "parent_portal_enrollments_select_scope" on public.student_enrollments;
create policy "parent_portal_enrollments_select_scope"
  on public.student_enrollments as restrictive for select to authenticated
  using (
    coalesce(private.current_profile_role() <> 'parent', true)
    or exists (select 1 from public.parent_student_links l where l.parent_user_id = (select auth.uid()) and l.student_id = student_enrollments.student_id and l.status = 'active')
  );

-- Fee balances and payment transactions.
drop policy if exists "parent_portal_fees_linked_select" on public.student_fees;
create policy "parent_portal_fees_linked_select"
  on public.student_fees for select to authenticated
  using (exists (
    select 1 from public.parent_student_links l
    where l.parent_user_id = (select auth.uid()) and l.student_id = student_fees.student_id and l.status = 'active'
  ));
drop policy if exists "parent_portal_fees_select_scope" on public.student_fees;
create policy "parent_portal_fees_select_scope"
  on public.student_fees as restrictive for select to authenticated
  using (
    coalesce(private.current_profile_role() <> 'parent', true)
    or exists (select 1 from public.parent_student_links l where l.parent_user_id = (select auth.uid()) and l.student_id = student_fees.student_id and l.status = 'active')
  );

drop policy if exists "parent_portal_payments_linked_select" on public.payment_transactions;
create policy "parent_portal_payments_linked_select"
  on public.payment_transactions for select to authenticated
  using (exists (
    select 1 from public.parent_student_links l
    where l.parent_user_id = (select auth.uid()) and l.student_id = payment_transactions.student_id and l.status = 'active'
  ));
drop policy if exists "parent_portal_payments_select_scope" on public.payment_transactions;
create policy "parent_portal_payments_select_scope"
  on public.payment_transactions as restrictive for select to authenticated
  using (
    coalesce(private.current_profile_role() <> 'parent', true)
    or exists (select 1 from public.parent_student_links l where l.parent_user_id = (select auth.uid()) and l.student_id = payment_transactions.student_id and l.status = 'active')
  );

drop policy if exists "parent_portal_payment_allocations_linked_select" on public.payment_allocations;
create policy "parent_portal_payment_allocations_linked_select"
  on public.payment_allocations for select to authenticated
  using (exists (
    select 1 from public.payment_transactions pt
    join public.parent_student_links l on l.student_id = pt.student_id
    where pt.id = payment_allocations.payment_transaction_id
      and l.parent_user_id = (select auth.uid()) and l.status = 'active'
  ));
drop policy if exists "parent_portal_payment_allocations_select_scope" on public.payment_allocations;
create policy "parent_portal_payment_allocations_select_scope"
  on public.payment_allocations as restrictive for select to authenticated
  using (
    coalesce(private.current_profile_role() <> 'parent', true)
    or exists (
      select 1 from public.payment_transactions pt
      join public.parent_student_links l on l.student_id = pt.student_id
      where pt.id = payment_allocations.payment_transaction_id
        and l.parent_user_id = (select auth.uid()) and l.status = 'active'
    )
  );

-- Attendance details are scoped by the child record; session rows are visible
-- only when they include an attendance record for one of the parent's students.
drop policy if exists "parent_portal_attendance_records_linked_select" on public.attendance_records;
create policy "parent_portal_attendance_records_linked_select"
  on public.attendance_records for select to authenticated
  using (exists (
    select 1 from public.parent_student_links l
    where l.parent_user_id = (select auth.uid()) and l.student_id = attendance_records.student_id and l.status = 'active'
  ));
drop policy if exists "parent_portal_attendance_records_select_scope" on public.attendance_records;
create policy "parent_portal_attendance_records_select_scope"
  on public.attendance_records as restrictive for select to authenticated
  using (
    coalesce(private.current_profile_role() <> 'parent', true)
    or exists (select 1 from public.parent_student_links l where l.parent_user_id = (select auth.uid()) and l.student_id = attendance_records.student_id and l.status = 'active')
  );

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

-- Grades: score rows and their parent assessment rows are limited to linked
-- students with published/submitted grade records.
drop policy if exists "parent_portal_grade_records_linked_select" on public.grade_records;
create policy "parent_portal_grade_records_linked_select"
  on public.grade_records for select to authenticated
  using (exists (
    select 1 from public.parent_student_links l
    where l.parent_user_id = (select auth.uid()) and l.student_id = grade_records.student_id and l.status = 'active'
  ));
drop policy if exists "parent_portal_grade_records_select_scope" on public.grade_records;
create policy "parent_portal_grade_records_select_scope"
  on public.grade_records as restrictive for select to authenticated
  using (
    coalesce(private.current_profile_role() <> 'parent', true)
    or exists (select 1 from public.parent_student_links l where l.parent_user_id = (select auth.uid()) and l.student_id = grade_records.student_id and l.status = 'active')
  );

drop policy if exists "parent_portal_grades_linked_select" on public.grades;
create policy "parent_portal_grades_linked_select"
  on public.grades for select to authenticated
  using (exists (
    select 1 from public.grade_records gr
    join public.parent_student_links l on l.student_id = gr.student_id
    where gr.grade_id = grades.id
      and l.parent_user_id = (select auth.uid()) and l.status = 'active'
  ));
drop policy if exists "parent_portal_grades_select_scope" on public.grades;
create policy "parent_portal_grades_select_scope"
  on public.grades as restrictive for select to authenticated
  using (
    coalesce(private.current_profile_role() <> 'parent', true)
    or exists (
      select 1 from public.grade_records gr
      join public.parent_student_links l on l.student_id = gr.student_id
      where gr.grade_id = grades.id
        and l.parent_user_id = (select auth.uid()) and l.status = 'active'
    )
  );

-- Prevent parent accounts from writing school records even if another broad
-- permissive write policy exists. Staff behavior is unchanged.
do $parent_readonly$
declare
  table_name text;
  op text;
  policy_name text;
begin
  foreach table_name in array array[
    'profiles', 'students', 'student_enrollments', 'student_fees',
    'payment_transactions', 'payment_allocations', 'attendance_records',
    'attendance', 'grade_records', 'grades'
  ] loop
    foreach op in array array['insert', 'update', 'delete'] loop
      policy_name := 'parent_portal_read_only_' || table_name || '_' || op;
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
      if op = 'insert' then
        execute format(
          'create policy %I on public.%I as restrictive for insert to authenticated with check (coalesce(private.current_profile_role() <> %L, true))',
          policy_name, table_name, 'parent'
        );
      elsif op = 'update' then
        execute format(
          'create policy %I on public.%I as restrictive for update to authenticated using (coalesce(private.current_profile_role() <> %L, true)) with check (coalesce(private.current_profile_role() <> %L, true))',
          policy_name, table_name, 'parent', 'parent'
        );
      else
        execute format(
          'create policy %I on public.%I as restrictive for delete to authenticated using (coalesce(private.current_profile_role() <> %L, true))',
          policy_name, table_name, 'parent'
        );
      end if;
    end loop;
  end loop;
end;
$parent_readonly$;

-- Expose only period/class/subject labels that are attached to a linked
-- student's records. This lets history filters display readable names.
drop policy if exists "parent_portal_classes_linked_labels" on public.classes;
create policy "parent_portal_classes_linked_labels" on public.classes for select to authenticated
using (
  exists (select 1 from public.student_enrollments e join public.parent_student_links l on l.student_id = e.student_id where e.class_id = classes.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
  or exists (select 1 from public.student_fees f join public.parent_student_links l on l.student_id = f.student_id where f.class_id = classes.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
  or exists (select 1 from public.attendance a join public.attendance_records ar on ar.attendance_id = a.id join public.parent_student_links l on l.student_id = ar.student_id where a.class_id = classes.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
  or exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id join public.parent_student_links l on l.student_id = gr.student_id where g.class_id = classes.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
);

drop policy if exists "parent_portal_years_linked_labels" on public.academic_years;
create policy "parent_portal_years_linked_labels" on public.academic_years for select to authenticated
using (
  exists (select 1 from public.student_enrollments e join public.parent_student_links l on l.student_id = e.student_id where e.academic_year_id = academic_years.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
  or exists (select 1 from public.student_fees f join public.parent_student_links l on l.student_id = f.student_id where f.academic_year_id = academic_years.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
  or exists (select 1 from public.attendance a join public.attendance_records ar on ar.attendance_id = a.id join public.parent_student_links l on l.student_id = ar.student_id where a.academic_year_id = academic_years.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
  or exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id join public.parent_student_links l on l.student_id = gr.student_id where g.academic_year_id = academic_years.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
);

drop policy if exists "parent_portal_terms_linked_labels" on public.terms;
create policy "parent_portal_terms_linked_labels" on public.terms for select to authenticated
using (
  exists (select 1 from public.student_enrollments e join public.parent_student_links l on l.student_id = e.student_id where e.term_id = terms.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
  or exists (select 1 from public.student_fees f join public.parent_student_links l on l.student_id = f.student_id where f.term_id = terms.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
  or exists (select 1 from public.attendance a join public.attendance_records ar on ar.attendance_id = a.id join public.parent_student_links l on l.student_id = ar.student_id where a.term_id = terms.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
  or exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id join public.parent_student_links l on l.student_id = gr.student_id where g.term_id = terms.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
);

drop policy if exists "parent_portal_subjects_linked_labels" on public.subjects;
create policy "parent_portal_subjects_linked_labels" on public.subjects for select to authenticated
using (
  exists (select 1 from public.attendance a join public.attendance_records ar on ar.attendance_id = a.id join public.parent_student_links l on l.student_id = ar.student_id where a.subject_id = subjects.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
  or exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id join public.parent_student_links l on l.student_id = gr.student_id where g.subject_id = subjects.id and l.parent_user_id = (select auth.uid()) and l.status = 'active')
);

drop policy if exists "parent_portal_periods_linked_labels" on public.periods;
create policy "parent_portal_periods_linked_labels" on public.periods for select to authenticated
using (exists (
  select 1 from public.attendance a
  join public.attendance_records ar on ar.attendance_id = a.id
  join public.parent_student_links l on l.student_id = ar.student_id
  where a.period_id = periods.id and l.parent_user_id = (select auth.uid()) and l.status = 'active'
));

drop policy if exists "parent_portal_assessments_linked_labels" on public.assessments;
create policy "parent_portal_assessments_linked_labels" on public.assessments for select to authenticated
using (exists (
  select 1 from public.grades g
  join public.grade_records gr on gr.grade_id = g.id
  join public.parent_student_links l on l.student_id = gr.student_id
  where g.assessment_id = assessments.id and l.parent_user_id = (select auth.uid()) and l.status = 'active'
));

drop policy if exists "parent_portal_assessment_categories_linked_labels" on public.assessment_categories;
create policy "parent_portal_assessment_categories_linked_labels" on public.assessment_categories for select to authenticated
using (exists (
  select 1 from public.grades g
  join public.grade_records gr on gr.grade_id = g.id
  join public.parent_student_links l on l.student_id = gr.student_id
  where g.category_id = assessment_categories.id and l.parent_user_id = (select auth.uid()) and l.status = 'active'
));

-- Allow school names only when an active linked child has data for that school.
drop policy if exists "parent_portal_schools_linked_labels" on public.schools;
create policy "parent_portal_schools_linked_labels"
  on public.schools for select to authenticated
  using (exists (
    select 1 from public.parent_student_links l
    where l.parent_user_id = (select auth.uid()) and l.status = 'active'
      and (
        l.school_id = schools.id
        or exists (select 1 from public.students s where s.id = l.student_id and s.school_id = schools.id)
        or exists (select 1 from public.student_enrollments e where e.student_id = l.student_id and e.school_id = schools.id)
        or exists (select 1 from public.student_fees f where f.student_id = l.student_id and f.school_id = schools.id)
        or exists (select 1 from public.payment_transactions pt where pt.student_id = l.student_id and pt.school_id = schools.id)
        or exists (select 1 from public.attendance a join public.attendance_records ar on ar.attendance_id = a.id where ar.student_id = l.student_id and a.school_id = schools.id)
        or exists (select 1 from public.grades g join public.grade_records gr on gr.grade_id = g.id where gr.student_id = l.student_id and g.school_id = schools.id)
      )
  ));

commit;
