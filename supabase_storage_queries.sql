-- ==============================================================================
-- SUPABASE STORAGE QUERIES & SETUP FOR ALL UPLOADED DOCUMENTS
-- ==============================================================================
-- Use this script in Supabase SQL Editor to:
-- 1. Initialize or verify Storage Buckets and RLS Security Policies
-- 2. Create the unified `view_uploaded_documents` database view
-- 3. Run audit, verification, and inspection queries for uploaded files
-- ==============================================================================

SET search_path = public, extensions, storage;

-- ------------------------------------------------------------------------------
-- 1. STORAGE BUCKETS INITIALIZATION & POLICIES
-- ------------------------------------------------------------------------------
-- Ensure buckets exist with appropriate limits and MIME rules
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'event-identity-documents',
    'event-identity-documents',
    false,
    10485760, -- 10 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'event-photos',
    'event-photos',
    false,
    5242880,  -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'event-public-assets',
    'event-public-assets',
    true,
    5242880,  -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Row Level Security (RLS) Policies
-- Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow auth insert to identity documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow auth select on identity documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow auth update on identity documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public select on public assets" ON storage.objects;
EXCEPTION WHEN OTHERS THEN null; END $$;

CREATE POLICY "Allow auth insert to identity documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('event-identity-documents', 'event-photos'));

CREATE POLICY "Allow auth select on identity documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('event-identity-documents', 'event-photos'));

CREATE POLICY "Allow auth update on identity documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('event-identity-documents', 'event-photos'))
WITH CHECK (bucket_id IN ('event-identity-documents', 'event-photos'));

CREATE POLICY "Allow public select on public assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event-public-assets');


-- ------------------------------------------------------------------------------
-- 2. MASTER VIEW: ALL UPLOADED DOCUMENTS WITH REGISTRATION METADATA
-- ------------------------------------------------------------------------------
-- This view consolidates registration, participant, and storage file metadata
-- for instant inspection in the Supabase Table Editor or SQL Editor.

CREATE OR REPLACE VIEW view_uploaded_documents AS
SELECT
  d.id AS document_id,
  r.id AS registration_id,
  r.event_id,
  r.registration_number,
  r.physical_form_number,
  r.full_name_en,
  r.mobile,
  r.gender,
  ct.name_en AS category_name,
  d.doc_type,
  d.original_filename,
  d.mime_type,
  d.file_size_bytes,
  ROUND((d.file_size_bytes::numeric / 1024), 2) AS file_size_kb,
  ROUND((d.file_size_bytes::numeric / (1024 * 1024)), 2) AS file_size_mb,
  CASE
    WHEN d.doc_type = 'PHOTOGRAPH' THEN 'event-photos'
    ELSE 'event-identity-documents'
  END AS bucket_name,
  d.file_path,
  d.status AS document_status,
  d.remarks AS document_remarks,
  r.status AS registration_status,
  up_uploader.full_name_en AS uploaded_by_name,
  up_verifier.full_name_en AS verified_by_name,
  d.verified_at,
  d.created_at AS uploaded_at
FROM documents d
INNER JOIN registrations r ON d.registration_id = r.id
LEFT JOIN card_types ct ON r.category_id = ct.id
LEFT JOIN user_profiles up_uploader ON d.uploaded_by = up_uploader.id
LEFT JOIN user_profiles up_verifier ON d.verified_by = up_verifier.id;


-- ==============================================================================
-- 3. READY-TO-USE AUDIT & REPORTING QUERIES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- QUERY A: LIST ALL UPLOADED DOCUMENTS ORDERED BY MOST RECENT
-- ------------------------------------------------------------------------------
-- Run this query to view every document uploaded across the entire system:
/*
SELECT 
  physical_form_number,
  registration_number,
  full_name_en,
  mobile,
  doc_type,
  original_filename,
  file_size_kb,
  bucket_name,
  file_path,
  document_status,
  uploaded_at
FROM view_uploaded_documents
ORDER BY uploaded_at DESC;
*/


