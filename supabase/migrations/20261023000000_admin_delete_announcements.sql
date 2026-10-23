-- Allow school admins to delete announcements belonging to their own school.
-- Existing restrictive active-user and active-school policies still apply.
DROP POLICY IF EXISTS "Only admins can delete announcements"
  ON public.announcements;

CREATE POLICY "Only admins can delete announcements"
  ON public.announcements
  FOR DELETE
  TO authenticated
  USING (
    school_id = (
      SELECT p.school_id
      FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );
