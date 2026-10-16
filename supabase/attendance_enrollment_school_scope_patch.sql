
begin;

create or replace function public.save_attendance_with_records(
  p_attendance_id uuid,
  p_school_id uuid,
  p_class_id uuid,
  p_subject_id uuid,
  p_period_id uuid,
  p_assessment_id uuid,
  p_teacher_id uuid,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_date date,
  p_status text,
  p_records jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_attendance_id uuid;
  v_record jsonb;
  v_student_id uuid;
  v_enrollment_status text;
begin
  if p_records is null or pg_catalog.jsonb_typeof(p_records) <> 'array' then
    raise exception 'Attendance records must be provided as a JSON array.';
  end if;

  for v_record in
    select record_value
    from pg_catalog.jsonb_array_elements(p_records) as records(record_value)
  loop
    v_student_id := (v_record->>'student_id')::uuid;
    v_enrollment_status := null;

    if not exists (
      select 1
      from public.students as student
      where student.id = v_student_id
        and student.school_id = p_school_id
        and student.class_id = p_class_id
    ) then
      raise exception
        'Student ID % does not belong to the selected class and school.',
        v_student_id;
    end if;

    select enrollment.enrollment_status
      into v_enrollment_status
    from public.student_enrollments as enrollment
    where enrollment.student_id = v_student_id
      and enrollment.school_id = p_school_id
      and enrollment.academic_year_id = p_academic_year_id
    order by enrollment.created_at desc nulls last, enrollment.id desc
    limit 1;

    if v_enrollment_status is not null
       and (
         lower(trim(v_enrollment_status)) like '%graduated%'
         or lower(trim(v_enrollment_status)) like '%transferred%'
       ) then
      raise exception
        'Blocked: student ID % has status "%" for this school and academic year. Attendance cannot be saved.',
        v_student_id,
        v_enrollment_status;
    end if;
  end loop;

  if p_attendance_id is not null then
    update public.attendance
    set school_id = p_school_id,
        class_id = p_class_id,
        subject_id = p_subject_id,
        period_id = p_period_id,
        assessment_id = p_assessment_id,
        teacher_id = p_teacher_id,
        academic_year_id = p_academic_year_id,
        term_id = p_term_id,
        date = p_date,
        status = p_status,
        updated_at = pg_catalog.now()
    where id = p_attendance_id;

    v_attendance_id := p_attendance_id;
  else
    insert into public.attendance (
      school_id,
      class_id,
      subject_id,
      period_id,
      assessment_id,
      teacher_id,
      academic_year_id,
      term_id,
      date,
      status,
      created_at,
      updated_at
    )
    values (
      p_school_id,
      p_class_id,
      p_subject_id,
      p_period_id,
      p_assessment_id,
      p_teacher_id,
      p_academic_year_id,
      p_term_id,
      p_date,
      p_status,
      pg_catalog.now(),
      pg_catalog.now()
    )
    returning id into v_attendance_id;
  end if;

  for v_record in
    select record_value
    from pg_catalog.jsonb_array_elements(p_records) as records(record_value)
  loop
    insert into public.attendance_records (
      attendance_id,
      student_id,
      school_id,
      status,
      created_at,
      updated_at
    )
    values (
      v_attendance_id,
      (v_record->>'student_id')::uuid,
      p_school_id,
      v_record->>'status',
      pg_catalog.now(),
      pg_catalog.now()
    )
    on conflict (attendance_id, student_id)
    do update set
      status = excluded.status,
      school_id = excluded.school_id,
      updated_at = pg_catalog.now();
  end loop;

  return v_attendance_id;
end;
$function$;

commit;
