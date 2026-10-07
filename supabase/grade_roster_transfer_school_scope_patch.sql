CREATE OR REPLACE FUNCTION public.get_active_class_students(p_class_id text)
RETURNS TABLE (
    id uuid,
    student_id text,
    class_id uuid,
    full_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_school_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required to load a class roster.';
    END IF;

    v_school_id := public.get_user_school_id();
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'No school is associated with the current user.';
    END IF;

    RETURN QUERY
    SELECT s.id, s.student_id, s.class_id, p.full_name
    FROM public.students AS s
    LEFT JOIN public.profiles AS p
      ON p.id = s.id
     AND p.school_id = v_school_id
    WHERE s.school_id = v_school_id
      AND s.class_id = p_class_id::uuid
      AND NOT EXISTS (
          SELECT 1
          FROM public.student_enrollments AS se
          WHERE se.student_id = s.id
            AND se.school_id = v_school_id
            AND se.class_id = s.class_id
            AND se.academic_year_id = s.academic_year_id
            AND lower(btrim(coalesce(se.enrollment_status, ''))) IN ('graduated', 'transferred')
      );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_active_class_students(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_class_students(text) TO authenticated;
