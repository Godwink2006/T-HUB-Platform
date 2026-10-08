-- Parent portal foundation. Review and apply to the intended Supabase project.
-- Parent accounts are Supabase Auth users with a profiles row whose role is
-- assigned by the trusted invite-parent Edge Function. This link table is the
-- authorization source; a parent cannot create or edit links from the browser.

begin;

create table if not exists public.parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete restrict,
  parent_email text not null check (parent_email = lower(btrim(parent_email))),
  relationship text not null default 'Parent'
    check (relationship in ('Parent', 'Guardian', 'Other')),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  approved_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_student_links_unique_email_per_student
    unique (student_id, parent_email)
);

create index if not exists parent_student_links_parent_status_idx
  on public.parent_student_links (parent_user_id, status);

create index if not exists parent_student_links_student_status_idx
  on public.parent_student_links (student_id, status);

alter table public.parent_student_links enable row level security;

revoke all on table public.parent_student_links from public, anon, authenticated;
grant select on table public.parent_student_links to authenticated;

drop policy if exists "Parents can view their active student links"
  on public.parent_student_links;
create policy "Parents can view their active student links"
  on public.parent_student_links
  for select
  to authenticated
  using (
    parent_user_id = (select auth.uid())
    and status = 'active'
  );

drop policy if exists "Parents can view linked student records"
  on public.students;
create policy "Parents can view linked student records"
  on public.students
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.parent_student_links as link
      where link.student_id = students.id
        and link.parent_user_id = (select auth.uid())
        and link.status = 'active'
    )
  );

drop policy if exists "Parents can view linked student profiles"
  on public.profiles;
create policy "Parents can view linked student profiles"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.parent_student_links as link
      where link.student_id = profiles.id
        and link.parent_user_id = (select auth.uid())
        and link.status = 'active'
    )
  );

commit;
