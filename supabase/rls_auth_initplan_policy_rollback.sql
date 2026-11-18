-- Restore the policy expressions captured in the supplied pg_policies export.
-- Run only if rolling back supabase/rls_auth_initplan_policy_patch.sql.
BEGIN;

ALTER POLICY "Only admins can create announcements" ON public."announcements"
  WITH CHECK (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  );

ALTER POLICY "Only admins can update announcements" ON public."announcements"
  USING (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  );

ALTER POLICY "Users can view announcements for their school and audience" ON public."announcements"
  USING (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))) OR (target_audience = 'All'::text) OR (target_audience ~~* (('%'::text || ( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid()))) || '%'::text))))
  );

ALTER POLICY "block_graduated_and_transferred_students_select" ON public."announcements"
  USING (
(NOT (EXISTS ( SELECT 1
   FROM student_enrollments
  WHERE ((student_enrollments.student_id = auth.uid()) AND (student_enrollments.school_id = announcements.school_id) AND (lower(TRIM(BOTH FROM COALESCE(student_enrollments.enrollment_status, ''::text))) = ANY (ARRAY['graduated'::text, 'transferred'::text]))))))
  );

ALTER POLICY "Teachers can create attendance records" ON public."attendance"
  WITH CHECK (
(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.school_id = attendance.school_id) AND ((profiles.role = 'admin'::text) OR ((profiles.role = 'teacher'::text) AND (EXISTS ( SELECT 1
           FROM teacher_assignments ta
          WHERE ((ta.teacher_id = auth.uid()) AND (ta.class_id = attendance.class_id) AND (ta.school_id = attendance.school_id) AND ((ta.status)::text = 'active'::text) AND (ta.is_archived = false)))))))))
  );

ALTER POLICY "Teachers can update attendance records in their school" ON public."attendance"
  USING (
((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'teacher'::text) AND (profiles.school_id = attendance.school_id)))) AND (teacher_id = auth.uid()))
  );

ALTER POLICY "Users can view attendance records in their school" ON public."attendance"
  USING (
((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.school_id = attendance.school_id)))) AND ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'teacher'::text) AND (attendance.teacher_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = auth.uid()) AND (s.class_id = attendance.class_id)))) OR student_has_attendance(id)))
  );

ALTER POLICY "Super-admins can view bandwidth logs" ON public."bandwidth_logs"
  USING (
(EXISTS ( SELECT 1
   FROM cp_admins
  WHERE ((cp_admins.id = auth.uid()) AND (cp_admins.role = 'super-admin'::text) AND (cp_admins.status = 'active'::text))))
  );

ALTER POLICY "Manage book borrowings" ON public."book_borrowings"
  USING (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((lower(( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid()))) = ANY (ARRAY['admin'::text, 'librarian'::text])) OR (borrower_id = auth.uid())))
  )
  WITH CHECK (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((lower(( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid()))) = ANY (ARRAY['admin'::text, 'librarian'::text])) OR (borrower_id = auth.uid())))
  );

ALTER POLICY "Insert books" ON public."books"
  WITH CHECK (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'librarian'::text])) AND check_school_access(school_id, 'premium'::text))
  );

ALTER POLICY "Select books" ON public."books"
  USING (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND check_school_access(school_id, 'premium'::text))
  );

ALTER POLICY "Update books" ON public."books"
  USING (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'librarian'::text])) AND check_school_access(school_id, 'premium'::text))
  )
  WITH CHECK (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'librarian'::text])) AND check_school_access(school_id, 'premium'::text))
  );

ALTER POLICY "block_graduated_and_transferred_students_select" ON public."books"
  USING (
(NOT (EXISTS ( SELECT 1
   FROM student_enrollments
  WHERE ((student_enrollments.student_id = auth.uid()) AND (student_enrollments.school_id = books.school_id) AND (lower(TRIM(BOTH FROM COALESCE(student_enrollments.enrollment_status, ''::text))) = ANY (ARRAY['graduated'::text, 'transferred'::text]))))))
  );

