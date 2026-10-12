-- Live security hardening for profile authorization and privileged RPCs.
-- Apply to the intended Supabase project. This patch is transactional.

begin;

-- Users may edit ordinary profile details, but cannot elevate their own role
-- or move their profile to another tenant. Privileged profile changes remain
-- available to server-side service-role workflows and admin changes to other
-- users, subject to the existing RLS policies.
create or replace function private.prevent_self_profile_privilege_edits()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and (select auth.uid()) = old.id
     and (
       new.role is distinct from old.role
       or new.school_id is distinct from old.school_id
     ) then
    raise exception 'You cannot change your own role or school assignment.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_school_access(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.check_school_access(uuid, text)
  to authenticated, service_role;

drop trigger if exists prevent_self_profile_privilege_edits on public.profiles;
create trigger prevent_self_profile_privilege_edits
  before update of role, school_id on public.profiles
  for each row execute function private.prevent_self_profile_privilege_edits();

-- Students can read their own profile at every tier, librarians can read
-- profiles in their own school at every tier, and parent-linked student
-- profiles remain gated by the dedicated parent-portal policies.
drop policy if exists "Clean tier and role profile access" on public.profiles;
create policy "Clean tier and role profile access"
  on public.profiles for select to authenticated
  using (
    (
      school_id = public.get_auth_user_school_id()
      and public.get_auth_user_role() = any (
        array['admin'::text, 'teacher'::text, 'accountant'::text, 'receptionist'::text, 'librarian'::text]
      )
    )
    or (
      id = (select auth.uid())
      and role = any (array['student'::text, 'parent'::text])
    )
  );

