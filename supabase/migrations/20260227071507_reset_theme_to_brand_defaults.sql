/*
  # Reset theme settings to brand light defaults

  ## Summary
  Updates the app_settings table to use the brand light theme as the default.
  This ensures all users see a readable, light-theme interface rather than
  the old dark fallback defaults. Only updates rows that still contain the
  old dark default values so admin-customised themes are preserved.

  ## Changes
  - Sets theme_color to #006080 (brand teal) if it was the old teal default
  - Sets bg_color to #f8fafc (light slate) if it was the old dark default
  - Sets surface_color to #ffffff (white) if it was the old dark default
  - Sets font_color to #0f172a (dark slate) if it was the old light default
*/

INSERT INTO app_settings (key, value)
VALUES
  ('theme_color', '#006080'),
  ('bg_color',    '#f8fafc'),
  ('surface_color', '#ffffff'),
  ('font_color',  '#0f172a')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value
  WHERE app_settings.value IN ('#14b8a6', '#020617', '#0f172a', '#f8fafc');
