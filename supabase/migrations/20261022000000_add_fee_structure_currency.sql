begin;

alter table public.fee_structures
  add column if not exists currency_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fee_structures_currency_code_check'
      and conrelid = 'public.fee_structures'::regclass
  ) then
    alter table public.fee_structures
      add constraint fee_structures_currency_code_check
      check (currency_code is null or currency_code in ('LRD', 'USD'));
  end if;
end
$$;

comment on column public.fee_structures.currency_code is
  'Currency used by this fee structure: LRD (Liberian dollars) or USD.';

-- Currency-aware overloads keep the fee structure and its item rows atomic.
create or replace function public.create_fee_structure_atomic(
  p_academic_year_id uuid,
  p_term_id uuid,
  p_class_id uuid,
  p_status text,
  p_total_amount numeric,
  p_items jsonb,
  p_currency_code text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_school_id uuid;
  v_structure_id uuid;
  v_item record;
begin
  if p_currency_code is null or p_currency_code not in ('LRD', 'USD') then
    raise exception 'Currency must be LRD or USD.' using errcode = '22023';
  end if;

  v_school_id := public.get_user_school_id();
  if v_school_id is null then
    raise exception 'Unauthorized: Active school tenant context not found.';
  end if;

  insert into public.fee_structures (
    school_id,
    academic_year_id,
    term_id,
    class_id,
    status,
    total_amount,
    currency_code
  )
  values (
    v_school_id,
    p_academic_year_id,
    p_term_id,
    p_class_id,
    p_status,
    p_total_amount,
    p_currency_code
  )
  returning id into v_structure_id;

  for v_item in
    select * from jsonb_to_recordset(p_items) as item(name text, amount numeric)
  loop
    insert into public.fee_structure_items (
      school_id,
      fee_structure_id,
      fee_name,
      amount
    )
    values (
      v_school_id,
      v_structure_id,
      v_item.name,
      v_item.amount
    );
  end loop;

  return v_structure_id;
end;
$function$;

create or replace function public.update_fee_structure_atomic(
  p_structure_id uuid,
  p_status text,
  p_total_amount numeric,
  p_items jsonb,
  p_currency_code text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_school_id uuid;
begin
  if p_currency_code is null or p_currency_code not in ('LRD', 'USD') then
    raise exception 'Currency must be LRD or USD.' using errcode = '22023';
  end if;

  v_school_id := public.get_user_school_id();
  if v_school_id is null then
    raise exception 'Unauthorized: Active school tenant context not found.';
  end if;

  update public.fee_structures
  set status = p_status,
      total_amount = p_total_amount,
      currency_code = p_currency_code,
      updated_at = now()
  where id = p_structure_id
    and school_id = v_school_id;

  if not found then
    raise exception 'Fee structure not found or access denied.';
  end if;

  delete from public.fee_structure_items
  where fee_structure_id = p_structure_id
    and school_id = v_school_id;

  insert into public.fee_structure_items (
    school_id,
    fee_structure_id,
    fee_name,
    amount
  )
  select
    v_school_id,
    p_structure_id,
    (item.value ->> 'name')::text,
    (item.value ->> 'amount')::numeric
  from jsonb_array_elements(p_items) as item(value);
end;
$function$;

revoke all on function public.create_fee_structure_atomic(
  uuid, uuid, uuid, text, numeric, jsonb, text
) from public, anon;
grant execute on function public.create_fee_structure_atomic(
  uuid, uuid, uuid, text, numeric, jsonb, text
) to authenticated;

revoke all on function public.update_fee_structure_atomic(
  uuid, text, numeric, jsonb, text
) from public, anon;
grant execute on function public.update_fee_structure_atomic(
  uuid, text, numeric, jsonb, text
) to authenticated;

notify pgrst, 'reload schema';

commit;