ALTER POLICY "Allow admins to update own profile or super-admins update any" ON public."cp_admins"
  USING (
((auth.uid() = id) OR is_super_admin())
  );

ALTER POLICY "Allow users to read own admin profile or super admins read all" ON public."cp_admins"
  USING (
((auth.uid() = id) OR is_super_admin())
  );

ALTER POLICY "Super-admins can view audit logs" ON public."cp_audit_logs"
  USING (
(EXISTS ( SELECT 1
   FROM cp_admins
  WHERE ((cp_admins.id = auth.uid()) AND (cp_admins.role = 'super-admin'::text) AND (cp_admins.status = 'active'::text))))
  );

ALTER POLICY "Super admins can insert platform settings" ON public."cp_platform_settings"
  WITH CHECK (
(EXISTS ( SELECT 1
   FROM cp_admins admin
  WHERE ((admin.id = auth.uid()) AND (admin.status = 'active'::text) AND (lower(replace(admin.role, '_'::text, '-'::text)) = 'super-admin'::text))))
  );

ALTER POLICY "Super admins can read platform settings" ON public."cp_platform_settings"
  USING (
((EXISTS ( SELECT 1
   FROM cp_admins admin
  WHERE ((admin.id = auth.uid()) AND (admin.status = 'active'::text) AND (lower(replace(admin.role, '_'::text, '-'::text)) = 'super-admin'::text)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (lower(profiles.role) = 'admin'::text) AND (lower(profiles.status) = 'active'::text)))))
  );

ALTER POLICY "Super admins can update platform settings" ON public."cp_platform_settings"
  USING (
(EXISTS ( SELECT 1
   FROM cp_admins admin
  WHERE ((admin.id = auth.uid()) AND (admin.status = 'active'::text) AND (lower(replace(admin.role, '_'::text, '-'::text)) = 'super-admin'::text))))
  )
  WITH CHECK (
(EXISTS ( SELECT 1
   FROM cp_admins admin
  WHERE ((admin.id = auth.uid()) AND (admin.status = 'active'::text) AND (lower(replace(admin.role, '_'::text, '-'::text)) = 'super-admin'::text))))
  );

ALTER POLICY "Enable insert access for admins and teachers on grade_records" ON public."grade_records"
  WITH CHECK (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'teacher'::text])))
  );

ALTER POLICY "Enable select for grade records based on role and school" ON public."grade_records"
  USING (
((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text) AND (p.school_id = grade_records.school_id)))) OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'teacher'::text) AND (p.school_id = grade_records.school_id)))) AND teacher_created_grade(grade_id, auth.uid())) OR ((student_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'student'::text) AND (p.school_id = grade_records.school_id))))))
  );

ALTER POLICY "Enable update access for admins and teachers on grade_records" ON public."grade_records"
  USING (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'teacher'::text])))
  );

ALTER POLICY "Enable insert access for admins and teachers on grades" ON public."grades"
  WITH CHECK (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'teacher'::text])))
  );

ALTER POLICY "Enable select for users based on role and school" ON public."grades"
  USING (
((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text) AND (profiles.school_id = grades.school_id)))) OR ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'teacher'::text) AND (profiles.school_id = grades.school_id)))) AND ((created_by = auth.uid()) OR (created_by IN ( SELECT teachers.id
   FROM teachers
  WHERE (teachers.id = auth.uid()))))) OR ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'student'::text) AND (profiles.school_id = grades.school_id)))) AND (EXISTS ( SELECT 1
   FROM grade_records
  WHERE ((grade_records.grade_id = grades.id) AND (grade_records.student_id = auth.uid()))))))
  );

ALTER POLICY "Enable update access for admins and creators on grades" ON public."grades"
  USING (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text) OR (created_by = auth.uid())))
  );

ALTER POLICY "Staff can insert notifications for users" ON public."notifications"
  WITH CHECK (
((school_id IN ( SELECT profiles.school_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'teacher'::text, 'librarian'::text, 'accountant'::text]))))) AND (user_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.school_id = notifications.school_id))))
  );

