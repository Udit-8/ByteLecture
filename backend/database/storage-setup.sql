-- ByteLecture Storage Setup
-- Run this in Supabase SQL Editor after creating the main schema

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  (
    'pdfs',
    'pdfs',
    false,
    52428800, -- 50MB limit
    ARRAY['application/pdf']
  ),
  (
    'lecture-recordings',
    'lecture-recordings',
    false,
    2147483648, -- 2GB limit
    ARRAY['audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4', 'video/webm']
  ),
  (
    'user-avatars',
    'user-avatars',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO NOTHING;

-- Storage policies for PDFs bucket
CREATE POLICY "Users can upload their own PDFs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pdfs' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own PDFs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'pdfs' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own PDFs" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'pdfs' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own PDFs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'pdfs' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for lecture recordings bucket
CREATE POLICY "Users can upload their own recordings" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'lecture-recordings' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own recordings" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'lecture-recordings' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own recordings" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'lecture-recordings' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own recordings" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'lecture-recordings' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for user avatars bucket (public bucket)
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'user-avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  ); 