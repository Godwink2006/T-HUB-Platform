BEGIN;

REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (full_name, phone_number, photo_url)
ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users update own profile or admins update school profiles"
ON public.profiles;

CREATE POLICY "Users update own profile or admins update school profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  is_active_user()
  AND (
    id = (SELECT auth.uid())
    OR (is_admin() AND school_id = get_user_school_id())
    OR (
      is_accountant()
      AND school_id = get_user_school_id()
      AND role = 'student'
    )
  )
)
WITH CHECK (
  is_active_user()
  AND (
    (
      id = (SELECT auth.uid())
      AND school_id = get_user_school_id()
      AND status = 'active'
      AND is_archived = false
    )
    OR (is_admin() AND school_id = get_user_school_id())
    OR (
      is_accountant()
      AND school_id = get_user_school_id()
      AND role = 'student'
    )
  )
);

DROP POLICY IF EXISTS "Exclude Graduated and Transfered student"
ON public.profiles;

CREATE POLICY "Exclude Graduated and Transfered student"
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1
    FROM public.student_enrollments AS se
    WHERE se.student_id = (SELECT auth.uid())
      AND se.school_id = profiles.school_id
      AND se.enrollment_status IN ('Graduated', 'Transferred')
  )
)
WITH CHECK (
  NOT EXISTS (
    SELECT 1
    FROM public.student_enrollments AS se
    WHERE se.student_id = (SELECT auth.uid())
      AND se.school_id = profiles.school_id
      AND se.enrollment_status IN ('Graduated', 'Transferred')
  )
);

DROP POLICY IF EXISTS "Exclude graduated and transferred students"
ON public.announcements;
CREATE POLICY "Exclude graduated and transferred students"
ON public.announcements
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1
    FROM public.student_enrollments AS se
    WHERE se.student_id = (SELECT auth.uid())
      AND se.school_id = announcements.school_id
      AND se.enrollment_status IN ('Graduated', 'Transferred')
  )
);

DROP POLICY IF EXISTS "Exclude Graduated and Transfered student from this school"
ON public.books;
CREATE POLICY "Exclude Graduated and Transfered student from this school"
ON public.books
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1
    FROM public.student_enrollments AS se
    WHERE se.student_id = (SELECT auth.uid())
      AND se.school_id = books.school_id
      AND se.enrollment_status IN ('Graduated', 'Transferred')
  )
);

DROP POLICY IF EXISTS "Exclude graduated and transferred students from activities"
ON public.recent_activities;
CREATE POLICY "Exclude graduated and transferred students from activities"
ON public.recent_activities
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1
    FROM public.student_enrollments AS se
    WHERE se.student_id = (SELECT auth.uid())
      AND se.school_id = recent_activities.school_id
      AND se.enrollment_status IN ('Graduated', 'Transferred')
  )
);

DROP POLICY IF EXISTS "Exclude Graduated and Transfered student"
ON public.teacher_assignments;
CREATE POLICY "Exclude Graduated and Transfered student"
ON public.teacher_assignments
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1
    FROM public.student_enrollments AS se
    WHERE se.student_id = (SELECT auth.uid())
      AND se.school_id = teacher_assignments.school_id
      AND se.enrollment_status IN ('Graduated', 'Transferred')
  )
);

DROP POLICY IF EXISTS "Exclude Graduated and Transfered student"
ON public.timetable_lessons;
CREATE POLICY "Exclude Graduated and Transfered student"
ON public.timetable_lessons
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1
    FROM public.student_enrollments AS se
    WHERE se.student_id = (SELECT auth.uid())
      AND se.school_id = timetable_lessons.school_id
      AND se.enrollment_status IN ('Graduated', 'Transferred')
  )
);

REVOKE UPDATE ON TABLE public.students FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Students update own record or admins and accountants update sch"
ON public.students;

DROP POLICY IF EXISTS "Role-based attendance records access"
ON public.attendance_records;
DROP POLICY IF EXISTS "Teachers can insert individual attendance line items"
ON public.attendance_records;
DROP POLICY IF EXISTS "Teachers can update individual attendance line items"
ON public.attendance_records;