ALTER POLICY "Users can update their own notification read status" ON public."notifications"
  USING (
((school_id IN ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (user_id = auth.uid()))
  )
  WITH CHECK (
((school_id IN ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (user_id = auth.uid()))
  );

ALTER POLICY "Users can view their own notifications" ON public."notifications"
  USING (
((school_id IN ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (user_id = auth.uid()))
  );

ALTER POLICY "payment_allocations_insert_policy" ON public."payment_allocations"
  WITH CHECK (
(EXISTS ( SELECT 1
   FROM payment_transactions pt
  WHERE ((pt.id = payment_allocations.payment_transaction_id) AND (pt.school_id = ( SELECT profiles.school_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
           FROM profiles
          WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'accountant'::text])))))
  );

ALTER POLICY "payment_allocations_select_policy" ON public."payment_allocations"
  USING (
(EXISTS ( SELECT 1
   FROM payment_transactions pt
  WHERE ((pt.id = payment_allocations.payment_transaction_id) AND (pt.school_id = ( SELECT profiles.school_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))) AND ((( SELECT profiles.role
           FROM profiles
          WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'accountant'::text])) OR (pt.student_id = auth.uid())))))
  );

ALTER POLICY "payment_allocations_update_policy" ON public."payment_allocations"
  USING (
(EXISTS ( SELECT 1
   FROM payment_transactions pt
  WHERE ((pt.id = payment_allocations.payment_transaction_id) AND (pt.school_id = ( SELECT profiles.school_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
           FROM profiles
          WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'accountant'::text])))))
  );

ALTER POLICY "payment_transactions_insert_policy" ON public."payment_transactions"
  WITH CHECK (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'accountant'::text])))
  );

ALTER POLICY "payment_transactions_select_policy" ON public."payment_transactions"
  USING (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'accountant'::text])) OR (student_id = auth.uid())))
  );

ALTER POLICY "payment_transactions_update_policy" ON public."payment_transactions"
  USING (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'accountant'::text])))
  )
  WITH CHECK (
(school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))
  );

ALTER POLICY "Users update own profile or admins update school profiles" ON public."profiles"
  USING (
((id = auth.uid()) OR (is_admin() AND (school_id = get_user_school_id())) OR (is_accountant() AND (school_id = get_user_school_id()) AND (role = 'student'::text)))
  )
  WITH CHECK (
((is_admin() AND (school_id = get_user_school_id())) OR (is_accountant() AND (school_id = get_user_school_id()) AND (role = 'student'::text)) OR ((id = auth.uid()) AND (lower(status) = 'active'::text) AND (COALESCE(is_archived, false) = false)))
  );

ALTER POLICY "Staff can insert activities" ON public."recent_activities"
  WITH CHECK (
(school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))
  );

ALTER POLICY "Users can view activities in their school" ON public."recent_activities"
  USING (
((school_id = ( SELECT p.school_id
   FROM profiles p
  WHERE (p.id = auth.uid()))) AND ((target_audience ~~* '%Everyone%'::text) OR (target_audience ~~* '%All%'::text) OR (target_audience ~~* (('%'::text || ( SELECT p.role
   FROM profiles p
  WHERE (p.id = auth.uid()))) || '%'::text)) OR (target_audience ~~* (('%'::text || ( SELECT p.role
   FROM profiles p
  WHERE (p.id = auth.uid()))) || 's%'::text))))
  );

ALTER POLICY "block_graduated_and_transferred_students_select" ON public."schools"
  USING (
(NOT (EXISTS ( SELECT 1
   FROM student_enrollments
  WHERE ((student_enrollments.student_id = auth.uid()) AND (student_enrollments.school_id = schools.id) AND (lower(TRIM(BOTH FROM COALESCE(student_enrollments.enrollment_status, ''::text))) = ANY (ARRAY['graduated'::text, 'transferred'::text]))))))
  );

ALTER POLICY "Tenant Select Policy" ON public."student_enrollments"
  USING (
((school_id = get_user_school_id()) AND is_active_user() AND (is_admin() OR is_accountant() OR (student_id = auth.uid())))
  );

