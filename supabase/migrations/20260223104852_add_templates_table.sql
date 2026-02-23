/*
  # Add Templates Table

  ## Overview
  Adds a templates table so users can save mask configurations
  and re-run comparisons on new files without redefining regions.

  ## New Tables

  ### templates
  - `id` (uuid, primary key)
  - `name` (text) - user-given label
  - `mask1` (jsonb) - region for document 1 including page number
  - `mask2` (jsonb) - region for document 2 including page number
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled; public anon read/insert/delete allowed (tool has no auth)
*/

CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Untitled Template',
  mask1 jsonb NOT NULL,
  mask2 jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read templates"
  ON templates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert templates"
  ON templates FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete templates"
  ON templates FOR DELETE
  TO anon, authenticated
  USING (true);
