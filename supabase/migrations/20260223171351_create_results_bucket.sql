/*
  # Create Storage Bucket for Result Files
  
  1. Storage Setup
    - Creates `signature-results` bucket for storing processed signature results
    - Sets file size limit to 20MB (larger for combined results)
  
  2. Security
    - Authenticated users can upload result files
    - Authenticated users can read their own result files
    - Authenticated users can delete their own result files
*/

-- Create the storage bucket for results
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signature-results',
  'signature-results',
  false,
  20971520, -- 20MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload result files
CREATE POLICY "Authenticated users can upload result files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signature-results'
);

-- Allow authenticated users to read their own result files
CREATE POLICY "Users can read their own result files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'signature-results' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own result files
CREATE POLICY "Users can delete their own result files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'signature-results' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own result files
CREATE POLICY "Users can update their own result files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'signature-results' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
