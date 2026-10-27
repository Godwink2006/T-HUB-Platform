begin;

drop policy if exists active_books_visible_except_admin_librarian
on public.books;

create policy active_books_visible_except_admin_librarian
on public.books
as restrictive
for select
to authenticated
using (
  lower(coalesce(status, '')) = 'active'
  or lower(coalesce((select private.current_profile_role()), ''))
    in ('admin', 'librarian')
  or (select public.is_super_admin())
);

commit;
