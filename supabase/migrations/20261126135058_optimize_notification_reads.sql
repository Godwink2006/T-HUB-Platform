-- Support the notification feed and the unread badge count.
CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_user_idx
  ON public.notifications (user_id)
  WHERE is_read IS FALSE;

-- Keep the existing authorization logic while avoiding per-row auth.uid() calls.
DROP POLICY IF EXISTS schools_update_requires_active ON public.schools;
CREATE POLICY schools_update_requires_active
  ON public.schools
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    lower(COALESCE(status, 'inactive'::text)) = 'active'::text
    OR EXISTS (
      SELECT 1
      FROM public.cp_admins AS admin
      WHERE admin.id = (SELECT auth.uid())
        AND admin.status = 'active'::text
        AND lower(replace(admin.role, '_'::text, '-'::text)) = 'super-admin'::text
    )
  )
  WITH CHECK (
    lower(COALESCE(status, 'inactive'::text)) = 'active'::text
    OR EXISTS (
      SELECT 1
      FROM public.cp_admins AS admin
      WHERE admin.id = (SELECT auth.uid())
        AND admin.status = 'active'::text
        AND lower(replace(admin.role, '_'::text, '-'::text)) = 'super-admin'::text
    )
  );

DROP POLICY IF EXISTS "Super admins can read all school audit logs" ON public.audit_logs;
CREATE POLICY "Super admins can read all school audit logs"
  ON public.audit_logs
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cp_admins AS admin
      WHERE admin.id = (SELECT auth.uid())
        AND admin.status = 'active'::text
        AND lower(replace(admin.role, '_'::text, '-'::text)) = 'super-admin'::text
    )
  );
