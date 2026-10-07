


create or replace function public.promote_students_to_semester(

  p_student_ids uuid[],
  p_fee_structure_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $function$
declare
  v_school_id uuid;
  v_active_year_id uuid;
  v_active_year_count bigint;
  v_source_year_id uuid;
  v_source_year_count bigint;
  v_first_term_id uuid;
  v_first_term_count bigint;
  v_second_term_id uuid;
  v_second_term_count bigint;
  v_class_id uuid;
  v_class_count bigint;
  v_class_name text;
  v_class_capacity integer;
  v_selected_count bigint;
  v_student_count bigint;
  v_existing_count bigint;
  v_fee_total numeric;
  v_fee_breakdown jsonb;
  v_student_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before moving students to second term.' using errcode = '42501';
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

  if p_student_ids is null or cardinality(p_student_ids) = 0 then
    raise exception 'Select at least one student.' using errcode = '22023';
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
  if p_fee_structure_id is null then
    raise exception 'Choose an active second-term fee structure.' using errcode = '22023';
  end if;

  select count(*), (array_agg(y.id))[1]
  into v_active_year_count, v_active_year_id
  from public.academic_years as y
  where y.school_id = v_school_id
    and lower(y.status::text) = 'active';
  if v_active_year_count <> 1 then
    raise exception 'This school must have exactly one active academic year.' using errcode = '23514';
  end if;

  select count(*), (array_agg(t.id))[1]
  into v_first_term_count, v_first_term_id
  from public.terms as t
  where t.school_id = v_school_id
    and t.academic_year_id = v_active_year_id
    and t.name ~* '(^|[^[:alnum:]])(1(st)?|first|one|i)([^[:alnum:]]|$)';
  if v_first_term_count <> 1 then
    raise exception 'The active academic year must have exactly one first term.' using errcode = '23514';
  end if;

  select count(*), (array_agg(t.id))[1]
  into v_second_term_count, v_second_term_id
  from public.terms as t
  where t.school_id = v_school_id
    and t.academic_year_id = v_active_year_id
    and t.name ~* '(^|[^[:alnum:]])(2(nd)?|second|two|ii)([^[:alnum:]]|$)';
  if v_second_term_count <> 1 then
    raise exception 'The active academic year must have exactly one second term.' using errcode = '23514';
  end if;

  select count(*), count(distinct e.academic_year_id),
         count(distinct e.class_id), count(distinct e.student_id),
         (array_agg(e.academic_year_id))[1], (array_agg(e.class_id))[1],
         (array_agg(c.name order by e.id))[1]
  into v_selected_count, v_source_year_count, v_class_count, v_student_count,
       v_source_year_id, v_class_id, v_class_name
  from public.student_enrollments as e
  join public.classes as c
    on c.id = e.class_id
   and c.school_id = e.school_id
  where e.student_id = any(p_student_ids)
    and e.school_id = v_school_id
    and e.academic_year_id = v_active_year_id
    and e.term_id = v_first_term_id;

  if v_selected_count <> cardinality(p_student_ids) then
    raise exception 'Every selected student must have a first-term enrollment in this school''s active year.' using errcode = '23514';
  end if;
  if v_source_year_count <> 1 or v_source_year_id <> v_active_year_id then
    raise exception 'Select students from one active academic year at a time.' using errcode = '23514';
  end if;
  if v_class_count <> 1 then
    raise exception 'Select students from one class at a time.' using errcode = '23514';
  end if;
  if v_student_count <> v_selected_count then
    raise exception 'A student may appear only once in the selected batch.' using errcode = '23505';
  end if;

  select c.capacity
  into v_class_capacity
  from public.classes as c
  where c.id = v_class_id
    and c.school_id = v_school_id
    and lower(c.status::text) = 'active';
  if not found then
    raise exception 'The source class is not active in this school.' using errcode = '23503';
  end if;


  for v_student_id in
    select e.student_id
    from public.student_enrollments as e
    where e.student_id = any(p_student_ids)
      and e.school_id = v_school_id
      and e.academic_year_id = v_active_year_id
      and e.term_id = v_first_term_id
    order by e.student_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_school_id::text || ':student:' || v_student_id::text, 0)
    );
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_school_id::text || ':class:' || v_class_id::text || ':' || v_second_term_id::text, 0)
  );

  select fs.total_amount
  into v_fee_total
  from public.fee_structures as fs
  where fs.id = p_fee_structure_id
    and fs.school_id = v_school_id
    and fs.class_id = v_class_id
    and fs.academic_year_id = v_active_year_id
    and fs.term_id = v_second_term_id
    and lower(fs.status::text) = 'active';
  if not found then
    raise exception 'Fee structure must be active and match this school, class, active year, and second term.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.student_enrollments as target
    join public.student_enrollments as source
      on source.student_id = any(p_student_ids)
     and source.student_id = target.student_id
     and source.school_id = v_school_id
     and source.academic_year_id = v_active_year_id
     and source.term_id = v_first_term_id
    where target.school_id = v_school_id
      and target.academic_year_id = v_active_year_id
      and target.term_id = v_second_term_id
  ) then
    raise exception 'One or more students already have a second-term enrollment.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.student_fees as fee
    join public.student_enrollments as source
      on source.student_id = any(p_student_ids)
     and source.student_id = fee.student_id
     and source.school_id = v_school_id
     and source.academic_year_id = v_active_year_id
     and source.term_id = v_first_term_id
    where fee.school_id = v_school_id
      and fee.academic_year_id = v_active_year_id
      and fee.term_id = v_second_term_id
  ) then
    raise exception 'One or more students already have a second-term fee record.' using errcode = '23505';
  end if;

  select count(*)
  into v_existing_count
  from public.student_enrollments as e
  where e.school_id = v_school_id
    and e.class_id = v_class_id
    and e.academic_year_id = v_active_year_id
    and e.term_id = v_second_term_id;
  if v_class_capacity is not null
     and v_class_capacity > 0
     and v_existing_count + v_student_count > v_class_capacity then
    raise exception 'Class capacity would be exceeded (%/%).',
      v_existing_count + v_student_count, v_class_capacity using errcode = '23514';
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
  select v_school_id, source.student_id, v_class_id, v_active_year_id, v_second_term_id, 'Normal'
  from public.student_enrollments as source
  where source.student_id = any(p_student_ids)
    and source.school_id = v_school_id
    and source.academic_year_id = v_active_year_id
    and source.term_id = v_first_term_id;

  insert into public.student_fees (
    school_id, student_id, class_id, academic_year_id, term_id,
    fee_structure_id, total_fees, total_paid, status, fee_breakdown
  )
  select v_school_id, source.student_id, v_class_id, v_active_year_id, v_second_term_id,
         p_fee_structure_id, v_fee_total, 0, 'Unpaid', v_fee_breakdown
  from public.student_enrollments as source
  where source.student_id = any(p_student_ids)
    and source.school_id = v_school_id
    and source.academic_year_id = v_active_year_id
    and source.term_id = v_first_term_id;

  return jsonb_build_object('success', true, 'student_count', v_student_count);
end;
$function$;

revoke all on function public.promote_students_to_semester(uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.promote_students_to_semester(uuid[], uuid)
  to authenticated;

