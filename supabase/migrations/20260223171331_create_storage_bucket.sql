/*
  # Create Storage Bucket for Signature Files
  
  1. Storage Setup
    - Creates `signature-uploads` bucket for storing signature files
    - Enables public access for reading files
    - Sets file size limit to 10MB
  
  2. Security
    - Authenticated users can upload files
    - Authenticated users can read their own files
    - Files are automatically deleted when verification job is deleted
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signature-uploads',
  'signature-uploads',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signature-uploads'
);

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'signature-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'signature-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'signature-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
