-- Only an active admin may permanently remove a book in their own active,
-- premium school. Do not remove a book that is currently borrowed or overdue;
-- returned borrowing records cascade with the book as configured by the FK.
CREATE OR REPLACE FUNCTION public.admin_delete_unborrowed_book(p_book_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_school_id uuid;
  v_book_school_id uuid;
  v_book_title text;
BEGIN
  SELECT p.school_id
    INTO v_actor_school_id
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin'
    AND p.status = 'active';

  IF NOT FOUND OR v_actor_school_id IS NULL THEN
    RAISE EXCEPTION 'Only an active school admin can delete books.'
      USING ERRCODE = '42501';
  END IF;

  SELECT b.school_id, b.title
    INTO v_book_school_id, v_book_title
  FROM public.books AS b
  WHERE b.id = p_book_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_book_school_id IS DISTINCT FROM v_actor_school_id THEN
    RAISE EXCEPTION 'You can only delete books from your own school.'
      USING ERRCODE = '42501';
  END IF;

  IF public.is_school_active(v_book_school_id) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Books can only be deleted while the school is active.'
      USING ERRCODE = '42501';
  END IF;

  IF public.check_school_access(v_book_school_id, 'premium') IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A premium plan is required to manage library books.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.book_borrowings AS borrowing
    WHERE borrowing.book_id = p_book_id
      AND borrowing.status IS DISTINCT FROM 'returned'
  ) THEN
    RAISE EXCEPTION 'This book is currently borrowed or overdue. Return it before deleting the book.'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.books AS b
  WHERE b.id = p_book_id
    AND b.school_id = v_actor_school_id;

  RETURN jsonb_build_object(
    'deleted', true,
    'book_id', p_book_id,
    'book_title', v_book_title
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_unborrowed_book(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_unborrowed_book(uuid)
  TO authenticated;
