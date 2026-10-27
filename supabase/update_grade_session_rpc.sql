CREATE OR REPLACE FUNCTION public.update_grade_session(
  p_grade_id uuid,
  p_status text DEFAULT NULL,
  p_records jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_school_id uuid;
  v_user_role text;
  v_class_id uuid;
  v_subject_id uuid;
  v_category_id uuid;
  v_assessment_id uuid;
  v_academic_year_id uuid;
  v_term_id uuid;
  v_is_assigned boolean := false;
  v_record jsonb;
  v_record_id uuid;
  v_score numeric;
  v_updated_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.school_id, p.role
  INTO v_school_id, v_user_role
  FROM public.profiles AS p
  WHERE p.id = v_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'User profile or school assignment not found.';
  END IF;

  IF v_user_role NOT IN ('admin', 'teacher') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and teachers can update grades.';
  END IF;

  SELECT
    g.class_id,
    g.subject_id,
    g.category_id,
    g.assessment_id,
    g.academic_year_id,
    g.term_id
  INTO
    v_class_id,
    v_subject_id,
    v_category_id,
    v_assessment_id,
    v_academic_year_id,
    v_term_id
  FROM public.grades AS g
  WHERE g.id = p_grade_id
    AND g.school_id = v_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The grade record was not found or you do not have access.'
      USING ERRCODE = '42501';
  END IF;

  IF v_user_role = 'teacher' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.teacher_assignments AS ta
      WHERE ta.teacher_id = v_user_id
        AND ta.class_id = v_class_id
        AND (ta.subject_id IS NULL OR ta.subject_id = v_subject_id)
    )
    INTO v_is_assigned;

    IF NOT v_is_assigned THEN
      RAISE EXCEPTION 'Unauthorized: Teacher is not assigned to this class/subject.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classes AS c
    WHERE c.id = v_class_id
      AND c.school_id = v_school_id
      AND lower(c.status) = 'active'
  ) THEN
    RAISE EXCEPTION 'The selected class is not active.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subjects AS s
    WHERE s.id = v_subject_id
      AND s.school_id = v_school_id
      AND lower(s.status) = 'active'
  ) THEN
    RAISE EXCEPTION 'The selected subject is not active.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.assessment_categories AS ac
    WHERE ac.id = v_category_id
      AND ac.school_id = v_school_id
      AND lower(ac.status) = 'active'
  ) THEN
    RAISE EXCEPTION 'The selected assessment category is not active.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.academic_years AS ay
    WHERE ay.id = v_academic_year_id
      AND ay.school_id = v_school_id
      AND lower(ay.status) = 'active'
  ) THEN
    RAISE EXCEPTION 'There is no active academic year for this grade entry.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.terms AS t
    WHERE t.id = v_term_id
      AND t.school_id = v_school_id
      AND t.academic_year_id = v_academic_year_id
      AND lower(t.status) = 'active'
  ) THEN
    RAISE EXCEPTION 'There is no active term for this academic year.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.assessments AS a
    WHERE a.id = v_assessment_id
      AND a.school_id = v_school_id
      AND a.academic_year_id = v_academic_year_id
      AND lower(a.status) = 'active'
      AND a.start_date IS NOT NULL
      AND a.end_date IS NOT NULL
      AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
  ) THEN
    RAISE EXCEPTION 'This assessment is not active for entry today. Check its status and date range.'
      USING ERRCODE = '23514';
  END IF;

  IF p_status IS NOT NULL AND lower(p_status) NOT IN ('drafted', 'submitted') THEN
    RAISE EXCEPTION 'Grade status must be drafted or submitted.'
      USING ERRCODE = '23514';
  END IF;

  IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
    RAISE EXCEPTION 'Grade updates must be provided as an array.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.grades AS g
  SET status = COALESCE(p_status, g.status),
      updated_at = pg_catalog.now()
  WHERE g.id = p_grade_id
    AND g.school_id = v_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The grade record was not updated or access was denied.'
      USING ERRCODE = '42501';
  END IF;

  FOR v_record IN
    SELECT value FROM jsonb_array_elements(p_records)
  LOOP
    BEGIN
      v_record_id := (v_record->>'record_id')::uuid;
      v_score := (v_record->>'score')::numeric;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Each grade update needs a valid record_id and numeric score.'
          USING ERRCODE = '22023';
    END;

    IF v_record_id IS NULL OR v_score IS NULL OR v_score < 0 THEN
      RAISE EXCEPTION 'Each grade update needs a record_id and a non-negative score.'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.grade_records AS gr
    SET score = v_score
    WHERE gr.id = v_record_id
      AND gr.grade_id = p_grade_id
      AND (gr.school_id = v_school_id OR gr.school_id IS NULL);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count <> 1 THEN
      RAISE EXCEPTION 'A student grade was not updated. The record may have changed or access was removed.'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN p_grade_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_grade_session(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_grade_session(uuid, text, jsonb) TO authenticated;
