/*
  # Add UPDATE policy to templates table

  ## Summary
  Adds an UPDATE RLS policy to the templates table so users can edit
  existing template names and mask coordinates.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'templates' AND policyname = 'Anyone can update templates'
  ) THEN
    CREATE POLICY "Anyone can update templates"
      ON templates FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