CREATE POLICY "Attendance records are readable within the current school"
ON public.attendance_records
FOR SELECT
TO authenticated
USING (
  is_active_user()
  AND school_id = get_user_school_id()
  AND (
    is_admin()
    OR (
      student_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'student'
          AND p.school_id = attendance_records.school_id
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles AS p
      JOIN public.attendance AS a
        ON a.id = attendance_records.attendance_id
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'teacher'
        AND p.school_id = attendance_records.school_id
        AND a.school_id = attendance_records.school_id
        AND a.teacher_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY "Teachers insert attendance line items in their school"
ON public.attendance_records
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = get_user_school_id()
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.attendance AS a
      ON a.id = attendance_records.attendance_id
    JOIN public.students AS s
      ON s.id = attendance_records.student_id
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'teacher'
      AND p.school_id = attendance_records.school_id
      AND a.school_id = attendance_records.school_id
      AND s.school_id = attendance_records.school_id
  )
);

CREATE POLICY "Teachers update attendance line items in their school"
ON public.attendance_records
FOR UPDATE
TO authenticated
USING (
  is_active_user()
  AND school_id = get_user_school_id()
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.attendance AS a
      ON a.id = attendance_records.attendance_id
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'teacher'
      AND p.school_id = attendance_records.school_id
      AND a.school_id = attendance_records.school_id
      AND a.teacher_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  school_id = get_user_school_id()
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.attendance AS a
      ON a.id = attendance_records.attendance_id
    JOIN public.students AS s
      ON s.id = attendance_records.student_id
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'teacher'
      AND p.school_id = attendance_records.school_id
      AND a.school_id = attendance_records.school_id
      AND a.teacher_id = (SELECT auth.uid())
      AND s.school_id = attendance_records.school_id
  )
);

ALTER POLICY "Enable insert access for admins and teachers on grade_records"
ON public.grade_records TO authenticated;
ALTER POLICY "Enable select for grade records based on role and school"
ON public.grade_records TO authenticated;
ALTER POLICY "Enable insert access for admins and teachers on grades"
ON public.grades TO authenticated;
ALTER POLICY "Enable select for users based on role and school"
ON public.grades TO authenticated;
ALTER POLICY "student_fees_insert_policy"
ON public.student_fees TO authenticated;
ALTER POLICY "student_fees_select_policy"
ON public.student_fees TO authenticated;
ALTER POLICY "student_fees_update_policy"
ON public.student_fees TO authenticated;
ALTER POLICY "payment_transactions_insert_policy"
ON public.payment_transactions TO authenticated;
ALTER POLICY "payment_transactions_select_policy"
ON public.payment_transactions TO authenticated;
ALTER POLICY "payment_transactions_update_policy"
ON public.payment_transactions TO authenticated;

DROP POLICY IF EXISTS "Enable update access for admins and teachers on grade_records"
ON public.grade_records;

CREATE POLICY "Teachers update grade records they created in their school"
ON public.grade_records
FOR UPDATE
TO authenticated
USING (
  is_active_user()
  AND school_id = get_user_school_id()
  AND (
    is_admin()
    OR (
      EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'teacher'
          AND p.school_id = grade_records.school_id
      )
      AND teacher_created_grade(grade_id, (SELECT auth.uid()))
    )
  )
)
WITH CHECK (
  is_active_user()
  AND school_id = get_user_school_id()
  AND (
    is_admin()
    OR (
      EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'teacher'
          AND p.school_id = grade_records.school_id
      )
      AND teacher_created_grade(grade_id, (SELECT auth.uid()))
    )
  )
);

CREATE OR REPLACE FUNCTION public.tr_enforce_attendance_enrollment_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_academic_year_id uuid;
  v_school_id uuid;
  v_enrollment_status text;
BEGIN
  SELECT a.academic_year_id, a.school_id
  INTO v_academic_year_id, v_school_id
  FROM public.attendance AS a
  WHERE a.id = NEW.attendance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance session was not found.' USING errcode = '23503';
  END IF;

  IF NEW.school_id IS NULL THEN
    NEW.school_id := v_school_id;
  END IF;

  IF NEW.school_id IS DISTINCT FROM v_school_id THEN
    RAISE EXCEPTION 'Attendance record school does not match its session.' USING errcode = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.students AS s
    WHERE s.id = NEW.student_id
      AND s.school_id = v_school_id
  ) THEN
    RAISE EXCEPTION 'Student does not belong to the attendance school.' USING errcode = '23514';
  END IF;

  SELECT se.enrollment_status
  INTO v_enrollment_status
  FROM public.student_enrollments AS se
  WHERE se.student_id = NEW.student_id
    AND se.school_id = v_school_id
    AND se.academic_year_id = v_academic_year_id
  ORDER BY se.created_at DESC NULLS LAST, se.id DESC
  LIMIT 1;

  IF v_enrollment_status IS NULL THEN
    SELECT se.enrollment_status
    INTO v_enrollment_status
    FROM public.student_enrollments AS se
    WHERE se.student_id = NEW.student_id
      AND se.school_id = v_school_id
    ORDER BY se.created_at DESC NULLS LAST, se.id DESC
    LIMIT 1;
  END IF;

  IF lower(trim(coalesce(v_enrollment_status, ''))) IN ('graduated', 'transferred') THEN
    RAISE EXCEPTION 'Blocked: this student is %, so attendance cannot be saved.', v_enrollment_status
      USING errcode = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tr_enforce_grade_record_enrollment_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_academic_year_id uuid;
  v_school_id uuid;
  v_enrollment_status text;
