


create or replace function public.promote_grade9_students_transaction(
  p_school_id uuid,
  p_student_ids uuid[],
  p_target_class_id uuid,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_fee_structure_id uuid,
  p_total_amount numeric,
  p_fee_breakdown jsonb,
  p_email text,
  p_phone_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_student_count integer;
begin
  if p_school_id is null or p_target_class_id is null or p_academic_year_id is null
     or p_term_id is null or p_fee_structure_id is null then
    raise exception 'Promotion is missing required school or academic references.' using errcode = '22023';
  end if;

  if coalesce(cardinality(p_student_ids), 0) = 0 then
    raise exception 'At least one student is required.' using errcode = '22023';
  end if;

  if (select count(*) from unnest(p_student_ids) as ids(id)) <>
     (select count(distinct id) from unnest(p_student_ids) as ids(id)) then
    raise exception 'Duplicate student IDs were provided.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.classes c
    where c.id = p_target_class_id and c.school_id = p_school_id
      and c.status = 'active'
  ) then
    raise exception 'Target class is inactive or does not belong to the requested school.' using errcode = '23503';
  end if;

  if not exists (
    select 1 from public.academic_years y
    where y.id = p_academic_year_id
      and y.school_id = p_school_id
      and lower(y.status) = 'active'
  ) then
    raise exception 'Academic year is not active for the requested school.' using errcode = '23503';
  end if;

  if not exists (
    select 1 from public.terms t
    where t.id = p_term_id
      and t.academic_year_id = p_academic_year_id
      and t.school_id = p_school_id
      and t.name ~* '(^|[^[:alnum:]])(2(nd)?|second|two|ii)([^[:alnum:]]|$)'
  ) then
    raise exception 'Target term must be the second term in the active academic year and requested school.' using errcode = '23503';
  end if;

  if not exists (
    select 1 from public.fee_structures fs
    where fs.id = p_fee_structure_id
      and fs.school_id = p_school_id
      and fs.class_id = p_target_class_id
      and fs.academic_year_id = p_academic_year_id
      and fs.term_id = p_term_id
      and lower(fs.status) = 'active'
  ) then
    raise exception 'Fee structure does not match the school, class, year, and second term.' using errcode = '23503';
  end if;

  perform s.id
  from public.students s
  where s.id = any(p_student_ids) and s.school_id = p_school_id
  order by s.id
  for update;

  select count(*) into v_student_count
  from public.students s
  where s.id = any(p_student_ids) and s.school_id = p_school_id;

  if v_student_count <> cardinality(p_student_ids) then
    raise exception 'One or more students do not belong to the requested school.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.student_enrollments e
    where e.student_id = any(p_student_ids)
      and e.school_id = p_school_id
      and e.academic_year_id = p_academic_year_id
      and e.term_id = p_term_id
  ) then
    raise exception 'Student is already enrolled for this academic year and term.' using errcode = '23505';
  end if;

  update public.profiles p
  set email = p_email,
      role = 'student',
      status = 'active',
      phone_number = p_phone_number,
      updated_at = now()
  where p.id = any(p_student_ids) and p.school_id = p_school_id;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(p_student_ids) then
    raise exception 'A student profile was not found.' using errcode = '23503';
  end if;

  update public.students s
  set class_id = p_target_class_id
  where s.id = any(p_student_ids) and s.school_id = p_school_id;

  insert into public.student_enrollments (
    school_id, student_id, class_id, academic_year_id, term_id, enrollment_status
  )
  select p_school_id, student_id, p_target_class_id, p_academic_year_id, p_term_id, 'Promoted'
  from unnest(p_student_ids) as selected(student_id);

  insert into public.student_fees (
    school_id, student_id, class_id, academic_year_id, term_id,
    fee_structure_id, total_fees, total_paid, status, fee_breakdown
  )
  select p_school_id, student_id, p_target_class_id, p_academic_year_id, p_term_id,
         p_fee_structure_id, p_total_amount, 0, 'Unpaid', coalesce(p_fee_breakdown, '[]'::jsonb)
  from unnest(p_student_ids) as selected(student_id);

  return jsonb_build_object('success', true, 'student_count', cardinality(p_student_ids));
end;
$$;

revoke all on function public.promote_grade9_students_transaction(
  uuid, uuid[], uuid, uuid, uuid, uuid, numeric, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.promote_grade9_students_transaction(
  uuid, uuid[], uuid, uuid, uuid, uuid, numeric, jsonb, text, text
) to service_role;
