# Parent portal setup

The parent portal files are local application changes. The Supabase schema and Edge Function must be deployed before invitations can be sent or student records loaded. No production database changes are made by this repository work.

1. Ensure the `profiles` role constraint allows `parent`, then apply `parent_portal_schema_proposal.sql` to the intended Supabase project. It creates the staff-managed parent/student link table and grants the server-only `service_role` permission to manage links.
2. Deploy the `invite-parent` Edge Function. It verifies the caller's active `admin` or `accountant` profile and school, creates the Auth invitation server-side, and creates the parent profile and link. Keep the service-role secret server-side; never add it to browser code.
3. Set the Edge Function secret `APP_SITE_URL` to the deployed app's origin, with no trailing path, for example `https://school.example`. Add the full parent setup page URL (for example `https://school.example/html/parent-set-password.html`) to Supabase Auth's allowed redirect URLs.
4. Apply `parent_portal_data_access.sql`. It scopes parent reads to actively linked students, blocks parent writes to school records, and limits period and school labels to data attached to those students. Existing staff access remains governed by the existing staff policies.
5. Test with a parent and at least two students: the linked child must be visible in fees, attendance, and submitted grades; an unrelated student's rows must not be visible by direct API query; parent insert/update/delete attempts must be denied. Test an invitation to a second child for the same parent email too.

The parent dashboard remembers a selected linked student and links to read-only fees and payments, attendance, and submitted grades pages. These views support school, academic year, class, and term filters. The SQL files still need to be applied to each target Supabase project before these pages can load production records.