ALTER POLICY "student_fees_insert_policy" ON public."student_fees"
  WITH CHECK (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'accountant'::text])))
  );

ALTER POLICY "student_fees_select_policy" ON public."student_fees"
  USING (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'accountant'::text])) OR (student_id = auth.uid())))
  );

ALTER POLICY "student_fees_update_policy" ON public."student_fees"
  USING (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'accountant'::text])))
  )
  WITH CHECK (
(school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))
  );

ALTER POLICY "Admins and accountants can insert students in their school" ON public."students"
  WITH CHECK (
(is_active_user() AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'accountant'::text]))))) AND (school_id = get_user_school_id()))
  );

ALTER POLICY "Students update own record or admins and accountants update sch" ON public."students"
  USING (
(is_active_user() AND ((id = auth.uid()) OR ((school_id = get_user_school_id()) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'accountant'::text]))))))))
  )
  WITH CHECK (
(is_active_user() AND (((school_id = get_user_school_id()) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'accountant'::text])))))) OR ((id = auth.uid()) AND (is_archived = false))))
  );

ALTER POLICY "Students view own record or admins and accountants view school " ON public."students"
  USING (
((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.school_id = students.school_id) AND (profiles.role = ANY (ARRAY['admin'::text, 'accountant'::text, 'librarian'::text]))))) OR teacher_has_student(auth.uid(), id) OR (id = auth.uid()))
  );

ALTER POLICY "Insert teacher assignments" ON public."teacher_assignments"
  WITH CHECK (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text))
  );

ALTER POLICY "Update teacher assignments" ON public."teacher_assignments"
  USING (
(school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))
  )
  WITH CHECK (
((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text))
  );

ALTER POLICY "Active users can view teachers in their school" ON public."teachers"
  USING (
(is_active_user() AND ((is_admin() AND (school_id = get_user_school_id())) OR ((id = auth.uid()) AND (school_id = get_user_school_id()) AND (is_archived = false))))
  );

ALTER POLICY "Users update own teacher record or admins update school teacher" ON public."teachers"
  USING (
(is_active_user() AND ((id = auth.uid()) OR (is_admin() AND (school_id = get_user_school_id()))))
  )
  WITH CHECK (
(is_active_user() AND ((is_admin() AND (school_id = get_user_school_id())) OR ((id = auth.uid()) AND (is_archived = false))))
  );

ALTER POLICY "Admins can insert lessons for their school" ON public."timetable_lessons"
  WITH CHECK (
(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text) AND (profiles.school_id = timetable_lessons.school_id))))
  );

ALTER POLICY "Admins can update lessons in their school" ON public."timetable_lessons"
  USING (
(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text) AND (profiles.school_id = timetable_lessons.school_id))))
  );

ALTER POLICY "Users can view lessons in their school" ON public."timetable_lessons"
  USING (
((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.school_id = timetable_lessons.school_id)))) AND ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))) OR (teacher_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (timetables t
     JOIN students s ON ((s.class_id = t.class_id)))
  WHERE ((t.id = timetable_lessons.timetable_id) AND (s.id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (timetables t
     JOIN teacher_assignments ta ON ((ta.class_id = t.class_id)))
  WHERE ((t.id = timetable_lessons.timetable_id) AND (ta.teacher_id = auth.uid()))))))
  );

ALTER POLICY "Admins can insert timetables for their school" ON public."timetables"
  WITH CHECK (
(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text) AND (profiles.school_id = timetables.school_id))))
  );

ALTER POLICY "Admins can update timetables in their school" ON public."timetables"
  USING (
(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text) AND (profiles.school_id = timetables.school_id))))
  );

ALTER POLICY "timetables_select_policy" ON public."timetables"
  USING (
((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.school_id = timetables.school_id)))) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = auth.uid()) AND (s.class_id = timetables.class_id)))) OR (EXISTS ( SELECT 1
   FROM teacher_assignments ta
  WHERE ((ta.teacher_id = auth.uid()) AND (ta.class_id = timetables.class_id))))))
  );

COMMIT;
