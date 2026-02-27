/*
  # Fix RLS Performance, Security Issues, and Cleanup

  ## Changes

  ### 1. RLS Performance — auth function wrapping
  All policies using `auth.uid()` and `auth.jwt()` are re-created with
  `(select auth.uid())` and `(select auth.jwt())` so Postgres evaluates the
  auth context once per query instead of once per row.

  ### 2. "Always True" policies removed
  - `Anyone can update templates` (bypassed RLS for all roles)
  - `Anyone can delete verification jobs` (bypassed RLS for all roles)

  ### 3. Unused indexes dropped
  - `verification_jobs_user_id_idx`
  - `templates_user_id_idx`

  ### 4. Function search_path hardened
  `public.update_updated_at` recreated with `SET search_path = public`.

  ### Tables affected
  - public.api_keys
  - public.app_settings
  - public.color_swatches
  - public.templates
  - public.verification_jobs
*/

-- ============================================================
-- api_keys policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can insert own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete own api keys" ON public.api_keys;

CREATE POLICY "Users can view own api keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own api keys"
  ON public.api_keys FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own api keys"
  ON public.api_keys FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own api keys"
  ON public.api_keys FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- app_settings policies
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON public.app_settings;

CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can delete settings"
  ON public.app_settings FOR DELETE
  TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- color_swatches policies
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert swatches" ON public.color_swatches;
DROP POLICY IF EXISTS "Admins can update swatches" ON public.color_swatches;
DROP POLICY IF EXISTS "Admins can delete swatches" ON public.color_swatches;

CREATE POLICY "Admins can insert swatches"
  ON public.color_swatches FOR INSERT
  TO authenticated
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can update swatches"
  ON public.color_swatches FOR UPDATE
  TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can delete swatches"
  ON public.color_swatches FOR DELETE
  TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- templates — remove always-true policy, re-create with select wrapping
-- ============================================================
DROP POLICY IF EXISTS "Anyone can update templates" ON public.templates;
DROP POLICY IF EXISTS "Users insert own templates" ON public.templates;
DROP POLICY IF EXISTS "Users read own templates" ON public.templates;
DROP POLICY IF EXISTS "Users update own templates" ON public.templates;
DROP POLICY IF EXISTS "Users delete own templates" ON public.templates;

CREATE POLICY "Users read own templates"
  ON public.templates FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  );

CREATE POLICY "Users insert own templates"
  ON public.templates FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users update own templates"
  ON public.templates FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  );

CREATE POLICY "Users delete own templates"
  ON public.templates FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  );

-- ============================================================
-- verification_jobs — remove always-true policy, re-create with select wrapping
-- ============================================================
DROP POLICY IF EXISTS "Anyone can delete verification jobs" ON public.verification_jobs;
DROP POLICY IF EXISTS "Users insert own verification jobs" ON public.verification_jobs;
DROP POLICY IF EXISTS "Users read own verification jobs" ON public.verification_jobs;
DROP POLICY IF EXISTS "Users update own verification jobs" ON public.verification_jobs;
DROP POLICY IF EXISTS "Users delete own verification jobs" ON public.verification_jobs;

CREATE POLICY "Users read own verification jobs"
  ON public.verification_jobs FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  );

CREATE POLICY "Users insert own verification jobs"
  ON public.verification_jobs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users update own verification jobs"
  ON public.verification_jobs FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  );

CREATE POLICY "Users delete own verification jobs"
  ON public.verification_jobs FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  );

-- ============================================================
-- Drop unused indexes
-- ============================================================
DROP INDEX IF EXISTS public.verification_jobs_user_id_idx;
DROP INDEX IF EXISTS public.templates_user_id_idx;

-- ============================================================
-- Fix update_updated_at function search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
