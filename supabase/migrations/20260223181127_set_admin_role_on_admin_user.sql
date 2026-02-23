/*
  # Set Admin Role on Admin User

  ## Summary
  Updates the admin@signatureverify.local user's app_metadata to include
  role: "admin" so that the admin sidebar sections (Customers, Theming)
  become visible and the admin-users edge function grants access.

  ## Changes
  - Updates `raw_app_meta_data` on the admin user to merge in `{"role":"admin"}`
  - Also preserves any existing provider metadata
*/

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@signatureverify.local';
