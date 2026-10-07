CREATE OR REPLACE FUNCTION public.tr_enforce_payment_enrollment_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_school_id uuid;
    v_academic_year_id uuid;
    v_term_id uuid;
    v_enrollment_status text;
BEGIN
    SELECT fee.school_id, fee.academic_year_id, fee.term_id
    INTO v_school_id, v_academic_year_id, v_term_id
    FROM public.student_fees AS fee
    WHERE fee.id = NEW.student_fee_id
      AND fee.student_id = NEW.student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment does not match a student fee record for this student.';
    END IF;

    SELECT enrollment.enrollment_status
    INTO v_enrollment_status
    FROM public.student_enrollments AS enrollment
    WHERE enrollment.student_id = NEW.student_id
      AND enrollment.school_id = v_school_id
      AND enrollment.academic_year_id = v_academic_year_id
      AND enrollment.term_id = v_term_id
    ORDER BY enrollment.created_at DESC NULLS LAST, enrollment.id DESC
    LIMIT 1;

    IF v_enrollment_status IS NOT NULL AND (
        lower(btrim(v_enrollment_status)) LIKE '%graduated%'
        OR lower(btrim(v_enrollment_status)) LIKE '%transferred%'
    ) THEN
        RAISE EXCEPTION 'BLOCKED: This student has status "%" for the school and term attached to this fee. Cannot record fee payments for graduated or transferred students.', v_enrollment_status;
    END IF;

    RETURN NEW;
END;
$function$;
