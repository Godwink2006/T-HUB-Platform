-- Candidate optimization for public.save_attendance_with_records.
-- Review against the live function before applying. Run this function change
-- separately from any CREATE INDEX CONCURRENTLY statements.
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
  v_validation_issue text;
  v_validation_student_id uuid;
  v_validation_status text;
begin
  if p_records is null or pg_catalog.jsonb_typeof(p_records) <> 'array' then
    raise exception 'Attendance records must be provided as a JSON array.';
  end if;

  -- Preserve the current production checks for active entities and schedule.
  if not exists (
    select 1 from public.classes as class
    where class.id = p_class_id
      and class.school_id = p_school_id
      and pg_catalog.lower(class.status) = 'active'
  ) then
    raise exception 'The selected class is not active.' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.subjects as subject
    where subject.id = p_subject_id
      and subject.school_id = p_school_id
      and pg_catalog.lower(subject.status) = 'active'
  ) then
    raise exception 'The selected subject is not active.' using errcode = '23514';
  end if;

  if p_teacher_id is not null and not exists (
    select 1 from public.teacher_assignments as assignment
    where assignment.teacher_id = p_teacher_id
      and assignment.school_id = p_school_id
      and assignment.class_id = p_class_id
      and assignment.academic_year_id = p_academic_year_id
      and (assignment.subject_id is null or assignment.subject_id = p_subject_id)
      and pg_catalog.lower(pg_catalog.btrim(coalesce(assignment.status, ''))) = 'active'
  ) then
    raise exception 'Teacher is not actively assigned to this class and subject for this academic year.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.periods as period
    where period.id = p_period_id
      and period.school_id = p_school_id
      and pg_catalog.lower(period.status) = 'active'
  ) then
    raise exception 'The selected period is not active.' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.academic_years as academic_year
    where academic_year.id = p_academic_year_id
      and academic_year.school_id = p_school_id
      and pg_catalog.lower(academic_year.status) = 'active'
  ) then
    raise exception 'The selected academic year is not active.' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.terms as term
    where term.id = p_term_id
      and term.school_id = p_school_id
      and term.academic_year_id = p_academic_year_id
      and pg_catalog.lower(term.status) = 'active'
  ) then
    raise exception 'The selected term is not active for this academic year.' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.assessments as assessment
    where assessment.id = p_assessment_id
      and assessment.school_id = p_school_id
      and assessment.academic_year_id = p_academic_year_id
      and pg_catalog.lower(assessment.status) = 'active'
      and assessment.start_date is not null
      and assessment.end_date is not null
      and p_date between assessment.start_date and assessment.end_date
  ) then
    raise exception 'The assessment is not active for the selected attendance date.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.timetables as timetable
    where timetable.class_id = p_class_id
      and timetable.academic_year_id = p_academic_year_id
      and timetable.school_id = p_school_id
      and pg_catalog.lower(pg_catalog.btrim(coalesce(timetable.status, ''))) = 'active'
  ) then
    raise exception 'There is no active timetable for this class and academic year.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.timetables as timetable
    join public.timetable_lessons as lesson on lesson.timetable_id = timetable.id
    where timetable.class_id = p_class_id
      and timetable.academic_year_id = p_academic_year_id
      and timetable.school_id = p_school_id
      and pg_catalog.lower(pg_catalog.btrim(coalesce(timetable.status, ''))) = 'active'
      and pg_catalog.lower(pg_catalog.btrim(lesson.day_of_week)) =
          pg_catalog.lower(pg_catalog.to_char(p_date, 'FMDay'))
      and lesson.period_id = p_period_id
      and lesson.subject_id = p_subject_id
      and coalesce(lesson.is_break, false) = false
      and (p_teacher_id is null or lesson.teacher_id is null or lesson.teacher_id = p_teacher_id)
  ) then
    raise exception 'No active timetable lesson scheduled for this subject and period on %.',
      pg_catalog.to_char(p_date, 'FMDay')
      using errcode = '23514';
  end if;

  -- Validate the full batch with set-based lookups. Resolve only the latest
  -- enrollment row per student, matching the original ordering semantics.
  with input_records as (
    select
      (records.record_value->>'student_id')::uuid as student_id,
      records.ordinality
    from pg_catalog.jsonb_array_elements(p_records)
      with ordinality as records(record_value, ordinality)
  ),
  latest_enrollments as (
    select distinct on (enrollment.student_id)
      enrollment.student_id,
      enrollment.enrollment_status::text as enrollment_status
    from public.student_enrollments as enrollment
    join (select distinct student_id from input_records) as input_students
      on input_students.student_id = enrollment.student_id
    where enrollment.school_id = p_school_id
      and enrollment.academic_year_id = p_academic_year_id
    order by
      enrollment.student_id,
      enrollment.created_at desc nulls last,
      enrollment.id desc
  ),
  checked_records as (
    select
      input_records.student_id,
      input_records.ordinality,
      student.id is not null as student_is_valid,
      latest_enrollments.enrollment_status
    from input_records
    left join public.students as student
      on student.id = input_records.student_id
     and student.school_id = p_school_id
     and student.class_id = p_class_id
    left join latest_enrollments
      on latest_enrollments.student_id = input_records.student_id
  ),
  first_issue as (
    select
      checked_records.student_id,
      checked_records.enrollment_status,
      case
        when not checked_records.student_is_valid then 'student_scope'
        when checked_records.enrollment_status is not null
          and (
            pg_catalog.lower(pg_catalog.btrim(checked_records.enrollment_status)) like '%graduated%'
            or pg_catalog.lower(pg_catalog.btrim(checked_records.enrollment_status)) like '%transferred%'
          ) then 'enrollment_status'
      end as issue
    from checked_records
    where not checked_records.student_is_valid
       or (
         checked_records.enrollment_status is not null
         and (
           pg_catalog.lower(pg_catalog.btrim(checked_records.enrollment_status)) like '%graduated%'
           or pg_catalog.lower(pg_catalog.btrim(checked_records.enrollment_status)) like '%transferred%'
         )
       )
    order by checked_records.ordinality
    limit 1
  )
  select issue, student_id, enrollment_status
    into v_validation_issue, v_validation_student_id, v_validation_status
  from first_issue;

  if v_validation_issue = 'student_scope' then
    raise exception
      'Student ID % does not belong to the selected class and school.',
      v_validation_student_id;
  elsif v_validation_issue = 'enrollment_status' then
    raise exception
      'Blocked: student ID % has status "%" for this school and academic year. Attendance cannot be saved.',
      v_validation_student_id,
      v_validation_status;
  end if;

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

  -- Keep the final submitted status when a payload contains a student twice.
  -- Deduplication avoids PostgreSQL's "cannot affect row a second time" error
  -- from a multi-row INSERT ... ON CONFLICT statement.
  with ranked_records as (
    select
      (records.record_value->>'student_id')::uuid as student_id,
      records.record_value->>'status' as status,
      records.ordinality,
      pg_catalog.row_number() over (
        partition by (records.record_value->>'student_id')::uuid
        order by records.ordinality desc
      ) as row_number
    from pg_catalog.jsonb_array_elements(p_records)
      with ordinality as records(record_value, ordinality)
  )
  insert into public.attendance_records (
    attendance_id,
    student_id,
    school_id,
    status,
    created_at,
    updated_at
  )
  select
    v_attendance_id,
    ranked_records.student_id,
    p_school_id,
    ranked_records.status,
    pg_catalog.now(),
    pg_catalog.now()
  from ranked_records
  where ranked_records.row_number = 1
  on conflict (attendance_id, student_id)
  do update set
    status = excluded.status,
    school_id = excluded.school_id,
    updated_at = pg_catalog.now();

  return v_attendance_id;
end;
$function$;

commit;
