/*
  # Add masks2 column to templates table

  ## Overview
  The templates table previously only stored a single mask2 (MaskRect) for document 2.
  Now that document 2 supports multiple mask definitions (MaskDefinition[]), we need a
  new column to store the full array.

  ## Changes

  ### templates table
  - `masks2` (jsonb) — nullable array of MaskDefinition objects for document 2
    The old `mask2` column is kept for backwards compatibility with existing templates.

  ## Notes
  - Existing templates with only `mask2` will continue to work; the application falls
    back to `mask2` when `masks2` is null.
  - New saves will write both `mask2` (first mask for legacy compat) and `masks2` (full array).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'templates' AND column_name = 'masks2'
  ) THEN
    ALTER TABLE templates ADD COLUMN masks2 jsonb;
  END IF;
END $$;
