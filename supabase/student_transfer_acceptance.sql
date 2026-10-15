-- Review proposal only. Requires student_transfer_proposal.sql first.
-- Accepting a transfer keeps the student's existing Auth user ID and login.
-- Source attendance, grades, fees, and payments remain unchanged; JSON snapshots
-- are added to student_transfer_history for a future read-only history screen.

BEGIN;

ALTER TABLE public.student_transfers
  ADD COLUMN IF NOT EXISTS source_student_code text;

-- Preserve the sender-school identity on the historical enrollment itself.
-- The student's live profile moves to the receiving school during acceptance.
ALTER TABLE public.student_enrollments
  ADD COLUMN IF NOT EXISTS student_name_snapshot text,
  ADD COLUMN IF NOT EXISTS student_code_snapshot text,
  ADD COLUMN IF NOT EXISTS student_photo_snapshot text;

-- Backfill older completed transfers where the source enrollment still exists.
UPDATE public.student_enrollments AS enrollment
SET student_name_snapshot = coalesce(
      enrollment.student_name_snapshot,
      (SELECT profile.full_name
       FROM public.profiles AS profile
       WHERE profile.id = enrollment.student_id)
    ),
    student_code_snapshot = coalesce(
      enrollment.student_code_snapshot,
      (SELECT transfer.source_student_code
       FROM public.student_transfers AS transfer
       WHERE transfer.source_student_id = enrollment.student_id
         AND transfer.source_school_id = enrollment.school_id
       ORDER BY transfer.created_at DESC
       LIMIT 1),
      (SELECT student.student_id
       FROM public.students AS student
       WHERE student.id = enrollment.student_id)
    ),
    student_photo_snapshot = coalesce(
      enrollment.student_photo_snapshot,
      (SELECT profile.photo_url
       FROM public.profiles AS profile
       WHERE profile.id = enrollment.student_id)
    )
WHERE EXISTS (
    SELECT 1
    FROM public.student_transfers AS transfer
    WHERE transfer.status = 'completed'
      AND (transfer.source_enrollment_id = enrollment.id
           OR (transfer.source_student_id = enrollment.student_id
               AND transfer.source_school_id = enrollment.school_id))
  )
  AND (enrollment.student_name_snapshot IS NULL
       OR enrollment.student_code_snapshot IS NULL
       OR enrollment.student_photo_snapshot IS NULL);

