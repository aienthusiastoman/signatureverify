/*
  # Add site_name to app_settings

  Inserts a default site_name row into app_settings if it doesn't already exist.
  This allows admins to configure the site/brand name via the Theming page.
*/

INSERT INTO app_settings (key, value)
VALUES ('site_name', 'SignatureVerify')
ON CONFLICT (key) DO NOTHING;
