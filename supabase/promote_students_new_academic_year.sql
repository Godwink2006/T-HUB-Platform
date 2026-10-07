



create or replace function public.promote_students_to_new_academic_year(
  p_enrollment_ids uuid[],
  p_target_academic_year_id uuid,
  p_target_class_id uuid,
  p_fee_structure_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $function$
declare
  v_school_id uuid;
  v_source_year_id uuid;
  v_source_year_count bigint;
  v_source_class_id uuid;
  v_source_class_count bigint;
  v_source_class_name text;
  v_target_class_name text;
  v_source_grade integer;
  v_target_grade integer;
  v_target_capacity integer;
  v_target_term_id uuid;
  v_target_term_count bigint;
  v_fee_total numeric;
  v_fee_breakdown jsonb;
  v_selected_count bigint;
  v_student_count bigint;
  v_existing_count bigint;
  v_updated_count bigint;
  v_student_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before promoting students.' using errcode = '42501';
  end if;

  select p.school_id
  into v_school_id
  from public.profiles as p
  where p.id = (select auth.uid())
    and lower(p.role::text) = 'admin'
    and lower(p.status::text) = 'active';

  if v_school_id is null then
    raise exception 'An active school administrator profile is required.' using errcode = '42501';
  end if;

  if p_enrollment_ids is null or cardinality(p_enrollment_ids) = 0 then
    raise exception 'Select at least one enrollment to promote.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_enrollment_ids) as selected(id) where selected.id is null
  ) then
    raise exception 'Enrollment IDs cannot be null.' using errcode = '22023';
  end if;
  if cardinality(p_enrollment_ids) <> (
    select count(distinct selected.id)
    from unnest(p_enrollment_ids) as selected(id)
  ) then
    raise exception 'Duplicate enrollment IDs were submitted.' using errcode = '22023';
  end if;
  if p_target_academic_year_id is null or p_target_class_id is null or p_fee_structure_id is null then
    raise exception 'Choose a target academic year, class, and fee structure.' using errcode = '22023';
  end if;

  select count(*), count(distinct e.academic_year_id),
         count(distinct e.class_id), count(distinct e.student_id),
         (array_agg(e.academic_year_id))[1], (array_agg(e.class_id))[1],
         (array_agg(c.name order by e.id))[1]
  into v_selected_count, v_source_year_count, v_source_class_count,
       v_student_count, v_source_year_id, v_source_class_id, v_source_class_name
  from public.student_enrollments as e
  join public.classes as c
    on c.id = e.class_id
   and c.school_id = e.school_id
  where e.id = any(p_enrollment_ids)
    and e.school_id = v_school_id;

  if v_selected_count <> cardinality(p_enrollment_ids) then
    raise exception 'Every selected enrollment must belong to this school.' using errcode = '23514';
  end if;
  if v_source_year_count <> 1 then
    raise exception 'Select students from one source academic year at a time.' using errcode = '23514';
  end if;
  if v_source_class_count <> 1 then
    raise exception 'Select students from one source class at a time.' using errcode = '23514';
  end if;
  if v_student_count <> v_selected_count then
    raise exception 'A student may appear only once in the selected batch.' using errcode = '23505';
  end if;
  if p_target_academic_year_id = v_source_year_id then
    raise exception 'Choose an academic year different from the source year.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.academic_years as y
    where y.id = p_target_academic_year_id
      and y.school_id = v_school_id
  ) then
    raise exception 'Target academic year was not found in this school.' using errcode = '23503';
  end if;

  select count(*), (array_agg(t.id))[1]
  into v_target_term_count, v_target_term_id
  from public.terms as t
  where t.school_id = v_school_id
    and t.academic_year_id = p_target_academic_year_id
    and t.name ~* '(^|[^[:alnum:]])(1(st)?|first|one|i)([^[:alnum:]]|$)';
  if v_target_term_count <> 1 then
    raise exception 'The target academic year must have exactly one first term.' using errcode = '23514';
  end if;

  select c.name, c.capacity
  into v_target_class_name, v_target_capacity
  from public.classes as c
  where c.id = p_target_class_id
    and c.school_id = v_school_id
    and lower(c.status::text) = 'active';
  if not found then
    raise exception 'Target class is not active in this school.' using errcode = '23503';
  end if;
  if p_target_class_id = v_source_class_id then
    raise exception 'Choose a target class different from the source class.' using errcode = '22023';
  end if;

  v_source_grade := (pg_catalog.regexp_match(v_source_class_name, '([0-9]+)'))[1]::integer;
  v_target_grade := (pg_catalog.regexp_match(v_target_class_name, '([0-9]+)'))[1]::integer;
  if v_source_grade <= 9 and v_target_grade >= 10 then
    raise exception 'Grade 9 to Grade 10 promotion must use the separate account-creation workflow.' using errcode = '22023';
  end if;

  select fs.total_amount
  into v_fee_total
  from public.fee_structures as fs
  where fs.id = p_fee_structure_id
    and fs.school_id = v_school_id
    and fs.class_id = p_target_class_id
    and fs.academic_year_id = p_target_academic_year_id
    and fs.term_id = v_target_term_id
    and lower(fs.status::text) = 'active';
  if not found then
    raise exception 'Fee structure must be active and match the target class, school, year, and first term.' using errcode = '23503';
  end if;


  for v_student_id in
    select e.student_id
    from public.student_enrollments as e
    where e.id = any(p_enrollment_ids)
    order by e.student_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_school_id::text || ':student:' || v_student_id::text, 0)
    );
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_school_id::text || ':class:' || p_target_class_id::text || ':' || v_target_term_id::text, 0
    )
  );

  if exists (
    select 1
    from public.student_enrollments as target
    join public.student_enrollments as source
      on source.id = any(p_enrollment_ids)
     and source.student_id = target.student_id
    where target.school_id = v_school_id
      and target.academic_year_id = p_target_academic_year_id
      and target.term_id = v_target_term_id
  ) then
    raise exception 'One or more students already have an enrollment in the target year and first term.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.student_fees as fee
    join public.student_enrollments as source
      on source.id = any(p_enrollment_ids)
     and source.student_id = fee.student_id
    where fee.school_id = v_school_id
      and fee.academic_year_id = p_target_academic_year_id
      and fee.term_id = v_target_term_id
  ) then
    raise exception 'One or more students already have a fee record in the target year and first term.' using errcode = '23505';
  end if;

  select count(*)
  into v_existing_count
  from public.student_enrollments as e
  where e.school_id = v_school_id
    and e.class_id = p_target_class_id
    and e.academic_year_id = p_target_academic_year_id
    and e.term_id = v_target_term_id;
  if v_target_capacity is not null
     and v_target_capacity > 0
     and v_existing_count + v_student_count > v_target_capacity then
    raise exception 'Target class capacity would be exceeded (%/%).',
      v_existing_count + v_student_count, v_target_capacity using errcode = '23514';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', item.id, 'fee_name', item.fee_name, 'amount', item.amount)
      order by item.id
    ),
    '[]'::jsonb
  )
  into v_fee_breakdown
  from public.fee_structure_items as item
  where item.fee_structure_id = p_fee_structure_id;

  insert into public.student_enrollments (
    school_id, student_id, class_id, academic_year_id, term_id, enrollment_status
  )
  select v_school_id, source.student_id, p_target_class_id,
         p_target_academic_year_id, v_target_term_id, 'Promoted'
  from public.student_enrollments as source
  where source.id = any(p_enrollment_ids);

  insert into public.student_fees (
    school_id, student_id, class_id, academic_year_id, term_id,
    fee_structure_id, total_fees, total_paid, status, fee_breakdown
  )
  select v_school_id, source.student_id, p_target_class_id,
         p_target_academic_year_id, v_target_term_id,
         p_fee_structure_id, v_fee_total, 0, 'Unpaid', v_fee_breakdown
  from public.student_enrollments as source
  where source.id = any(p_enrollment_ids);

  update public.students as s
  set class_id = p_target_class_id,
      academic_year_id = p_target_academic_year_id
  where s.school_id = v_school_id
    and s.id in (
      select source.student_id
      from public.student_enrollments as source
      where source.id = any(p_enrollment_ids)
    );
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> v_student_count then
    raise exception 'Could not update every selected student class and academic year.' using errcode = '23503';
  end if;

  return jsonb_build_object('success', true, 'student_count', v_student_count);
end;
$function$;

revoke all on function public.promote_students_to_new_academic_year(uuid[], uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.promote_students_to_new_academic_year(uuid[], uuid, uuid, uuid)
  to authenticated;
