-- Atomic database work for yearly Grade 9 to Grade 10 promotion.
-- The Edge Function authenticates the caller and creates the Auth account;
-- this transaction writes the profile, class, enrollment, and fee records.

create or replace function public.promote_grade9_students_to_new_academic_year_transaction(
  p_school_id uuid,
  p_source_enrollment_id uuid,
  p_student_id uuid,
  p_source_academic_year_id uuid,
  p_target_class_id uuid,
  p_target_academic_year_id uuid,
  p_target_term_id uuid,
  p_fee_structure_id uuid,
  p_email text,
  p_phone_number text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_school_status text;
  v_source_student_id uuid;
  v_source_year_id uuid;
  v_source_class_name text;
  v_source_class_school_id uuid;
  v_source_grade integer;
  v_target_class_name text;
  v_target_capacity integer;
  v_target_grade integer;
  v_target_term_count integer;
  v_existing_enrollment_count integer;
  v_currency_code text;
  v_total_amount numeric;
  v_fee_breakdown jsonb;
  v_updated_count integer;
begin
  if p_school_id is null
     or p_source_enrollment_id is null
     or p_student_id is null
     or p_source_academic_year_id is null
     or p_target_class_id is null
     or p_target_academic_year_id is null
     or p_target_term_id is null
     or p_fee_structure_id is null
     or nullif(btrim(p_email), '') is null then
    raise exception 'Yearly promotion is missing required student or academic references.'
      using errcode = '22023';
  end if;

  select lower(btrim(coalesce(school.status::text, '')))
  into v_school_status
  from public.schools as school
  where school.id = p_school_id
  for share;

  if not found or v_school_status <> 'active' then
    raise exception 'The school is inactive or could not be found.'
      using errcode = '42501';
  end if;

  select
    enrollment.student_id,
    enrollment.academic_year_id,
    source_class.name,
    source_class.school_id
  into
    v_source_student_id,
    v_source_year_id,
    v_source_class_name,
    v_source_class_school_id
  from public.student_enrollments as enrollment
  join public.classes as source_class
    on source_class.id = enrollment.class_id
   and source_class.school_id = enrollment.school_id
  where enrollment.id = p_source_enrollment_id
    and enrollment.school_id = p_school_id
  for update of enrollment;

  if not found
     or v_source_student_id is distinct from p_student_id
     or v_source_year_id is distinct from p_source_academic_year_id
     or v_source_year_id = p_target_academic_year_id
     or v_source_class_school_id is distinct from p_school_id then
    raise exception 'The source Grade 9 enrollment does not match this promotion request.'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.academic_years as source_year
    where source_year.id = v_source_year_id
      and source_year.school_id = p_school_id
  ) then
    raise exception 'The source academic year was not found in this school.'
      using errcode = '23503';
  end if;

  v_source_grade := (pg_catalog.regexp_match(v_source_class_name, '([0-9]+)'))[1]::integer;
  if v_source_grade is distinct from 9 then
    raise exception 'The source enrollment must be for Grade 9.'
      using errcode = '23514';
  end if;

  perform student.id
  from public.students as student
  where student.id = p_student_id
    and student.school_id = p_school_id
  for update;

  if not found then
    raise exception 'The student was not found in this school.'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.academic_years as year
    where year.id = p_target_academic_year_id
      and year.school_id = p_school_id
      and lower(btrim(coalesce(year.status::text, ''))) = 'active'
  ) then
    raise exception 'The target academic year must be active and belong to this school.'
      using errcode = '23503';
  end if;

  select count(*)::integer
  into v_target_term_count
  from public.terms as term
  where term.school_id = p_school_id
    and term.academic_year_id = p_target_academic_year_id
    and term.name ~* '(^|[^[:alnum:]])(1(st)?|first|one|i)([^[:alnum:]]|$)';

  if v_target_term_count <> 1 or not exists (
    select 1
    from public.terms as term
    where term.id = p_target_term_id
      and term.school_id = p_school_id
      and term.academic_year_id = p_target_academic_year_id
      and term.name ~* '(^|[^[:alnum:]])(1(st)?|first|one|i)([^[:alnum:]]|$)'
  ) then
    raise exception 'The active target year must have exactly one first term, and the selected term must be it.'
      using errcode = '23514';
  end if;

  select target_class.name, target_class.capacity
  into v_target_class_name, v_target_capacity
  from public.classes as target_class
  where target_class.id = p_target_class_id
    and target_class.school_id = p_school_id
    and lower(btrim(coalesce(target_class.status::text, ''))) = 'active';

  if not found then
    raise exception 'The target class must be active and belong to this school.'
      using errcode = '23503';
  end if;

  v_target_grade := (pg_catalog.regexp_match(v_target_class_name, '([0-9]+)'))[1]::integer;
  if v_target_grade is distinct from 10 then
    raise exception 'The target class must be Grade 10.'
      using errcode = '23514';
  end if;

  select
    fee_structure.total_amount,
    upper(btrim(coalesce(fee_structure.currency_code, '')))
  into v_total_amount, v_currency_code
  from public.fee_structures as fee_structure
  where fee_structure.id = p_fee_structure_id
    and fee_structure.school_id = p_school_id
    and fee_structure.class_id = p_target_class_id
    and fee_structure.academic_year_id = p_target_academic_year_id
    and fee_structure.term_id = p_target_term_id
    and lower(btrim(coalesce(fee_structure.status::text, ''))) = 'active';

  if not found then
    raise exception 'The fee structure must be active and match the target class, year, and first term.'
      using errcode = '23503';
  end if;

  if v_currency_code not in ('LRD', 'USD') then
    raise exception 'The fee structure currency must be LRD or USD.'
      using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_school_id::text || ':yearly-promotion:' || p_student_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.student_enrollments as enrollment
    where enrollment.student_id = p_student_id
      and enrollment.school_id = p_school_id
      and enrollment.academic_year_id = p_target_academic_year_id
      and enrollment.term_id = p_target_term_id
  ) then
    raise exception 'The student is already enrolled in the target year and first term.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.student_fees as fee
    where fee.student_id = p_student_id
      and fee.school_id = p_school_id
      and fee.academic_year_id = p_target_academic_year_id
      and fee.term_id = p_target_term_id
  ) then
    raise exception 'The student already has a fee record in the target year and first term.'
      using errcode = '23505';
  end if;

  select count(*)::integer
  into v_existing_enrollment_count
  from public.student_enrollments as enrollment
  where enrollment.school_id = p_school_id
    and enrollment.class_id = p_target_class_id
    and enrollment.academic_year_id = p_target_academic_year_id
    and enrollment.term_id = p_target_term_id;

  if v_target_capacity is not null
     and v_target_capacity > 0
     and v_existing_enrollment_count + 1 > v_target_capacity then
    raise exception 'The target class capacity would be exceeded (%/%).',
      v_existing_enrollment_count + 1, v_target_capacity
      using errcode = '23514';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', item.id,
        'fee_name', item.fee_name,
        'amount', item.amount
      ) order by item.id
    ),
    '[]'::jsonb
  )
  into v_fee_breakdown
  from public.fee_structure_items as item
  where item.fee_structure_id = p_fee_structure_id;

  update public.profiles as profile
  set email = p_email,
      role = 'student',
      status = 'active',
      phone_number = p_phone_number,
      updated_at = pg_catalog.now()
  where profile.id = p_student_id
    and profile.school_id = p_school_id;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'The student profile was not found in this school.'
      using errcode = '23503';
  end if;

  update public.students as student
  set class_id = p_target_class_id,
      academic_year_id = p_target_academic_year_id
  where student.id = p_student_id
    and student.school_id = p_school_id;

  insert into public.student_enrollments (
    school_id,
    student_id,
    class_id,
    academic_year_id,
    term_id,
    enrollment_status
  ) values (
    p_school_id,
    p_student_id,
    p_target_class_id,
    p_target_academic_year_id,
    p_target_term_id,
    'Promoted'
  );

  insert into public.student_fees (
    school_id,
    student_id,
    class_id,
    academic_year_id,
    term_id,
    fee_structure_id,
    total_fees,
    total_paid,
    status,
    fee_breakdown,
    currency_code
  ) values (
    p_school_id,
    p_student_id,
    p_target_class_id,
    p_target_academic_year_id,
    p_target_term_id,
    p_fee_structure_id,
    v_total_amount,
    0,
    'Unpaid',
    v_fee_breakdown,
    v_currency_code
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'target_academic_year_id', p_target_academic_year_id,
    'target_class_id', p_target_class_id,
    'target_term_id', p_target_term_id
  );
end;
$$;

revoke all on function public.promote_grade9_students_to_new_academic_year_transaction(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.promote_grade9_students_to_new_academic_year_transaction(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text
) to service_role;
