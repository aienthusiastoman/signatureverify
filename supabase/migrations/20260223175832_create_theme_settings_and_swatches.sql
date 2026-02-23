/*
  # Create Theme Settings and Color Swatches

  ## Summary
  Adds global app theming support with admin-managed settings and saved color swatches.

  ## New Tables

  ### `app_settings`
  - `id` (uuid, pk)
  - `key` (text, unique) — setting key e.g. 'theme_color', 'bg_color', 'logo_url'
  - `value` (text) — setting value
  - `updated_at` (timestamptz)

  ### `color_swatches`
  - `id` (uuid, pk)
  - `name` (text) — label for the swatch
  - `color` (text) — hex color string
  - `sort_order` (int) — display order
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - `app_settings`: authenticated users can SELECT; only admins (app_metadata.role = 'admin') can INSERT/UPDATE/DELETE
  - `color_swatches`: authenticated users can SELECT; only admins can INSERT/UPDATE/DELETE

  ## Seed Data
  - Default theme settings inserted
*/

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS color_swatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#14b8a6',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE color_swatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can delete settings"
  ON app_settings FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Authenticated users can read swatches"
  ON color_swatches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert swatches"
  ON color_swatches FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can update swatches"
  ON color_swatches FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can delete swatches"
  ON color_swatches FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

INSERT INTO app_settings (key, value) VALUES
  ('theme_color', '#14b8a6'),
  ('bg_color', '#020617'),
  ('surface_color', '#0f172a'),
  ('font_color', '#f8fafc'),
  ('logo_url', '')
ON CONFLICT (key) DO NOTHING;