-- The plan helper is used by authenticated RLS policies. Bind it to the
-- caller's own school so the exposed RPC cannot be used to enumerate other
-- tenants' subscription tiers.
create or replace function public.check_school_access(
  target_school_id uuid,
  required_tier text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce((select auth.role()), '');
  caller_school_id uuid;
  caller_status text;
  school_created timestamptz;
  active_plan text;
begin
  -- Edge Functions call this with their server-only service role after they
  -- authenticate staff and bind target_school_id to that profile. Keep the
  -- self-school checks for all client-authenticated calls.
  if caller_role <> 'service_role' then
    if (select auth.uid()) is null then
      return false;
    end if;

    select p.school_id, lower(coalesce(p.status, ''))
      into caller_school_id, caller_status
    from public.profiles as p
    where p.id = (select auth.uid());

    if caller_status <> 'active' then
      return false;
    end if;

    if not public.is_super_admin()
       and target_school_id is distinct from caller_school_id then
      return false;
    end if;
  end if;

  if required_tier is null or required_tier not in ('basic', 'standard', 'premium') then
    return false;
  end if;

  select s.created_at into school_created
  from public.schools as s
  where s.id = target_school_id;

  if school_created is not null and school_created >= (now() - interval '30 days') then
    return true;
  end if;

  select lower(sub.plan) into active_plan
  from public.subscriptions as sub
  where sub.school_id = target_school_id
    and lower(sub.status) = 'active'
  order by sub.end_date desc nulls last
  limit 1;

  if active_plan is null then
    return false;
  elsif required_tier = 'basic' then
    return active_plan in ('basic', 'standard', 'premium');
  elsif required_tier = 'standard' then
    return active_plan in ('standard', 'premium');
  else
    return active_plan = 'premium';
  end if;
end;
$$;

-- Prevent client roles from using school provisioning to create arbitrary
-- tenants, subscriptions, or admin profiles. No frontend or Edge Function in
-- this repository calls this RPC; server-side provisioning may use service_role.
revoke execute on function public.provision_school_tenant(
  uuid, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.provision_school_tenant(
  uuid, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text
) to service_role;

-- Rebuild itemized payment recording as a narrowly authorized operation.
-- Locking the fee row serializes balance checks for concurrent RPC requests.
create or replace function public.record_itemized_payment(
  p_student_fee_id uuid,
  p_student_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference_number text,
  p_notes text,
  p_allocations jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  caller_status text;
  caller_school_id uuid;
  fee_school_id uuid;
  fee_student_id uuid;
  total_fees numeric;
  total_paid numeric;
  max_allowed numeric;
  fee_breakdown jsonb;
  allocation jsonb;
  item_id uuid;
  item_payment numeric;
  item_total numeric;
  item_name text;
  item_already_paid numeric;
  allocation_total numeric := 0;
  seen_item_ids uuid[] := array[]::uuid[];
  transaction_id uuid;
begin
  if caller_id is null then
    raise exception 'Sign in with an authorized staff account to record a payment.'
      using errcode = '42501';
  end if;

  select lower(coalesce(p.role, '')), lower(coalesce(p.status, '')), p.school_id
    into caller_role, caller_status, caller_school_id
  from public.profiles as p
  where p.id = caller_id;

  if not found or caller_status <> 'active'
     or caller_role not in ('admin', 'accountant') then
    raise exception 'Only active school administrators and accountants can record payments.'
      using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.'
      using errcode = '22023';
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'At least one fee-item allocation is required.'
      using errcode = '22023';
  end if;

  select fee.school_id, fee.student_id, fee.total_fees,
         coalesce(fee.total_paid, 0), fee.fee_breakdown
    into fee_school_id, fee_student_id, total_fees, total_paid, fee_breakdown
  from public.student_fees as fee
  where fee.id = p_student_fee_id
  for update;

  if not found then
    raise exception 'Student fee record was not found.'
      using errcode = 'P0002';
  end if;

  if fee_school_id is distinct from caller_school_id
     or fee_student_id is distinct from p_student_id then
    raise exception 'The fee record must belong to the caller''s school and the selected student.'
      using errcode = '42501';
  end if;

  max_allowed := coalesce(total_fees, 0) - coalesce(total_paid, 0);
  if p_amount > max_allowed then
    raise exception 'Payment amount (%) exceeds the remaining student balance (%).',
      p_amount, max_allowed using errcode = '22023';
  end if;

  for allocation in select value from jsonb_array_elements(p_allocations)
  loop
    item_id := nullif(coalesce(allocation->>'fee_item_id', allocation->>'id'), '')::uuid;
    item_payment := nullif(allocation->>'amount', '')::numeric;

    if item_id is null or item_payment is null or item_payment <= 0 then
      raise exception 'Each allocation must have a fee item and a positive amount.'
        using errcode = '22023';
    end if;

    if item_id = any(seen_item_ids) then
      raise exception 'A fee item may appear only once in the allocations.'
        using errcode = '22023';
    end if;
    seen_item_ids := array_append(seen_item_ids, item_id);

    item_total := null;
    item_name := null;
    select (snapshot.item->>'amount')::numeric,
           coalesce(snapshot.item->>'fee_name', snapshot.item->>'name')
      into item_total, item_name
    from jsonb_array_elements(coalesce(fee_breakdown, '[]'::jsonb)) as snapshot(item)
    where snapshot.item->>'id' = item_id::text;

    if not found or item_total is null then
      raise exception 'An allocation references a fee item outside this fee record.'
        using errcode = '22023';
    end if;

    select coalesce(sum(pa.amount), 0) into item_already_paid
    from public.payment_allocations as pa
    join public.payment_transactions as pt
      on pt.id = pa.payment_transaction_id
    where pa.fee_item_id = item_id
      and pt.student_fee_id = p_student_fee_id;

    if item_already_paid + item_payment > item_total then
      raise exception 'Allocation for fee item % exceeds its remaining limit.', item_id
        using errcode = '22023';
    end if;

    allocation_total := allocation_total + item_payment;
  end loop;

  if allocation_total <> p_amount then
    raise exception 'The payment amount must equal the sum of its fee-item allocations.'
      using errcode = '22023';
  end if;

  insert into public.payment_transactions (
    school_id, student_fee_id, student_id, amount, payment_method,
    reference_number, notes, recorded_by, created_at
  ) values (
    fee_school_id, p_student_fee_id, fee_student_id, p_amount, p_payment_method,
    p_reference_number, p_notes, caller_id, now()
  ) returning id into transaction_id;

  for allocation in select value from jsonb_array_elements(p_allocations)
  loop
    item_id := nullif(coalesce(allocation->>'fee_item_id', allocation->>'id'), '')::uuid;
    item_payment := nullif(allocation->>'amount', '')::numeric;

    select coalesce(snapshot.item->>'fee_name', snapshot.item->>'name'),
           (snapshot.item->>'amount')::numeric
      into item_name, item_total
    from jsonb_array_elements(coalesce(fee_breakdown, '[]'::jsonb)) as snapshot(item)
    where snapshot.item->>'id' = item_id::text;

    insert into public.payment_allocations (
      school_id, payment_transaction_id, fee_item_id, item_name,
      amount, original_amount
    ) values (
      fee_school_id, transaction_id, item_id, coalesce(item_name, 'General Fee'),
      item_payment, item_total
    );
  end loop;

  return transaction_id;
end;
$$;

revoke execute on function public.record_itemized_payment(
  uuid, uuid, numeric, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_itemized_payment(
  uuid, uuid, numeric, text, text, text, jsonb
) to authenticated;

-- Bind dashboard statistics to the authenticated profile instead of trusting
-- client-supplied user, role, and tenant identifiers.
create or replace function public.get_dashboard_stats(
  p_school_id uuid,
  p_user_id uuid,
  p_role text,
  p_filter_type text default 'year'::text,
  p_custom_start timestamp without time zone default null,
  p_custom_end timestamp without time zone default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_school_id uuid;
  caller_role text;
  caller_status text;
  total_count integer := 0;
  active_count integer := 0;
  boys_count integer := 0;
  girls_count integer := 0;
  active_year_id uuid;
  start_date timestamp;
  end_date timestamp;
begin
  if caller_id is null then
    raise exception 'Sign in to view dashboard statistics.' using errcode = '42501';
  end if;

  select p.school_id, lower(coalesce(p.role, '')), lower(coalesce(p.status, ''))
    into caller_school_id, caller_role, caller_status
  from public.profiles as p
  where p.id = caller_id;

  if not found or caller_status <> 'active'
     or caller_role not in ('admin', 'teacher', 'accountant', 'librarian') then
    raise exception 'This account cannot view enrollment statistics.' using errcode = '42501';
  end if;

  if p_user_id is distinct from caller_id
     or p_school_id is distinct from caller_school_id
     or lower(coalesce(p_role, '')) is distinct from caller_role then
    raise exception 'Dashboard identity and school must match the signed-in profile.'
      using errcode = '42501';
  end if;

  if p_filter_type is null or p_filter_type not in ('today', 'week', 'month', 'term', 'year', 'custom') then
    raise exception 'Unsupported dashboard date filter.' using errcode = '22023';
  end if;

  if p_filter_type = 'today' then
    start_date := date_trunc('day', now());
    end_date := now();
  elsif p_filter_type = 'week' then
    start_date := now() - interval '7 days';
    end_date := now();
  elsif p_filter_type = 'month' then
    start_date := date_trunc('month', now());
    end_date := now();
  elsif p_filter_type = 'year' then
    start_date := date_trunc('year', now());
    end_date := now();
  elsif p_custom_start is not null and p_custom_end is not null
        and p_custom_start <= p_custom_end then
    start_date := p_custom_start;
    end_date := p_custom_end;
  else
    raise exception 'Custom date range is invalid.' using errcode = '22023';
  end if;

  if caller_role = 'teacher' then
    select ay.id into active_year_id
    from public.academic_years as ay
    where ay.school_id = caller_school_id
      and lower(ay.status) = 'active'
    limit 1;

    select count(distinct s.id),
           count(distinct case when lower(coalesce(p.status, '')) = 'active' then s.id end),
           count(distinct case when lower(coalesce(s.gender, '')) = 'male' then s.id end),
           count(distinct case when lower(coalesce(s.gender, '')) = 'female' then s.id end)
      into total_count, active_count, boys_count, girls_count
    from public.students as s
    join public.profiles as p on p.id = s.id
    join public.student_enrollments as se
      on se.student_id = s.id
     and se.school_id = caller_school_id
     and se.academic_year_id = active_year_id
    join public.teacher_assignments as ta
      on ta.class_id = se.class_id
     and ta.school_id = caller_school_id
     and ta.teacher_id = caller_id
    where s.school_id = caller_school_id
      and p.school_id = caller_school_id
      and p.created_at >= start_date
      and p.created_at <= end_date;
  else
    select count(distinct s.id),
           count(distinct case when lower(coalesce(p.status, '')) = 'active' then s.id end),
           count(distinct case when lower(coalesce(s.gender, '')) = 'male' then s.id end),
           count(distinct case when lower(coalesce(s.gender, '')) = 'female' then s.id end)
      into total_count, active_count, boys_count, girls_count
    from public.students as s
    join public.profiles as p on p.id = s.id
    where s.school_id = caller_school_id
      and p.school_id = caller_school_id
      and p.created_at >= start_date
      and p.created_at <= end_date;
  end if;

  return json_build_object(
    'total', coalesce(total_count, 0),
    'active', coalesce(active_count, 0),
    'boys', coalesce(boys_count, 0),
    'girls', coalesce(girls_count, 0)
  );
end;
$$;

-- Retain the legacy three-argument overload, but run it through the same
-- authenticated, school-bound implementation.
create or replace function public.get_dashboard_stats(
  p_school_id uuid,
  p_user_id uuid,
  p_role text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.get_dashboard_stats(
    p_school_id, p_user_id, p_role, 'year'::text, null::timestamp, null::timestamp
  );
end;
$$;

revoke execute on function public.get_dashboard_stats(
  uuid, uuid, text, text, timestamp without time zone, timestamp without time zone
) from public, anon, authenticated;
grant execute on function public.get_dashboard_stats(
  uuid, uuid, text, text, timestamp without time zone, timestamp without time zone
) to authenticated;
revoke execute on function public.get_dashboard_stats(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_dashboard_stats(uuid, uuid, text)
  to authenticated;

-- The control-panel dashboard calls this aggregate from an authenticated
-- browser session. Return the global total only to active super admins.
create or replace function public.get_total_storage_used()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0)
  from storage.objects as o
  where o.bucket_id = 'avatars'
    and (select public.is_super_admin());
$$;
revoke execute on function public.get_total_storage_used() from public, anon, authenticated;
grant execute on function public.get_total_storage_used() to authenticated, service_role;

-- Narrow ID-based boolean helpers to signed-in users and bind user parameters
-- to auth.uid() where the helper answers a caller-specific question.
create or replace function public.teacher_has_student(p_teacher_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and p_teacher_id = (select auth.uid())
     and exists (
       select 1
       from public.teacher_assignments as ta
       join public.student_enrollments as se
         on se.class_id = ta.class_id
        and se.school_id = ta.school_id
       where ta.teacher_id = (select auth.uid())
         and se.student_id = p_student_id
     );
$$;

create or replace function public.teacher_created_grade(p_grade_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and p_user_id = (select auth.uid())
     and exists (
       select 1 from public.grades as g
       where g.id = p_grade_id
         and (g.created_by = (select auth.uid())
           or g.created_by in (select t.id from public.teachers as t where t.id = (select auth.uid())))
     );
$$;

create or replace function public.user_has_grade_access(p_grade_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and p_user_id = (select auth.uid())
     and exists (
       select 1 from public.grade_records as gr
       where gr.grade_id = p_grade_id
         and gr.student_id = (select auth.uid())
     );
$$;

revoke execute on function public.teacher_has_student(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teacher_has_student(uuid, uuid) to authenticated;
revoke execute on function public.teacher_created_grade(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teacher_created_grade(uuid, uuid) to authenticated;
revoke execute on function public.user_has_grade_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.user_has_grade_access(uuid, uuid) to authenticated;
revoke execute on function public.is_class_portal_eligible(uuid) from public, anon, authenticated;
grant execute on function public.is_class_portal_eligible(uuid) to authenticated;

commit;
