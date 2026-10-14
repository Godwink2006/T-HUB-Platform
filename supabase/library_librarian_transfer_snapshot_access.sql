begin;

-- Librarians need historical transfer snapshots to identify borrowers whose
-- live profile now belongs to another school. Limit access to snapshots for
-- students with a borrowing record in the librarian's own school.
drop policy if exists "librarians_read_library_transfer_snapshots"
  on public.student_enrollments;
create policy "librarians_read_library_transfer_snapshots"
  on public.student_enrollments
  for select
  to authenticated
  using (
    student_name_snapshot is not null
    and school_id = public.get_auth_user_school_id()
    and lower(coalesce(public.get_auth_user_role(), '')) = 'librarian'
    and exists (
      select 1
      from public.book_borrowings as borrowing
      where borrowing.borrower_id = student_enrollments.student_id
        and borrowing.school_id = student_enrollments.school_id
    )
  );

commit;