BEGIN
  SELECT g.academic_year_id, g.school_id
  INTO v_academic_year_id, v_school_id
  FROM public.grades AS g
  WHERE g.id = NEW.grade_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grade record parent was not found.' USING errcode = '23503';
  END IF;

  IF NEW.school_id IS NULL THEN
    NEW.school_id := v_school_id;
  END IF;

  IF NEW.school_id IS DISTINCT FROM v_school_id THEN
    RAISE EXCEPTION 'Grade record school does not match its grade.' USING errcode = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.students AS s
    WHERE s.id = NEW.student_id
      AND s.school_id = v_school_id
  ) THEN
    RAISE EXCEPTION 'Student does not belong to the grade school.' USING errcode = '23514';
  END IF;

  SELECT se.enrollment_status
  INTO v_enrollment_status
  FROM public.student_enrollments AS se
  WHERE se.student_id = NEW.student_id
    AND se.school_id = v_school_id
    AND se.academic_year_id = v_academic_year_id
  ORDER BY se.created_at DESC NULLS LAST, se.id DESC
  LIMIT 1;

  IF v_enrollment_status IS NULL THEN
    SELECT se.enrollment_status
    INTO v_enrollment_status
    FROM public.student_enrollments AS se
    WHERE se.student_id = NEW.student_id
      AND se.school_id = v_school_id
    ORDER BY se.created_at DESC NULLS LAST, se.id DESC
    LIMIT 1;
  END IF;

  IF lower(trim(coalesce(v_enrollment_status, ''))) IN ('graduated', 'transferred') THEN
    RAISE EXCEPTION 'Blocked: this student is %, so grades cannot be saved.', v_enrollment_status
      USING errcode = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tr_enforce_payment_enrollment_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_fee_school_id uuid;
  v_academic_year_id uuid;
  v_term_id uuid;
  v_enrollment_status text;
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT sf.school_id
    INTO v_fee_school_id
    FROM public.student_fees AS sf
    WHERE sf.id = NEW.student_fee_id
      AND sf.student_id = NEW.student_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment fee record was not found for this student.' USING errcode = '23503';
    END IF;

    NEW.school_id := v_fee_school_id;
  END IF;

  SELECT sf.academic_year_id, sf.term_id
  INTO v_academic_year_id, v_term_id
  FROM public.student_fees AS sf
  WHERE sf.id = NEW.student_fee_id
    AND sf.school_id = NEW.school_id
    AND sf.student_id = NEW.student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment student, fee, and school must match.' USING errcode = '23514';
  END IF;

  SELECT se.enrollment_status
  INTO v_enrollment_status
  FROM public.student_enrollments AS se
  WHERE se.student_id = NEW.student_id
    AND se.school_id = NEW.school_id
    AND (v_academic_year_id IS NULL OR se.academic_year_id = v_academic_year_id)
    AND (v_term_id IS NULL OR se.term_id = v_term_id)
  ORDER BY se.created_at DESC NULLS LAST, se.id DESC
  LIMIT 1;

  IF v_enrollment_status IS NULL THEN
    SELECT se.enrollment_status
    INTO v_enrollment_status
    FROM public.student_enrollments AS se
    WHERE se.student_id = NEW.student_id
      AND se.school_id = NEW.school_id
    ORDER BY se.created_at DESC NULLS LAST, se.id DESC
    LIMIT 1;
  END IF;

  IF lower(trim(coalesce(v_enrollment_status, ''))) IN ('graduated', 'transferred') THEN
    RAISE EXCEPTION 'Blocked: this student is %, so payments cannot be recorded.', v_enrollment_status
      USING errcode = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_payment_transaction_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_total_fees numeric;
  v_total_paid numeric;
  v_new_status text;
BEGIN
  SELECT sf.total_fees
  INTO v_total_fees
  FROM public.student_fees AS sf
  WHERE sf.id = NEW.student_fee_id
    AND sf.school_id = NEW.school_id
    AND sf.student_id = NEW.student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment student, fee, and school must match.' USING errcode = '23514';
  END IF;

  SELECT coalesce(sum(pt.amount), 0)
  INTO v_total_paid
  FROM public.payment_transactions AS pt
  WHERE pt.student_fee_id = NEW.student_fee_id
    AND pt.school_id = NEW.school_id
    AND pt.student_id = NEW.student_id;

  IF v_total_paid >= v_total_fees THEN
    v_new_status := 'Paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'Partial';
  ELSE
    v_new_status := 'Unpaid';
  END IF;

  UPDATE public.student_fees AS sf
  SET total_paid = v_total_paid,
      status = v_new_status,
      updated_at = now()
  WHERE sf.id = NEW.student_fee_id
    AND sf.school_id = NEW.school_id
    AND sf.student_id = NEW.student_id;

  RETURN NEW;
END;
$function$;

COMMIT;
