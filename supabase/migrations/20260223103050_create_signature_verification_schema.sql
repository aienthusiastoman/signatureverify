/*
  # Signature Verification Schema

  ## Overview
  Sets up the database schema for the signature verification tool.

  ## New Tables

  ### verification_jobs
  Tracks each signature comparison job with status, results, and metadata.

  Columns:
  - `id` (uuid, primary key) - unique job identifier
  - `file1_name` (text) - original name of first uploaded file
  - `file2_name` (text) - original name of second uploaded file
  - `file1_path` (text) - storage path for first file
  - `file2_path` (text) - storage path for second file
  - `mask1` (jsonb) - mask coordinates/dimensions for file 1 { x, y, width, height }
  - `mask2` (jsonb) - mask coordinates/dimensions for file 2
  - `status` (text) - job status: pending | processing | completed | failed
  - `confidence_score` (numeric) - 0-100 match confidence percentage
  - `result_path` (text) - storage path for generated comparison PDF
  - `error_message` (text) - error details if job failed
  - `created_at` (timestamptz) - job creation time
  - `updated_at` (timestamptz) - last update time

  ## Security
  - RLS enabled on verification_jobs
  - Public can insert and read jobs (no auth required for this tool)
  - Jobs are identified by their UUID for retrieval

  ## Notes
  1. Public access is intentional - this is a utility tool without user accounts
  2. Storage buckets must also be configured as public
*/

CREATE TABLE IF NOT EXISTS verification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file1_name text NOT NULL DEFAULT '',
  file2_name text NOT NULL DEFAULT '',
  file1_path text NOT NULL DEFAULT '',
  file2_path text NOT NULL DEFAULT '',
  mask1 jsonb,
  mask2 jsonb,
  status text NOT NULL DEFAULT 'pending',
  confidence_score numeric(5,2),
  result_path text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE verification_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert verification jobs"
  ON verification_jobs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read verification jobs"
  ON verification_jobs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update verification jobs"
  ON verification_jobs
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verification_jobs_updated_at
  BEFORE UPDATE ON verification_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
