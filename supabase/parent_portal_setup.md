# Parent portal setup

The parent portal files are local application changes. The Supabase schema and Edge Function must be deployed before invitations can be sent.

1. Review and apply `parent_portal_schema_proposal.sql` to the intended Supabase project. It creates the staff-managed parent/student link table, enables RLS, grants parents read-only access to their own active links, and permits linked parents to read the linked student rows.
2. Deploy the `invite-parent` Edge Function. It verifies the caller's active `admin` or `accountant` profile and school, creates the Auth invitation server-side, and creates the parent profile and link. Keep the service-role secret server-side; never add it to browser code.
3. Set the Edge Function secret `APP_SITE_URL` to the deployed app's origin, with no trailing path, for example `https://school.example`. Add the full parent setup page URL (for example `https://school.example/html/parent-set-password.html`) to Supabase Auth's allowed redirect URLs.
4. Test with a new parent email: staff selects a student and sends an invitation; the parent opens the email, sets a password, signs in, and reaches the parent dashboard. Test a second invitation to the same email for a sibling; it should add a link to the existing parent account.

This first slice does not yet add parent versions of fees, attendance, grades, timetable, or history pages. The dashboard only chooses and remembers the active student; those read-only pages should be connected after their parent-specific RLS access is designed and tested.
