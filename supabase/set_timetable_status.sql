-- Update only a timetable's status. This lets an administrator deactivate an
-- old-year timetable without resaving its lessons (which are validated against
-- the active academic year by timetable lesson triggers).

create or replace function public.set_timetable_status(
  p_timetable_id uuid,
  p_status text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_role text;
  v_profile_status text;
  v_updated_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before changing a timetable status.'
      using errcode = '42501';
  end if;

  select
    profile.school_id,
    lower(btrim(coalesce(profile.role, ''))),
    lower(btrim(coalesce(profile.status, '')))
  into v_school_id, v_role, v_profile_status
  from public.profiles as profile
  where profile.id = (select auth.uid());

  if v_school_id is null
     or v_role <> 'admin'
     or v_profile_status <> 'active' then
    raise exception 'Only an active school administrator can change a timetable status.'
      using errcode = '42501';
  end if;

  if lower(btrim(coalesce(p_status, ''))) not in ('active', 'inactive') then
    raise exception 'Timetable status must be Active or Inactive.'
      using errcode = '22023';
  end if;

  update public.timetables as timetable
  set
    status = case lower(btrim(p_status))
      when 'active' then 'Active'
      else 'Inactive'
    end,
    updated_at = pg_catalog.now()
  where timetable.id = p_timetable_id
    and timetable.school_id = v_school_id
  returning timetable.id into v_updated_id;

  if v_updated_id is null then
    raise exception 'The timetable was not found in your school or you cannot update it.'
      using errcode = '42501';
  end if;

  return true;
end;
$$;

revoke all on function public.set_timetable_status(uuid, text) from public, anon;
grant execute on function public.set_timetable_status(uuid, text) to authenticated;
