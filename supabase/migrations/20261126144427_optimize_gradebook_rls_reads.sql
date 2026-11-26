-- Cache stable, request-scoped security helper results once per statement.
ALTER POLICY active_user_guard ON public.grades
  USING ((SELECT private.is_active_authenticated_user()))
  WITH CHECK ((SELECT private.is_active_authenticated_user()));

ALTER POLICY active_user_guard ON public.grade_records
  USING ((SELECT private.is_active_authenticated_user()))
  WITH CHECK ((SELECT private.is_active_authenticated_user()));

ALTER POLICY "Super admins have full access" ON public.grades
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

ALTER POLICY "Super admins have full access" ON public.grade_records
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

ALTER POLICY student_librarian_premium_grades ON public.grades
  USING (
    lower((SELECT private.current_profile_role())) <> ALL (ARRAY['student'::text, 'librarian'::text])
    OR check_school_access(school_id, 'premium'::text)
  )
  WITH CHECK (
    lower((SELECT private.current_profile_role())) <> ALL (ARRAY['student'::text, 'librarian'::text])
    OR check_school_access(school_id, 'premium'::text)
  );

ALTER POLICY student_librarian_premium_grade_records ON public.grade_records
  USING (
    lower((SELECT private.current_profile_role())) <> ALL (ARRAY['student'::text, 'librarian'::text])
    OR check_school_access(school_id, 'premium'::text)
  )
  WITH CHECK (
    lower((SELECT private.current_profile_role())) <> ALL (ARRAY['student'::text, 'librarian'::text])
    OR check_school_access(school_id, 'premium'::text)
  );

ALTER POLICY grades_submitted_for_students_parents ON public.grades
  USING (
    COALESCE(lower((SELECT private.current_profile_role())), ''::text)
      <> ALL (ARRAY['student'::text, 'parent'::text])
    OR lower(status) = 'submitted'::text
  );

-- Parent-specific permissive policies were also being evaluated for staff rows.
-- The CASE keeps their existing access rule and skips the correlated check for staff.
ALTER POLICY parent_portal_grades_linked_select ON public.grades
  USING (
    CASE
      WHEN lower((SELECT private.current_profile_role())) = 'parent'::text THEN
        EXISTS (
          SELECT 1
          FROM public.grade_records AS record
          WHERE record.grade_id = grades.id
            AND private.parent_portal_can_access_student(record.student_id)
        )
      ELSE false
    END
  );

ALTER POLICY parent_portal_grade_records_linked_select ON public.grade_records
  USING (
    CASE
      WHEN lower((SELECT private.current_profile_role())) = 'parent'::text THEN
        private.parent_portal_can_access_student(student_id)
      ELSE false
    END
  );
