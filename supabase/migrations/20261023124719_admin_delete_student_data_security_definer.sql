-- Permanently remove a student and all records owned by that student.
-- The RPC is restricted to service_role; the Edge Function verifies the
-- authenticated school admin before calling it.
CREATE OR REPLACE FUNCTION public.admin_delete_student_data(
  p_student_id uuid,
  p_school_id uuid,
  p_execute boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_student_name text;
  v_blockers text[] := ARRAY[]::text[];
BEGIN
  SELECT p.full_name
    INTO v_student_name
  FROM public.profiles AS p
  JOIN public.students AS s ON s.id = p.id
  WHERE p.id = p_student_id
    AND p.school_id = p_school_id
    AND p.role = 'student'
    AND s.school_id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found in this school.' USING ERRCODE = 'P0002';
  END IF;

  -- These references represent staff/admin actions and cannot safely be
  -- cascaded with the student's own records.
  IF EXISTS (
    SELECT 1 FROM public.attendance AS a WHERE a.teacher_id = p_student_id
  ) THEN
    v_blockers := array_append(v_blockers, 'This profile is assigned as a teacher on attendance sessions.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parent_student_links AS psl
    WHERE psl.approved_by = p_student_id
      AND psl.student_id <> p_student_id
  ) THEN
    v_blockers := array_append(v_blockers, 'This profile approved parent links for other students.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.student_transfers AS st
    WHERE st.created_by = p_student_id
      AND st.source_student_id <> p_student_id
      AND st.target_student_id IS DISTINCT FROM p_student_id
  ) THEN
    v_blockers := array_append(v_blockers, 'This profile created a transfer for another student.');
  END IF;

  IF NOT p_execute THEN
    RETURN jsonb_build_object(
      'can_delete', cardinality(v_blockers) = 0,
      'student_name', v_student_name,
      'blockers', to_jsonb(v_blockers)
    );
  END IF;

  IF cardinality(v_blockers) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_blockers, ' ')
      USING ERRCODE = '23503';
  END IF;

  -- Remove transfer records that reference this student before deleting
  -- enrollments and the student row; their foreign keys intentionally restrict
  -- deletion so history is removed explicitly as part of a full purge.
  DELETE FROM public.student_transfer_history AS history
  WHERE history.source_student_id = p_student_id
     OR history.target_student_id = p_student_id
     OR history.transfer_id IN (
       SELECT transfer.id
       FROM public.student_transfers AS transfer
       WHERE transfer.source_student_id = p_student_id
          OR transfer.target_student_id = p_student_id
          OR transfer.source_enrollment_id IN (
            SELECT enrollment.id
            FROM public.student_enrollments AS enrollment
            WHERE enrollment.student_id = p_student_id
          )
     );

  DELETE FROM public.student_transfers AS transfer
  WHERE transfer.source_student_id = p_student_id
     OR transfer.target_student_id = p_student_id
     OR transfer.source_enrollment_id IN (
       SELECT enrollment.id
       FROM public.student_enrollments AS enrollment
       WHERE enrollment.student_id = p_student_id
     );

  -- Preserve unrelated transfer records if this profile was their acceptor.
  UPDATE public.student_transfers
  SET accepted_by = NULL
  WHERE accepted_by = p_student_id;

  DELETE FROM public.student_transfer_admins
  WHERE user_id = p_student_id;

  -- Deleting the profile cascades to the student, enrollments, attendance and
  -- grades, parent links, fees and payment history, borrowings, and notices.
  -- All statements above and the cascades below run in one database transaction.
  DELETE FROM public.profiles
  WHERE id = p_student_id
    AND school_id = p_school_id
    AND role = 'student';

  RETURN jsonb_build_object(
    'can_delete', true,
    'deleted', true,
    'student_id', p_student_id,
    'student_name', v_student_name
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_student_data(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_student_data(uuid, uuid, boolean)
  TO service_role;