-- ------------------------------------------------------------------------------
-- QUERY B: STORAGE USAGE SUMMARY (TOTAL FILES & DISK SPACE BY DOCUMENT TYPE)
-- ------------------------------------------------------------------------------
-- Run this query to see aggregate storage breakdown:
/*
SELECT
  doc_type,
  COUNT(*) AS total_files,
  ROUND(SUM(file_size_bytes)::numeric / 1024 / 1024, 2) AS total_size_mb,
  ROUND(AVG(file_size_bytes)::numeric / 1024, 2) AS avg_size_kb,
  COUNT(CASE WHEN status = 'VERIFIED' THEN 1 END) AS verified_count,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN status = 'CORRECTION_REQUIRED' THEN 1 END) AS correction_count,
  COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) AS rejected_count
FROM documents
GROUP BY doc_type
ORDER BY total_size_mb DESC;
*/


-- ------------------------------------------------------------------------------
-- QUERY C: CHECK REGISTRATIONS MISSING ANY REQUIRED UPLOAD
-- ------------------------------------------------------------------------------
-- Identifies any participant who is missing either:
-- 1. Passport Photo (PHOTOGRAPH)
-- 2. Aadhaar Card (IDENTITY_PROOF)
-- 3. Physical Paper Form Scan (APPLICATION_FORM)
/*
SELECT
  r.physical_form_number,
  r.registration_number,
  r.full_name_en,
  r.mobile,
  r.status AS registration_status,
  CASE WHEN bool_or(d.doc_type = 'PHOTOGRAPH') THEN 'YES' ELSE 'MISSING' END AS has_photo,
  CASE WHEN bool_or(d.doc_type = 'IDENTITY_PROOF') THEN 'YES' ELSE 'MISSING' END AS has_aadhaar,
  CASE WHEN bool_or(d.doc_type = 'APPLICATION_FORM') THEN 'YES' ELSE 'MISSING' END AS has_physical_form
FROM registrations r
LEFT JOIN documents d ON r.id = d.registration_id
GROUP BY r.id, r.physical_form_number, r.registration_number, r.full_name_en, r.mobile, r.status
HAVING NOT (
  bool_or(d.doc_type = 'PHOTOGRAPH') AND 
  bool_or(d.doc_type = 'IDENTITY_PROOF') AND 
  bool_or(d.doc_type = 'APPLICATION_FORM')
)
ORDER BY r.created_at DESC;
*/


-- ------------------------------------------------------------------------------
-- QUERY D: RETRIEVE ALL DOCUMENTS FOR A SPECIFIC PHYSICAL FORM NUMBER
-- ------------------------------------------------------------------------------
-- Replace 'FORM-001' with the physical paper form number:
/*
SELECT
  physical_form_number,
  registration_number,
  full_name_en,
  doc_type,
  original_filename,
  bucket_name,
  file_path,
  document_status,
  uploaded_at
FROM view_uploaded_documents
WHERE physical_form_number = 'FORM-001'
ORDER BY doc_type;
*/


-- ------------------------------------------------------------------------------
-- QUERY E: INTEGRITY AUDIT — STORAGE OBJECTS VS DATABASE RECORDS
-- ------------------------------------------------------------------------------
-- Detects orphaned files in Supabase Storage that have no record in the documents table:
/*
SELECT
  o.bucket_id,
  o.name AS storage_file_path,
  ROUND((o.metadata->>'size')::numeric / 1024, 2) AS file_size_kb,
  o.created_at AS uploaded_to_storage,
  CASE 
    WHEN d.id IS NULL THEN 'ORPHANED_FILE'
    ELSE 'LINKED'
  END AS sync_status
FROM storage.objects o
LEFT JOIN documents d ON o.name = d.file_path
WHERE o.bucket_id IN ('event-identity-documents', 'event-photos')
ORDER BY sync_status, o.created_at DESC;
*/
