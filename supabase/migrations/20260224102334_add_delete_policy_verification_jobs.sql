/*
  # Add DELETE policy for verification_jobs

  ## Summary
  The verification_jobs table was missing a DELETE policy, causing all delete
  attempts to silently fail despite RLS being enabled. This migration adds the
  missing policy so authenticated and anonymous users can delete jobs.

  ## Changes
  - Adds DELETE policy on verification_jobs to match the existing INSERT/SELECT/UPDATE policies
*/

CREATE POLICY "Anyone can delete verification jobs"
  ON verification_jobs
  FOR DELETE
  TO anon, authenticated
  USING (true);
