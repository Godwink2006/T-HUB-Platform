

create or replace function public.move_students_to_new_academic_year(
  p_school_id uuid,
  p_student_ids uuid[],
  p_old_academic_year_id uuid,
  p_new_academic_year_id uuid,
  p_new_term_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $function$
declare
  v_school_id uuid;
  v_source_count bigint;
  v_student_count bigint;
  v_class_count bigint;
  v_source_class_id uuid;
  v_class_name text;
  v_class_capacity integer;
  v_first_term_count bigint;
  v_first_term_id uuid;
  v_target_fee_count bigint;
  v_fee_structure_id uuid;
  v_total_fees numeric;
  v_fee_breakdown jsonb;
  v_existing_count bigint;
  v_updated_count bigint;
  v_student_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before moving students to a new academic year.' using errcode = '42501';
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
  if p_school_id is null or p_school_id <> v_school_id then
    raise exception 'The requested school does not match your administrator profile.' using errcode = '42501';
  end if;
  if p_student_ids is null or cardinality(p_student_ids) = 0 then
    raise exception 'Select at least one student to move.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_student_ids) as selected(student_id) where selected.student_id is null
  ) then
    raise exception 'Student IDs cannot be null.' using errcode = '22023';
  end if;
  if cardinality(p_student_ids) <> (
    select count(distinct selected.student_id)
    from unnest(p_student_ids) as selected(student_id)
  ) then
    raise exception 'Duplicate student IDs were submitted.' using errcode = '22023';
  end if;
  if p_old_academic_year_id is null
     or p_new_academic_year_id is null
     or p_new_term_id is null then
    raise exception 'Choose a source year, target year, and first term.' using errcode = '22023';
  end if;
  if p_old_academic_year_id = p_new_academic_year_id then
    raise exception 'Choose a target year different from the source year.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.academic_years as y
    where y.id = p_old_academic_year_id and y.school_id = v_school_id
  ) then
    raise exception 'The source academic year was not found in this school.' using errcode = '23503';
  end if;
  if not exists (
    select 1 from public.academic_years as y
    where y.id = p_new_academic_year_id and y.school_id = v_school_id
  ) then
    raise exception 'The target academic year was not found in this school.' using errcode = '23503';
  end if;

  select count(*), (array_agg(t.id))[1]
  into v_first_term_count, v_first_term_id
  from public.terms as t
  where t.school_id = v_school_id
    and t.academic_year_id = p_new_academic_year_id
    and t.name ~* '(^|[^[:alnum:]])(1(st)?|first|one|i)([^[:alnum:]]|$)';
  if v_first_term_count <> 1 or v_first_term_id <> p_new_term_id then
    raise exception 'The target year must have exactly one first term, and it must be selected.' using errcode = '23514';
  end if;

  select count(*), count(distinct e.student_id), count(distinct e.class_id),
         (array_agg(e.class_id))[1], (array_agg(c.name order by e.created_at desc))[1]
  into v_source_count, v_student_count, v_class_count, v_source_class_id, v_class_name
  from public.student_enrollments as e
  join public.classes as c
    on c.id = e.class_id
   and c.school_id = e.school_id
  where e.school_id = v_school_id
    and e.academic_year_id = p_old_academic_year_id
    and e.student_id = any(p_student_ids);

  if v_student_count <> cardinality(p_student_ids) then
    raise exception 'Every selected student must have an enrollment in the source year and this school.' using errcode = '23514';
  end if;
  if v_class_count <> 1 then
    raise exception 'Select students from one source class at a time.' using errcode = '23514';
  end if;

  select c.capacity
  into v_class_capacity
  from public.classes as c
  where c.id = v_source_class_id
    and c.school_id = v_school_id
    and lower(c.status::text) = 'active';
  if not found then
    raise exception 'The source class is not active in this school.' using errcode = '23503';
  end if;

  for v_student_id in
    select selected.student_id
    from unnest(p_student_ids) as selected(student_id)
    order by selected.student_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_school_id::text || ':student:' || v_student_id::text, 0)
    );
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_school_id::text || ':class:' || v_source_class_id::text || ':' || p_new_term_id::text, 0
    )
  );

  select count(*), (array_agg(fs.id))[1], (array_agg(fs.total_amount))[1]
  into v_target_fee_count, v_fee_structure_id, v_total_fees
  from public.fee_structures as fs
  where fs.school_id = v_school_id
    and fs.academic_year_id = p_new_academic_year_id
    and fs.term_id = p_new_term_id
    and fs.class_id = v_source_class_id
    and lower(fs.status::text) = 'active';
  if v_target_fee_count <> 1 then
    raise exception 'There must be exactly one active fee structure for this school, source class, target year, and first term.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.student_enrollments as target
    where target.school_id = v_school_id
      and target.academic_year_id = p_new_academic_year_id
      and target.term_id = p_new_term_id
      and target.student_id = any(p_student_ids)
  ) then
    raise exception 'One or more students already have an enrollment in the target year and first term.' using errcode = '23505';
  end if;
  if exists (
    select 1
    from public.student_fees as fee
    where fee.school_id = v_school_id
      and fee.academic_year_id = p_new_academic_year_id
      and fee.term_id = p_new_term_id
      and fee.student_id = any(p_student_ids)
  ) then
    raise exception 'One or more students already have a fee record in the target year and first term.' using errcode = '23505';
  end if;

  select count(*)
  into v_existing_count
  from public.student_enrollments as e
  where e.school_id = v_school_id
    and e.class_id = v_source_class_id
    and e.academic_year_id = p_new_academic_year_id
    and e.term_id = p_new_term_id;
  if v_class_capacity is not null
     and v_class_capacity > 0
     and v_existing_count + v_student_count > v_class_capacity then
    raise exception 'Class capacity would be exceeded (%/%).',
      v_existing_count + v_student_count, v_class_capacity using errcode = '23514';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'fee_name', item.fee_name,
        'amount', item.amount,
        'fee_structure_id', item.fee_structure_id
      ) order by item.id
    ),
    '[]'::jsonb
  )
  into v_fee_breakdown
  from public.fee_structure_items as item
  where item.fee_structure_id = v_fee_structure_id;

  insert into public.student_enrollments (
    school_id, student_id, class_id, academic_year_id, term_id, enrollment_status
  )
  select v_school_id, selected.student_id, v_source_class_id,
         p_new_academic_year_id, p_new_term_id, 'Normal'
  from unnest(p_student_ids) as selected(student_id);

  insert into public.student_fees (
    school_id, student_id, class_id, academic_year_id, term_id,
    fee_structure_id, total_fees, total_paid, status, fee_breakdown
  )
  select v_school_id, selected.student_id, v_source_class_id,
         p_new_academic_year_id, p_new_term_id,
         v_fee_structure_id, v_total_fees, 0, 'Unpaid', v_fee_breakdown
  from unnest(p_student_ids) as selected(student_id);

  update public.students as s
  set academic_year_id = p_new_academic_year_id,
      class_id = v_source_class_id,
      updated_at = now()
  where s.school_id = v_school_id
    and s.id = any(p_student_ids);
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> v_student_count then
    raise exception 'Could not update every selected student in this school.' using errcode = '23503';
  end if;

  return jsonb_build_object('success', true, 'student_count', v_student_count);
end;
$function$;

revoke all on function public.move_students_to_new_academic_year(uuid, uuid[], uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.move_students_to_new_academic_year(uuid, uuid[], uuid, uuid, uuid)
  to authenticated;
