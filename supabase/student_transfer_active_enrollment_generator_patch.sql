-- Replace only the transfer-code generator. This patch requires the existing
-- student_transfer_admins and student_transfers tables.
BEGIN;

CREATE OR REPLACE FUNCTION public.generate_student_transfer_code(
  p_source_enrollment_id uuid,
  p_code_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_school_id uuid;
  v_student_id uuid;
  v_transfer_id uuid;
  v_active_year_id uuid;
  v_active_term_id uuid;
  v_active_year_count bigint;
  v_active_term_count bigint;
  v_expires_at timestamptz := now() + interval '5 days';
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sign in as a school administrator or accountant to generate a transfer code.';
  END IF;

  IF p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-fA-F]{64}$' THEN
    RAISE EXCEPTION 'A valid SHA-256 code hash is required.';
  END IF;

  IF NOT public.is_active_user()
     OR NOT (public.is_admin() OR public.is_accountant()) THEN
    RAISE EXCEPTION 'Only an active school administrator or accountant can generate a transfer code.';
  END IF;

  v_school_id := public.get_user_school_id();
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Your account is not linked to a school.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.student_transfer_admins AS transfer_admin
    WHERE transfer_admin.user_id = v_actor_id
      AND transfer_admin.school_id = v_school_id
  ) THEN
    RAISE EXCEPTION 'Your account is not authorized to generate transfer codes for this school.';
  END IF;

  SELECT count(*), (array_agg(year.id))[1]
    INTO v_active_year_count, v_active_year_id
  FROM public.academic_years AS year
  WHERE year.school_id = v_school_id
    AND lower(year.status::text) = 'active';

  IF v_active_year_count <> 1 THEN
    RAISE EXCEPTION 'The sending school must have exactly one active academic year.';
  END IF;

  SELECT count(*), (array_agg(term.id))[1]
    INTO v_active_term_count, v_active_term_id
  FROM public.terms AS term
  WHERE term.school_id = v_school_id
    AND term.academic_year_id = v_active_year_id
    AND lower(term.status::text) = 'active';

  IF v_active_term_count <> 1 THEN
    RAISE EXCEPTION 'The active academic year must have exactly one active term.';
  END IF;

  SELECT enrollment.student_id
    INTO v_student_id
  FROM public.student_enrollments AS enrollment
  JOIN public.profiles AS student_profile
    ON student_profile.id = enrollment.student_id
   AND student_profile.school_id = enrollment.school_id
  WHERE enrollment.id = p_source_enrollment_id
    AND enrollment.school_id = v_school_id
    AND enrollment.academic_year_id = v_active_year_id
    AND enrollment.term_id = v_active_term_id
    AND coalesce(enrollment.enrollment_status, 'Normal') NOT IN ('Transferred', 'Graduated');

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'The selected student must have an eligible enrollment in the active academic year and term.';
  END IF;

  UPDATE public.student_transfers AS transfer
  SET status = CASE
        WHEN transfer.code_expires_at <= now() THEN 'expired'
        ELSE 'revoked'
      END,
      updated_at = now()
  WHERE transfer.source_school_id = v_school_id
    AND transfer.source_student_id = v_student_id
    AND transfer.status = 'code_issued';

  INSERT INTO public.student_transfers (
    source_school_id,
    source_student_id,
    source_enrollment_id,
    code_hash,
    code_expires_at,
    created_by
  ) VALUES (
    v_school_id,
    v_student_id,
    p_source_enrollment_id,
    pg_catalog.decode(pg_catalog.lower(p_code_hash), 'hex'),
    v_expires_at,
    v_actor_id
  )
  RETURNING id INTO v_transfer_id;

  RETURN pg_catalog.jsonb_build_object(
    'transfer_id', v_transfer_id,
    'expires_at', v_expires_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_student_transfer_code(uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_student_transfer_code(uuid, text)
TO authenticated;

COMMIT;
