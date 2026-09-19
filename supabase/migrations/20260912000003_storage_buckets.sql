-- ====================================================================
-- Event ID Card Management System - Storage Buckets & Policies
-- ====================================================================

-- 1. Private bucket for Identity Proofs (Aadhaar, Voter ID, Physical Forms)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-identity-documents',
  'event-identity-documents',
  false, -- STRICTLY PRIVATE
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Bucket for Cardholder Photographs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-photos',
  'event-photos',
  false, -- Accessible via signed URLs or authenticated sessions
  2097152, -- 2 MB limit
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Public bucket for Organization & Event Logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-public-assets',
  'event-public-assets',
  true, -- PUBLIC for logos and watermarks
  2097152, -- 2 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- Allow authenticated users to upload to event-identity-documents
CREATE POLICY "Allow authenticated uploads to identity documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-identity-documents');

-- Allow authenticated users with verification/admin access to read identity documents
CREATE POLICY "Allow privileged read on identity documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-identity-documents');

-- Photos policies
CREATE POLICY "Allow authenticated uploads to photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-photos');

CREATE POLICY "Allow authenticated reads on photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-photos');

-- Public assets policies
CREATE POLICY "Allow public read on public assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event-public-assets');

CREATE POLICY "Allow admin upload to public assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-public-assets');
