/*
  # Add user_id to verification_jobs and templates — isolate data per user

  ## Summary
  This migration enforces per-user data isolation for verification_jobs and templates.
  Previously all users could read/write all records. Now each user only sees their own
  records. The admin (role = 'admin' in app_metadata) can still see every record.

  ## Changes

  ### verification_jobs
  - Add `user_id` column (uuid, references auth.users, nullable for backward-compat)
  - Drop old open policies
  - Add new restrictive policies:
    - INSERT: authenticated users only, must set user_id = auth.uid()
    - SELECT: users see only their own rows; admin sees all
    - UPDATE: users can update only their own rows; admin can update all
    - DELETE: users can delete only their own rows; admin can delete all

  ### templates
  - Add `user_id` column (uuid, references auth.users, nullable for backward-compat)
  - Drop old open policies
  - Add new restrictive policies:
    - INSERT: authenticated users only, must set user_id = auth.uid()
    - SELECT: users see only their own rows; admin sees all
    - UPDATE: users can update only their own rows; admin can update all
    - DELETE: users can delete only their own rows; admin can delete all

  ## Notes
  1. Existing rows have NULL user_id — admin will still see them, regular users will not
     see other users' historic rows (only their own future ones).
  2. We use auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' to identify admins
     without needing a separate profiles table.
*/

-- ============================================================
-- verification_jobs
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'verification_jobs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE verification_jobs ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS verification_jobs_user_id_idx ON verification_jobs(user_id);

-- Drop old open policies
DROP POLICY IF EXISTS "Anyone can insert verification jobs" ON verification_jobs;
DROP POLICY IF EXISTS "Anyone can read verification jobs" ON verification_jobs;
DROP POLICY IF EXISTS "Anyone can update verification jobs" ON verification_jobs;
DROP POLICY IF EXISTS "Users can delete their own verification jobs" ON verification_jobs;

-- New policies
CREATE POLICY "Users insert own verification jobs"
  ON verification_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own verification jobs"
  ON verification_jobs FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Users update own verification jobs"
  ON verification_jobs FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Users delete own verification jobs"
  ON verification_jobs FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ============================================================
-- templates
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'templates' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE templates ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS templates_user_id_idx ON templates(user_id);

-- Drop old open policies
DROP POLICY IF EXISTS "Anyone can read templates" ON templates;
DROP POLICY IF EXISTS "Anyone can insert templates" ON templates;
DROP POLICY IF EXISTS "Anyone can delete templates" ON templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON templates;

-- New policies
CREATE POLICY "Users insert own templates"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own templates"
  ON templates FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Users update own templates"
  ON templates FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Users delete own templates"
  ON templates FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