create or replace function public.preview_student_transfer(p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_transfer public.student_transfers%rowtype;
  v_student_name text;
  v_source_student_code text;
  v_source_class text;
  v_source_year text;
  v_source_school_name text;
begin
  if v_actor_id is null then
    raise exception 'Sign in as an authorized receiving-school administrator.';
  end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Enter a valid transfer code.';
  end if;

  if not exists (
    select 1 from public.student_transfer_admins as transfer_admin
    where transfer_admin.user_id = v_actor_id
  ) then
    raise exception 'Your account is not authorized to receive student transfers.';
  end if;

  select transfer.* into v_transfer
  from public.student_transfers as transfer
  where transfer.code_hash = pg_catalog.decode(pg_catalog.lower(p_code_hash), 'hex')
    and transfer.status = 'code_issued'
    and transfer.code_expires_at > now()
    and exists (
      select 1 from public.student_transfer_admins as transfer_admin
      where transfer_admin.user_id = v_actor_id
        and transfer_admin.school_id <> transfer.source_school_id
    );

  if not found then
    raise exception 'Transfer code is invalid, expired, already used, or not valid for your school.';
  end if;

  select profile.full_name, student.student_id, class.name, year.year_label, school.school_name
    into v_student_name, v_source_student_code, v_source_class, v_source_year, v_source_school_name
  from public.profiles as profile
  left join public.students as student
    on student.id = profile.id
   and student.school_id = v_transfer.source_school_id
  left join public.schools as school
    on school.id = v_transfer.source_school_id
  left join public.student_enrollments as enrollment
    on enrollment.id = v_transfer.source_enrollment_id
   and enrollment.school_id = v_transfer.source_school_id
  left join public.classes as class
    on class.id = enrollment.class_id
   and class.school_id = v_transfer.source_school_id
  left join public.academic_years as year
    on year.id = enrollment.academic_year_id
   and year.school_id = v_transfer.source_school_id
  where profile.id = v_transfer.source_student_id
    and profile.school_id = v_transfer.source_school_id;

  if not found then
    raise exception 'Student transfer details are no longer available.';
  end if;

  return pg_catalog.jsonb_build_object(
    'transfer_id', v_transfer.id,
    'student_name', v_student_name,
    'source_student_code', v_source_student_code,
    'source_school_name', v_source_school_name,
    'source_school_id', v_transfer.source_school_id,
    'source_class_name', v_source_class,
    'source_year_label', v_source_year,
    'expires_at', v_transfer.code_expires_at
  );
end;
$$;

create or replace function public.accept_student_transfer(
  p_code_hash text,
  p_target_class_id uuid,
  p_target_academic_year_id uuid,
  p_target_term_id uuid,
  p_target_fee_structure_id uuid,
  p_target_student_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_school_id uuid;
  v_transfer public.student_transfers%rowtype;
  v_target_class_name text;
  v_target_year_status text;
  v_target_term_year_id uuid;
  v_fee_amount numeric;
  v_fee_breakdown jsonb;
  v_target_capacity integer;
  v_target_count bigint;
  v_student_name text;
  v_source_student_code text;
  v_table_name text;
  v_record_type text;
begin
  if v_actor_id is null then
    raise exception 'Sign in as an authorized receiving-school administrator.';
  end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Enter a valid transfer code.';
  end if;
  if p_target_class_id is null or p_target_academic_year_id is null
     or p_target_term_id is null or p_target_fee_structure_id is null then
    raise exception 'Choose a target class, academic year, term, and fee structure.';
  end if;
  if p_target_student_code is null or pg_catalog.length(pg_catalog.btrim(p_target_student_code)) = 0
     or pg_catalog.length(pg_catalog.btrim(p_target_student_code)) > 64 then
    raise exception 'Enter a receiving-school student ID of 1 to 64 characters.';
  end if;

  select transfer_admin.school_id into v_school_id
  from public.student_transfer_admins as transfer_admin
  where transfer_admin.user_id = v_actor_id
    and transfer_admin.school_id in (
      select class.school_id from public.classes as class where class.id = p_target_class_id
    );
  if v_school_id is null then
    raise exception 'Your account is not authorized for the selected receiving school.';
  end if;

  select transfer.* into v_transfer
  from public.student_transfers as transfer
  where transfer.code_hash = pg_catalog.decode(pg_catalog.lower(p_code_hash), 'hex')
  for update;

  if not found or v_transfer.status <> 'code_issued'
     or v_transfer.code_expires_at <= now() then
    if found and v_transfer.status = 'code_issued' and v_transfer.code_expires_at <= now() then
      update public.student_transfers
      set status = 'expired', updated_at = now()
      where id = v_transfer.id;
    end if;
    raise exception 'Transfer code is invalid, expired, or already used.';
  end if;
  if v_transfer.source_school_id = v_school_id then
    raise exception 'A student cannot be transferred back into the same school using this code.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_transfer.source_student_id::text, 0)
  );

  if not exists (
    select 1 from public.students as student
    where student.id = v_transfer.source_student_id
      and student.school_id = v_transfer.source_school_id
  ) or not exists (
    select 1 from public.profiles as profile
    where profile.id = v_transfer.source_student_id
      and profile.school_id = v_transfer.source_school_id
      and profile.role = 'student'
  ) then
    raise exception 'The source student is no longer linked to the sending school.';
  end if;
  if not exists (
    select 1 from public.student_enrollments as enrollment
    where enrollment.id = v_transfer.source_enrollment_id
      and enrollment.student_id = v_transfer.source_student_id
      and enrollment.school_id = v_transfer.source_school_id
      and coalesce(enrollment.enrollment_status, 'Normal') not in ('Transferred', 'Graduated')
  ) then
    raise exception 'The source enrollment has changed and can no longer be transferred.';
  end if;

  select class.name, class.capacity
    into v_target_class_name, v_target_capacity
  from public.classes as class
  where class.id = p_target_class_id
    and class.school_id = v_school_id
    and lower(class.status::text) = 'active';
  if not found then
    raise exception 'The selected target class is not active in your school.';
  end if;

  select lower(year.status::text)
    into v_target_year_status
  from public.academic_years as year
  where year.id = p_target_academic_year_id
    and year.school_id = v_school_id;
  if not found or v_target_year_status <> 'active' then
    raise exception 'Choose an active academic year from your school.';
  end if;

  select term.academic_year_id into v_target_term_year_id
  from public.terms as term
  where term.id = p_target_term_id
    and term.school_id = v_school_id;
  if not found or v_target_term_year_id <> p_target_academic_year_id then
    raise exception 'The selected term does not belong to the target academic year.';
  end if;

  select fee.total_amount into v_fee_amount
  from public.fee_structures as fee
  where fee.id = p_target_fee_structure_id
    and fee.school_id = v_school_id
    and fee.class_id = p_target_class_id
    and fee.academic_year_id = p_target_academic_year_id
    and fee.term_id = p_target_term_id
    and lower(fee.status::text) = 'active';
  if not found then
    raise exception 'The fee structure must be active and match the selected class, year, and term.';
  end if;

  if exists (
    select 1 from public.student_enrollments as enrollment
    where enrollment.school_id = v_school_id
      and enrollment.student_id = v_transfer.source_student_id
      and enrollment.academic_year_id = p_target_academic_year_id
      and enrollment.term_id = p_target_term_id
  ) then
    raise exception 'This student already has an enrollment for that target year and term.';
  end if;
  if exists (
    select 1 from public.student_fees as fee
    where fee.school_id = v_school_id
      and fee.student_id = v_transfer.source_student_id
      and fee.academic_year_id = p_target_academic_year_id
      and fee.term_id = p_target_term_id
  ) then
    raise exception 'This student already has a fee record for that target year and term.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_school_id::text || ':class:' || p_target_class_id::text || ':' ||
      p_target_academic_year_id::text || ':' || p_target_term_id::text,
      0
    )
  );

  select count(*) into v_target_count
  from public.student_enrollments as enrollment
  where enrollment.school_id = v_school_id
    and enrollment.class_id = p_target_class_id
    and enrollment.academic_year_id = p_target_academic_year_id
    and enrollment.term_id = p_target_term_id;
  if v_target_capacity is not null and v_target_capacity > 0
     and v_target_count >= v_target_capacity then
    raise exception 'The selected class has reached its capacity.';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', item.id,
        'fee_name', item.fee_name,
        'amount', item.amount,
        'fee_structure_id', item.fee_structure_id
      ) order by item.id
    ), '[]'::jsonb
  ) into v_fee_breakdown
  from public.fee_structure_items as item
  where item.fee_structure_id = p_target_fee_structure_id;

  select profile.full_name into v_student_name
  from public.profiles as profile
  where profile.id = v_transfer.source_student_id;

  select student.student_id into v_source_student_code
  from public.students as student
  where student.id = v_transfer.source_student_id
    and student.school_id = v_transfer.source_school_id;
  if not found then
    raise exception 'The source student record is no longer available.';
  end if;

  if exists (
    select 1
    from public.students as existing_student
    where existing_student.school_id = v_school_id
      and pg_catalog.lower(pg_catalog.btrim(existing_student.student_id)) =
          pg_catalog.lower(pg_catalog.btrim(p_target_student_code))
      and existing_student.id <> v_transfer.source_student_id
  ) then
    raise exception 'Student ID "%" is already used in this school. Choose a different receiving-school ID.', pg_catalog.btrim(p_target_student_code);
  end if;

  for v_table_name, v_record_type in
    select * from (values
      ('attendance_records', 'attendance'),
      ('grade_records', 'grade'),
      ('student_fees', 'fee'),
      ('payment_transactions', 'payment')
    ) as snapshot_tables(table_name, record_type)
  loop
    execute pg_catalog.format(
      'insert into public.student_transfer_history
         (transfer_id, source_school_id, target_school_id, source_student_id,
          target_student_id, record_type, source_record_id, record_snapshot)
       select $1, $2, $3, $4, $4, $5, source_row.id::text,
         pg_catalog.to_jsonb(source_row) || pg_catalog.jsonb_build_object(
           ''history_school_id'', $2,
           ''history_school_name'', school_row.school_name,
           ''school_name'', school_row.school_name,
           ''history_class_id'', context.class_id,
           ''history_class_name'', class_row.name,
           ''class_name'', class_row.name,
           ''history_academic_year_id'', context.academic_year_id,
           ''history_academic_year'', year_row.year_label,
           ''academic_year'', year_row.year_label,
           ''history_term_id'', context.term_id,
           ''history_term_name'', term_row.name,
           ''term_name'', term_row.name,
           ''semester_name'', term_row.name,
           ''subject_name'', coalesce(subject_row.name, grade_subject_row.name, attendance_subject_row.name),
           ''teacher_name'', coalesce(teacher_row.full_name, attendance_teacher_row.full_name),
           ''assessment_name'', coalesce(assessment_row.name, grade_assessment_row.name),
           ''assessment_category'', coalesce(category_row.name, grade_category_row.name),
           ''maximum_marks'', coalesce(assessment_row.maximum_marks, grade_assessment_row.maximum_marks),
           ''period_name'', coalesce(period_row.name, attendance_period_row.name)
         )
       from public.%I as source_row
       left join lateral (
         select
           coalesce(
             nullif(pg_catalog.to_jsonb(source_row)->>''class_id'', '''')::uuid,
             (select a.class_id from public.attendance as a
              where a.id = nullif(pg_catalog.to_jsonb(source_row)->>''attendance_id'', '''')::uuid),
             (select g.class_id from public.grades as g
              where g.id = nullif(pg_catalog.to_jsonb(source_row)->>''grade_id'', '''')::uuid),
             (select f.class_id from public.student_fees as f
              where f.id = nullif(pg_catalog.to_jsonb(source_row)->>''student_fee_id'', '''')::uuid)
           ) as class_id,
           coalesce(
             nullif(pg_catalog.to_jsonb(source_row)->>''academic_year_id'', '''')::uuid,
             (select a.academic_year_id from public.attendance as a
              where a.id = nullif(pg_catalog.to_jsonb(source_row)->>''attendance_id'', '''')::uuid),
             (select g.academic_year_id from public.grades as g
              where g.id = nullif(pg_catalog.to_jsonb(source_row)->>''grade_id'', '''')::uuid),
             (select f.academic_year_id from public.student_fees as f
              where f.id = nullif(pg_catalog.to_jsonb(source_row)->>''student_fee_id'', '''')::uuid)
           ) as academic_year_id,
           coalesce(
             nullif(pg_catalog.to_jsonb(source_row)->>''term_id'', '''')::uuid,
             (select a.term_id from public.attendance as a
              where a.id = nullif(pg_catalog.to_jsonb(source_row)->>''attendance_id'', '''')::uuid),
             (select g.term_id from public.grades as g
              where g.id = nullif(pg_catalog.to_jsonb(source_row)->>''grade_id'', '''')::uuid),
             (select f.term_id from public.student_fees as f
              where f.id = nullif(pg_catalog.to_jsonb(source_row)->>''student_fee_id'', '''')::uuid)
           ) as term_id
       ) as context on true
       left join public.schools as school_row
         on school_row.id = $2
       left join public.classes as class_row
         on class_row.id = context.class_id and class_row.school_id = $2
       left join public.grades as grade_row
         on grade_row.id = nullif(pg_catalog.to_jsonb(source_row)->>''grade_id'', '''')::uuid
       left join public.attendance as attendance_row
         on attendance_row.id = nullif(pg_catalog.to_jsonb(source_row)->>''attendance_id'', '''')::uuid
       left join public.subjects as subject_row
         on subject_row.id = coalesce(
           nullif(pg_catalog.to_jsonb(source_row)->>''subject_id'', '''')::uuid,
           grade_row.subject_id,
           attendance_row.subject_id
         )
       left join public.subjects as grade_subject_row
         on grade_subject_row.id = grade_row.subject_id
       left join public.subjects as attendance_subject_row
         on attendance_subject_row.id = attendance_row.subject_id
       left join public.profiles as teacher_row
         on teacher_row.id = coalesce(
           nullif(pg_catalog.to_jsonb(source_row)->>''teacher_id'', '''')::uuid,
           nullif(pg_catalog.to_jsonb(source_row)->>''created_by'', '''')::uuid
         )
       left join public.assessments as assessment_row
         on assessment_row.id = coalesce(
           nullif(pg_catalog.to_jsonb(source_row)->>''assessment_id'', '''')::uuid,
           grade_row.assessment_id
         )
       left join public.assessments as grade_assessment_row
         on grade_assessment_row.id = grade_row.assessment_id
       left join public.assessment_categories as category_row
         on category_row.id = coalesce(
           nullif(pg_catalog.to_jsonb(source_row)->>''assessment_category_id'', '''')::uuid,
           grade_row.assessment_category_id
         )
       left join public.assessment_categories as grade_category_row
         on grade_category_row.id = grade_row.assessment_category_id
       left join public.periods as period_row
         on period_row.id = coalesce(
           nullif(pg_catalog.to_jsonb(source_row)->>''period_id'', '''')::uuid,
           attendance_row.period_id
         )
       left join public.periods as attendance_period_row
         on attendance_period_row.id = attendance_row.period_id
       left join public.academic_years as year_row
         on year_row.id = context.academic_year_id and year_row.school_id = $2
       left join public.terms as term_row
         on term_row.id = context.term_id and term_row.school_id = $2
       where source_row.student_id = $4 and source_row.school_id = $2',
      v_table_name
    ) using v_transfer.id, v_transfer.source_school_id, v_school_id,
            v_transfer.source_student_id, v_record_type;
  end loop;

  -- Snapshot identity on every source-school enrollment for this student,
  -- including older rows marked Promoted, before moving the live profile.
  update public.student_enrollments
  set student_name_snapshot = coalesce(student_name_snapshot, v_student_name),
      student_code_snapshot = coalesce(student_code_snapshot, v_source_student_code)
  where student_id = v_transfer.source_student_id
    and school_id = v_transfer.source_school_id;

  update public.student_enrollments
  set enrollment_status = 'Transferred',
      student_name_snapshot = v_student_name,
      student_code_snapshot = v_source_student_code
  where id = v_transfer.source_enrollment_id
    and student_id = v_transfer.source_student_id
    and school_id = v_transfer.source_school_id;
  if not found then
    raise exception 'Could not mark the sending-school enrollment as transferred.';
  end if;

  update public.students
  set school_id = v_school_id,
      student_id = pg_catalog.btrim(p_target_student_code),
      class_id = p_target_class_id,
      academic_year_id = p_target_academic_year_id,
      updated_at = now()
  where id = v_transfer.source_student_id
    and school_id = v_transfer.source_school_id;
  if not found then
    raise exception 'Could not move the student profile to the receiving school.';
  end if;

  update public.profiles
  set school_id = v_school_id,
      updated_at = now()
  where id = v_transfer.source_student_id
    and school_id = v_transfer.source_school_id
    and role = 'student';
  if not found then
    raise exception 'Could not move the student login to the receiving school.';
  end if;

  insert into public.student_enrollments (
    school_id, student_id, class_id, academic_year_id, term_id, enrollment_status,
    student_name_snapshot, student_code_snapshot, student_photo_snapshot
  ) values (
    v_school_id, v_transfer.source_student_id, p_target_class_id,
    p_target_academic_year_id, p_target_term_id, 'Normal',
    v_student_name, pg_catalog.btrim(p_target_student_code),
    (select profile.photo_url
     from public.profiles as profile
     where profile.id = v_transfer.source_student_id)
  );

  insert into public.student_fees (
    school_id, student_id, class_id, academic_year_id, term_id,
    fee_structure_id, total_fees, total_paid, status, fee_breakdown
  ) values (
    v_school_id, v_transfer.source_student_id, p_target_class_id,
    p_target_academic_year_id, p_target_term_id, p_target_fee_structure_id,
    v_fee_amount, 0, 'Unpaid', coalesce(v_fee_breakdown, '[]'::jsonb)
  );

  update public.student_transfers
  set target_school_id = v_school_id,
      target_student_id = v_transfer.source_student_id,
      source_student_code = v_source_student_code,
      status = 'completed',
      accepted_by = v_actor_id,
      completed_at = now(),
      updated_at = now()
  where id = v_transfer.id;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'transfer_id', v_transfer.id,
    'student_id', v_transfer.source_student_id,
    'target_student_code', pg_catalog.btrim(p_target_student_code),
    'student_name', v_student_name,
    'target_school_id', v_school_id,
    'target_class_name', v_target_class_name
  );
end;
$$;

revoke all on function public.preview_student_transfer(text) from public, anon;
revoke all on function public.accept_student_transfer(text, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.accept_student_transfer(text, uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.preview_student_transfer(text) to authenticated;
grant execute on function public.accept_student_transfer(text, uuid, uuid, uuid, uuid, text) to authenticated;

create or replace function public.get_my_transfer_history()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_school_id uuid;
  v_history jsonb;
begin
  if v_student_id is null then
    raise exception 'Sign in to view transfer history.';
  end if;

  select profile.school_id into v_school_id
  from public.profiles as profile
  where profile.id = v_student_id
    and profile.role = 'student';
  if v_school_id is null then
    raise exception 'A student profile linked to a school is required.';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'transfer_id', transfer.id,
        'source_school_id', transfer.source_school_id,
        'source_school_name', school.school_name,
        'source_student_code', transfer.source_student_code,
        'completed_at', transfer.completed_at,
        'records', coalesce(history.records, '[]'::jsonb)
      ) order by transfer.completed_at desc
    ), '[]'::jsonb
  ) into v_history
  from public.student_transfers as transfer
  left join public.schools as school
    on school.id = transfer.source_school_id
  left join lateral (
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'record_type', record.record_type,
        'record_snapshot', record.record_snapshot,
        'captured_at', record.captured_at
      ) order by record.captured_at
    ) as records
    from public.student_transfer_history as record
    where record.transfer_id = transfer.id
      and record.source_student_id = v_student_id
      and record.target_student_id = v_student_id
  ) as history on true
  where transfer.status = 'completed'
    and transfer.source_student_id = v_student_id
    and transfer.target_student_id = v_student_id
    and transfer.completed_at is not null;

  return v_history;
end;
$$;

revoke all on function public.get_my_transfer_history() from public, anon;
grant execute on function public.get_my_transfer_history() to authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
