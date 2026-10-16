begin;

drop policy if exists "Clean tier and role profile access" on public.profiles;
create policy "Clean tier and role profile access"
on public.profiles
for select to authenticated
using (
  (
    school_id = public.get_auth_user_school_id()
    and public.get_auth_user_role() = any (
      array['admin'::text, 'teacher'::text, 'accountant'::text, 'receptionist'::text, 'librarian'::text]
    )
  )
  or (
    id = (select auth.uid())
    and role = any (array['student'::text, 'parent'::text])
  )
);

drop policy if exists parent_portal_profile_select_scope on public.profiles;
create policy parent_portal_profile_select_scope
on public.profiles
for select to authenticated
using (
  (select private.current_profile_role()) = 'parent'::text
  and (
    id = (select auth.uid())
    or exists (
      select 1
      from public.parent_student_links as link
      where link.parent_user_id = (select auth.uid())
        and link.student_id = profiles.id
        and link.school_id = profiles.school_id
        and link.status = 'active'
        and public.check_school_access(link.school_id, 'standard'::text)
    )
  )
);

drop policy if exists parent_portal_profiles_linked_select on public.profiles;
create policy parent_portal_profiles_linked_select
on public.profiles
for select to authenticated
using (
  (select private.current_profile_role()) = 'parent'::text
  and exists (
    select 1
    from public.parent_student_links as link
    where link.parent_user_id = (select auth.uid())
      and link.student_id = profiles.id
      and link.school_id = profiles.school_id
      and link.status = 'active'
      and public.check_school_access(link.school_id, 'standard'::text)
  )
);

drop policy if exists parent_portal_attendance_sessions_select_scope on public.attendance;
drop policy if exists parent_portal_attendance_records_select_scope on public.attendance_records;
drop policy if exists parent_portal_grade_records_select_scope on public.grade_records;
drop policy if exists parent_portal_grades_select_scope on public.grades;
drop policy if exists parent_portal_payment_allocations_select_scope on public.payment_allocations;
drop policy if exists parent_portal_payments_select_scope on public.payment_transactions;
drop policy if exists parent_portal_enrollments_select_scope on public.student_enrollments;
drop policy if exists parent_portal_fees_select_scope on public.student_fees;
drop policy if exists parent_portal_students_select_scope on public.students;
drop policy if exists parent_portal_timetable_lessons_select_scope on public.timetable_lessons;
drop policy if exists parent_portal_timetables_select_scope on public.timetables;

drop policy if exists "Exclude graduated and transferred students" on public.announcements;
drop policy if exists "Exclude Graduated and Transfered student from this school" on public.books;
drop policy if exists "Exclude Graduated and Transfered student" on public.profiles;
drop policy if exists "Exclude graduated and transferred students from activities" on public.recent_activities;
drop policy if exists "Exclude Graduated and Transfered student" on public.teacher_assignments;
drop policy if exists "Exclude Graduated and Transfered student" on public.timetable_lessons;
drop policy if exists "Exclude Graduated and Transfered student" on public.timetables;

do $$
declare
  table_name text;
  operation text;
  policy_name text;
begin
  foreach table_name in array array[
    'attendance',
    'attendance_records',
    'grade_records',
    'grades',
    'payment_allocations',
    'payment_transactions',
    'student_enrollments',
    'student_fees',
    'students'
  ]
  loop
    foreach operation in array array['delete', 'insert', 'update']
    loop
      policy_name := 'parent_portal_read_only_' || table_name || '_' || operation;
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
      if operation = 'delete' then
        execute format(
          'create policy %I on public.%I as restrictive for delete to authenticated using (coalesce(private.current_profile_role() <> ''parent'', true))',
          policy_name, table_name
        );
      elsif operation = 'insert' then
        execute format(
          'create policy %I on public.%I as restrictive for insert to authenticated with check (coalesce(private.current_profile_role() <> ''parent'', true))',
          policy_name, table_name
        );
      else
        execute format(
          'create policy %I on public.%I as restrictive for update to authenticated using (coalesce(private.current_profile_role() <> ''parent'', true)) with check (coalesce(private.current_profile_role() <> ''parent'', true))',
          policy_name, table_name
        );
      end if;
    end loop;
  end loop;
end
$$;

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'profiles',
    'students',
    'attendance',
    'attendance_records',
    'grade_records',
    'grades',
    'student_enrollments',
    'student_fees',
    'payment_transactions',
    'payment_allocations',
    'timetables',
    'timetable_lessons',
    'books',
    'book_borrowings'
  ]
  loop
    policy_name := 'student_librarian_premium_' || table_name;
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (coalesce(lower(private.current_profile_role()) not in (''student'', ''librarian''), true) or public.check_school_access(school_id, ''premium'')) with check (coalesce(lower(private.current_profile_role()) not in (''student'', ''librarian''), true) or public.check_school_access(school_id, ''premium''))',
      policy_name, table_name
    );
  end loop;
end
$$;
commit;

