-- Let signed-in users delete only notifications addressed to themselves in
-- their own school. Existing active-user and active-school policies still
-- apply, and the existing super-admin policy remains unchanged.
DROP POLICY IF EXISTS "Users can delete their own notifications"
  ON public.notifications;

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND school_id = (
      SELECT p.school_id
      FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid())
    )
  );
