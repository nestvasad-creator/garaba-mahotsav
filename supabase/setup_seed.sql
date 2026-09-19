-- ==============================================================================
-- EVENT ID CARD MANAGEMENT SYSTEM — COMPLETE SETUP & SEED SCRIPT
-- ==============================================================================
-- Location: supabase/setup_seed.sql
-- Organization: The New English School Trust, Vasad (NEST)
-- Target Event: Navratri Mahotsav 2026
--
-- Features:
-- 1. Automatic Teardown (Drops existing objects first to avoid conflicts on re-run)
-- 2. Safe ENUM types with existence checks in pg_type
-- 3. Core Relational Schema with mandatory physical_form_number & unique constraint
-- 4. Clean English card categories (zero corrupted Gujarati mojibake)
-- 5. Dynamic category & gender theme palette engine (Male Blue, Female Pink, etc.)
-- 6. Storage buckets & RLS access control policies for storage.objects
-- 7. Unified master view: view_uploaded_documents
-- 8. Complete RBAC permissions catalog & role mappings (all 7 roles)
-- 9. Seeded Auth Test Accounts for all 7 roles with test names and shared password
-- 10. ZERO dummy participants, documents, or print logs
--
-- Execution:
-- 1. Open Supabase Dashboard -> SQL Editor (New Query)
-- 2. Paste this entire script and click "Run"
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & SEARCH PATH
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

SET search_path = public, extensions, storage;

-- ------------------------------------------------------------------------------
-- 2. CLEAN TEARDOWN (DELETE FIRST IF EXISTS TO PREVENT CONFLICTS ON RE-RUN)
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS view_uploaded_documents CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS qr_scans CASCADE;
DROP TABLE IF EXISTS print_jobs CASCADE;
DROP TABLE IF EXISTS id_cards CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS card_themes CASCADE;
DROP TABLE IF EXISTS card_types CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

DROP TYPE IF EXISTS reprint_reason_type CASCADE;
DROP TYPE IF EXISTS print_job_status CASCADE;
DROP TYPE IF EXISTS card_status CASCADE;
DROP TYPE IF EXISTS verification_status CASCADE;
DROP TYPE IF EXISTS document_type CASCADE;
DROP TYPE IF EXISTS registration_status CASCADE;
DROP TYPE IF EXISTS user_role_type CASCADE;

-- ------------------------------------------------------------------------------
-- 3. ENUM TYPES (WITH EXISTENCE CHECKS)
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_type') THEN
    CREATE TYPE user_role_type AS ENUM (
      'SUPER_ADMIN',
      'EVENT_ADMIN',
      'VERIFIER',
      'DATA_ENTRY_OPERATOR',
      'SPECIAL_ID_OPERATOR',
      'PRINTER_OPERATOR',
      'SECURITY'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_status') THEN
    CREATE TYPE registration_status AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'UNDER_VERIFICATION',
      'CORRECTION_REQUIRED',
      'REJECTED',
      'APPROVED'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
    CREATE TYPE document_type AS ENUM (
      'APPLICATION_FORM',
      'IDENTITY_PROOF',
      'PHOTOGRAPH',
      'OTHER'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE verification_status AS ENUM (
      'PENDING',
      'VERIFIED',
      'REJECTED',
      'CORRECTION_REQUIRED'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_status') THEN
    CREATE TYPE card_status AS ENUM (
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'PRINT_QUEUED',
      'PRINTED',
      'REPRINTED',
      'CANCELLED',
      'EXPIRED'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'print_job_status') THEN
    CREATE TYPE print_job_status AS ENUM (
      'QUEUED',
      'PRINTING',
      'PRINTED',
      'FAILED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reprint_reason_type') THEN
    CREATE TYPE reprint_reason_type AS ENUM (
      'LOST',
      'DAMAGED',
      'WRONG_PRINT',
      'PRINTER_FAILURE',
      'PHOTO_REPLACEMENT',
      'OTHER'
    );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. CORE RELATIONAL TABLES
-- ------------------------------------------------------------------------------

-- Organizations / Trusts
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_gu TEXT NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_gu TEXT NOT NULL,
  code VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- User Profiles (Linked with Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name_en TEXT NOT NULL,
  full_name_gu TEXT,
  mobile VARCHAR(15) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissions Catalog
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT
);

-- Roles Definition
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false
);

-- Role-Permissions Junction
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- User-Roles Assignment
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id, event_id)
);

-- Card Types / Categories (Pure English labels)
CREATE TABLE card_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name_en TEXT NOT NULL,
  name_gu TEXT NOT NULL,
  is_registered BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, code)
);

-- Card Themes (Dynamic palette determined by category & gender rule)
CREATE TABLE card_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  card_type_id UUID NOT NULL REFERENCES card_types(id) ON DELETE CASCADE,
  gender_rule VARCHAR(10), -- 'MALE', 'FEMALE', or NULL for all
  primary_color VARCHAR(20) NOT NULL DEFAULT '#1E40AF',
  header_color VARCHAR(20) NOT NULL DEFAULT '#1E3A8A',
  footer_color VARCHAR(20) NOT NULL DEFAULT '#1E3A8A',
  accent_color VARCHAR(20) NOT NULL DEFAULT '#F59E0B',
  text_color VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
  logo_url TEXT,
  watermark_url TEXT,
  template_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, card_type_id, gender_rule)
);

-- Registrations (With physical_form_number on top and mandatory)
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_number VARCHAR(50) NOT NULL,
  physical_form_number VARCHAR(100) NOT NULL,
  receipt_number VARCHAR(100),
  full_name_en TEXT NOT NULL,
  full_name_gu TEXT NOT NULL,
  father_husband_name_en TEXT,
  father_husband_name_gu TEXT,
  gender VARCHAR(10) NOT NULL,
  dob DATE,
  mobile VARCHAR(15) NOT NULL,
  alternate_mobile VARCHAR(15),
  address_en TEXT NOT NULL DEFAULT 'As per physical form / Vasad',
  address_gu TEXT NOT NULL DEFAULT 'As per physical form / Vasad',
  area_zone TEXT DEFAULT 'Vasad',
  city TEXT DEFAULT 'Vasad',
  state TEXT DEFAULT 'Gujarat',
  pincode VARCHAR(10) DEFAULT '388306',
  status registration_status NOT NULL DEFAULT 'DRAFT',
  category_id UUID NOT NULL REFERENCES card_types(id),
  created_by UUID REFERENCES user_profiles(id),
  verified_by UUID REFERENCES user_profiles(id),
  verified_at TIMESTAMPTZ,
  verification_remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, registration_number),
  CONSTRAINT uq_registrations_event_physical_form UNIQUE(event_id, physical_form_number)
);

-- Document Attachments (Form Scan, Aadhaar Copy, Photo)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  doc_type document_type NOT NULL,
  file_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  status verification_status NOT NULL DEFAULT 'PENDING',
  remarks TEXT,
  uploaded_by UUID REFERENCES user_profiles(id),
  verified_by UUID REFERENCES user_profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Issued Physical Cards
CREATE TABLE id_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  card_type_id UUID NOT NULL REFERENCES card_types(id),
  theme_id UUID NOT NULL REFERENCES card_themes(id),
  card_number VARCHAR(50) NOT NULL,
  qr_code_hash TEXT NOT NULL,
  status card_status NOT NULL DEFAULT 'DRAFT',
  is_active BOOLEAN NOT NULL DEFAULT true,
  recipient_name_en TEXT NOT NULL,
  recipient_name_gu TEXT NOT NULL,
  recipient_mobile VARCHAR(15),
  recipient_photo_path TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, card_number)
);

-- Print Queue & Jobs
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES id_cards(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  status print_job_status NOT NULL DEFAULT 'QUEUED',
  is_reprint BOOLEAN NOT NULL DEFAULT false,
  reprint_reason reprint_reason_type,
  reprint_notes TEXT,
  printed_by UUID REFERENCES user_profiles(id),
  printed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, job_number)
);

-- Gate QR Verification Scans
CREATE TABLE qr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES id_cards(id) ON DELETE CASCADE,
  scanner_user_id UUID NOT NULL REFERENCES user_profiles(id),
  scan_result VARCHAR(20) NOT NULL,
  gate_name VARCHAR(50),
  device_info JSONB,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(100),
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX idx_registrations_mobile ON registrations(event_id, mobile);
CREATE INDEX idx_registrations_status ON registrations(event_id, status);
CREATE INDEX idx_registrations_physical_form_no ON registrations(event_id, physical_form_number);
CREATE INDEX idx_documents_reg ON documents(registration_id);
CREATE INDEX idx_id_cards_qr ON id_cards(event_id, qr_code_hash);
CREATE INDEX idx_print_jobs_status ON print_jobs(event_id, status);
CREATE INDEX idx_qr_scans_card ON qr_scans(card_id, scanned_at DESC);

-- ------------------------------------------------------------------------------
-- 6. PERMISSIONS CATALOG & RBAC MATRIX
-- ------------------------------------------------------------------------------
INSERT INTO permissions (code, name, category, description) VALUES
  ('CREATE_REGISTRATION', 'Create Registration', 'REGISTRATION', 'Submit new registration forms'),
  ('EDIT_REGISTRATION', 'Edit Registration', 'REGISTRATION', 'Modify participant data'),
  ('VIEW_REGISTRATION', 'View Registration', 'REGISTRATION', 'Read participant details'),
  ('DELETE_REGISTRATION', 'Delete Registration', 'REGISTRATION', 'Permanently delete record'),
  ('SEARCH_REGISTRATION', 'Search Registrations', 'REGISTRATION', 'Find records by mobile/name/form'),
  ('UPLOAD_DOCUMENT', 'Upload Documents', 'DOCUMENT', 'Upload identity, form, or photo files'),
  ('VIEW_DOCUMENT', 'View Documents', 'DOCUMENT', 'View uploaded verification documents'),
  ('VERIFY_DOCUMENT', 'Verify Documents', 'DOCUMENT', 'Approve or reject uploaded documents'),
  ('REJECT_DOCUMENT', 'Reject Documents', 'DOCUMENT', 'Mark documents as invalid'),
  ('APPROVE_REGISTRATION', 'Approve Registration', 'APPROVAL', 'Approve registration for card generation'),
  ('REJECT_REGISTRATION', 'Reject Registration', 'APPROVAL', 'Reject registration entirely'),
  ('SEND_FOR_CORRECTION', 'Send for Correction', 'APPROVAL', 'Request correction from DEO/applicant'),
  ('GENERATE_REGISTERED_CARD', 'Generate Registered Card', 'CARD', 'Generate CR80 card for approved registration'),
  ('PRINT_REGISTERED_CARD', 'Print Registered Card', 'CARD', 'Send card to CR80 PVC card printer'),
  ('ISSUE_NON_REGISTERED_CARD', 'Issue Special ID Card', 'SPECIAL_CARD', 'Issue VIP/Guest/Staff pass directly'),
  ('APPROVE_NON_REGISTERED_CARD', 'Approve Special ID Card', 'SPECIAL_CARD', 'Authorize special card issuance'),
  ('PRINT_NON_REGISTERED_ID_CARD', 'Print Special ID Card', 'SPECIAL_CARD', 'Send special card to printer'),
  ('REPRINT_CARD', 'Reprint Card', 'REPRINT', 'Request and execute card reprint with reason tracking'),
  ('SCAN_QR', 'Scan QR Code', 'SCAN', 'Verify card authenticity at gate using mobile camera'),
  ('VIEW_QR_STATUS', 'View QR Status', 'SCAN', 'See gate access status and pass validity'),
  ('VIEW_AUDIT_LOGS', 'View Audit Logs', 'AUDIT', 'Audit operator actions and gate verifications'),
  ('MANAGE_USERS', 'Manage Users', 'ADMIN', 'Create users and assign system roles'),
  ('VIEW_REPORTS', 'View Reports', 'REPORTS', 'Access charts and export Excel/PDF reports')
ON CONFLICT (code) DO NOTHING;

-- Seed Roles
INSERT INTO roles (code, name, description, is_system) VALUES
  ('SUPER_ADMIN', 'Super Administrator', 'Full unrestricted platform access across all organizations and modules', true),
  ('EVENT_ADMIN', 'Event Administrator', 'Event manager: oversees registrations, verifications, printers, and cards', true),
  ('VERIFIER', 'Verification Officer (Checker)', 'Responsible for reviewing Aadhaar proofs, photos, and approving registrations', true),
  ('DATA_ENTRY_OPERATOR', 'Data Entry Operator (Maker)', 'Responsible for entering participant details and attaching documents', true),
  ('SPECIAL_ID_OPERATOR', 'Special ID Operator', 'Issues non-registered passes (VIP, Guests, Trustees, Volunteers, Press)', true),
  ('PRINTER_OPERATOR', 'Card Printer Operator', 'Manages physical CR80 badge printer queue and reprint workflows', true),
  ('SECURITY', 'Gate Security Officer', 'Scans attendee badges at entry turnstiles and checkpoints', true)
ON CONFLICT (code) DO NOTHING;

-- Map Role Permissions
DO $$
DECLARE
  v_super_admin UUID;
  v_event_admin UUID;
  v_verifier UUID;
  v_data_entry UUID;
  v_special_id UUID;
  v_printer UUID;
  v_security UUID;
BEGIN
  SELECT id INTO v_super_admin FROM roles WHERE code = 'SUPER_ADMIN';
  SELECT id INTO v_event_admin FROM roles WHERE code = 'EVENT_ADMIN';
  SELECT id INTO v_verifier FROM roles WHERE code = 'VERIFIER';
  SELECT id INTO v_data_entry FROM roles WHERE code = 'DATA_ENTRY_OPERATOR';
  SELECT id INTO v_special_id FROM roles WHERE code = 'SPECIAL_ID_OPERATOR';
  SELECT id INTO v_printer FROM roles WHERE code = 'PRINTER_OPERATOR';
  SELECT id INTO v_security FROM roles WHERE code = 'SECURITY';

  -- 1. Super Admin gets ALL permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_super_admin, id FROM permissions
  ON CONFLICT DO NOTHING;

  -- 2. Event Admin gets all event operations
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_event_admin, id FROM permissions
  WHERE code NOT IN ('DELETE_REGISTRATION')
  ON CONFLICT DO NOTHING;

  -- 3. Verifier (Checker)
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_verifier, id FROM permissions
  WHERE code IN (
    'VIEW_REGISTRATION', 'SEARCH_REGISTRATION', 'VIEW_DOCUMENT', 'VERIFY_DOCUMENT',
    'REJECT_DOCUMENT', 'APPROVE_REGISTRATION', 'REJECT_REGISTRATION', 'SEND_FOR_CORRECTION',
    'GENERATE_REGISTERED_CARD', 'SCAN_QR', 'VIEW_QR_STATUS', 'VIEW_REPORTS'
  )
  ON CONFLICT DO NOTHING;

  -- 4. Data Entry Operator (Maker)
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_data_entry, id FROM permissions
  WHERE code IN (
    'CREATE_REGISTRATION', 'EDIT_REGISTRATION', 'VIEW_REGISTRATION', 'SEARCH_REGISTRATION',
    'UPLOAD_DOCUMENT'
  )
  ON CONFLICT DO NOTHING;

  -- 5. Special ID Operator
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_special_id, id FROM permissions
  WHERE code IN (
    'VIEW_REGISTRATION', 'SEARCH_REGISTRATION', 'UPLOAD_DOCUMENT', 'VIEW_DOCUMENT',
    'ISSUE_NON_REGISTERED_CARD', 'APPROVE_NON_REGISTERED_CARD', 'PRINT_NON_REGISTERED_ID_CARD',
    'SCAN_QR', 'VIEW_QR_STATUS'
  )
  ON CONFLICT DO NOTHING;

  -- 6. Printer Operator
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_printer, id FROM permissions
  WHERE code IN (
    'VIEW_REGISTRATION', 'GENERATE_REGISTERED_CARD', 'PRINT_REGISTERED_CARD', 'REPRINT_CARD'
  )
  ON CONFLICT DO NOTHING;

  -- 7. Security Officer
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_security, id FROM permissions
  WHERE code IN ('SCAN_QR', 'VIEW_QR_STATUS')
  ON CONFLICT DO NOTHING;
END $$;

-- ------------------------------------------------------------------------------
-- 7. EVENT & ORGANIZATION SEED
-- ------------------------------------------------------------------------------

-- Organization
INSERT INTO organizations (id, name_en, name_gu, code)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'The New English School Trust, Vasad',
  'The New English School Trust, Vasad',
  'NEST'
) ON CONFLICT (code) DO UPDATE
SET name_en = EXCLUDED.name_en,
    name_gu = EXCLUDED.name_gu;

-- Target Event
INSERT INTO events (id, organization_id, name_en, name_gu, code, start_date, end_date, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Navratri Mahotsav 2026',
  'Navratri Mahotsav 2026',
  'NEST',
  '2026-10-01',
  '2026-10-12',
  true
) ON CONFLICT (organization_id, code) DO UPDATE
SET name_en = EXCLUDED.name_en,
    name_gu = EXCLUDED.name_gu;

-- Card Categories (Pure English labels - zero corrupted Gujarati)
INSERT INTO card_types (id, event_id, code, name_en, name_gu, is_registered, requires_approval)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'REG_PARTICIPANT', 'Registered Participant', 'Registered Participant', true, true),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000010', 'SECURITY', 'Security Personnel', 'Security Personnel', false, true),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000010', 'VOLUNTEER', 'Volunteer', 'Volunteer', false, true),
  ('10000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 'SPONSOR', 'Sponsor', 'સ્પોન્સર', true, true),
  ('10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000010', 'CREW', 'Crew', 'ક્રૂ', true, true)
ON CONFLICT (event_id, code) DO UPDATE
SET name_en = EXCLUDED.name_en,
    name_gu = EXCLUDED.name_gu;

-- Dynamic Card Themes (Category & Gender Rules)
INSERT INTO card_themes (event_id, card_type_id, gender_rule, primary_color, header_color, footer_color, accent_color, text_color)
VALUES
  -- Registered Participant - Male (Royal Blue)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'MALE', '#1E40AF', '#1E3A8A', '#1E3A8A', '#F59E0B', '#FFFFFF'),
  -- Registered Participant - Female (Deep Pink)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'FEMALE', '#BE185D', '#831843', '#831843', '#FDE047', '#FFFFFF'),
  -- Registered Participant - Generic Fallback
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', NULL, '#1E40AF', '#1E3A8A', '#1E3A8A', '#F59E0B', '#FFFFFF'),
  -- Security (Crimson Red)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000004', NULL, '#B91C1C', '#7F1D1D', '#7F1D1D', '#FCA5A5', '#FFFFFF'),
  -- Volunteer (Vibrant Orange)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000005', NULL, '#C2410C', '#7C2D12', '#7C2D12', '#FDBA74', '#FFFFFF'),
  -- Sponsor (Royal Fuchsia / Deep Wine)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000020', NULL, '#701A75', '#581C87', '#581C87', '#F59E0B', '#FFFFFF'),
  -- Crew (Midnight Slate)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000021', NULL, '#0F172A', '#1E293B', '#1E293B', '#38BDF8', '#FFFFFF')
ON CONFLICT (event_id, card_type_id, gender_rule) DO UPDATE
SET primary_color = EXCLUDED.primary_color,
    header_color = EXCLUDED.header_color,
    footer_color = EXCLUDED.footer_color,
    accent_color = EXCLUDED.accent_color,
    text_color = EXCLUDED.text_color;

-- ------------------------------------------------------------------------------
-- 8. STORAGE BUCKETS & POLICIES
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('event-identity-documents', 'event-identity-documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
  ('event-photos', 'event-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('event-public-assets', 'event-public-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Drop First if Existing)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated uploads to identity documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow privileged read on identity documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated uploads to photos" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated reads on photos" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public read on public assets" ON storage.objects;
EXCEPTION WHEN OTHERS THEN null; END $$;

CREATE POLICY "Allow authenticated uploads to identity documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-identity-documents');

CREATE POLICY "Allow privileged read on identity documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-identity-documents');

CREATE POLICY "Allow authenticated uploads to photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-photos');

CREATE POLICY "Allow authenticated reads on photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-photos');

CREATE POLICY "Allow public read on public assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event-public-assets');

-- ------------------------------------------------------------------------------
-- 9. MASTER DOCUMENT VIEW
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "Allow auth read organizations" ON organizations FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Allow auth read events" ON events FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Allow auth read card_types" ON card_types FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Allow auth read card_themes" ON card_themes FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Allow auth read registrations" ON registrations FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Allow auth insert registrations" ON registrations FOR INSERT TO authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Allow auth update registrations" ON registrations FOR UPDATE TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Allow auth read id_cards" ON id_cards FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Allow auth read print_jobs" ON print_jobs FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Allow public select for qr verification" ON id_cards FOR SELECT TO anon USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 11. USER AUTH SEED (ALL 7 USER ROLES WITH TEST NAMES ONLY)
-- ------------------------------------------------------------------------------
-- Shared Test Password for all test users: TestUser@2026
-- Hashed using standard Supabase bcrypt salt

DROP FUNCTION IF EXISTS seed_test_user;
CREATE OR REPLACE FUNCTION seed_test_user(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_mobile TEXT,
  p_role_code TEXT,
  p_password TEXT DEFAULT 'TestUser@2026'
) RETURNS VOID AS $$
DECLARE
  v_role_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  -- Generate bcrypt password hash (using extensions schema safely)
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- 1. Insert/Update into Supabase auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', p_role_code),
    now(),
    now(),
    '',
    ''
  ) ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      encrypted_password = v_encrypted_pw,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      email_confirmed_at = now();

  -- 2. Insert/Update into Supabase auth.identities safely
  BEGIN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      p_user_id::text,
      p_user_id,
      jsonb_build_object('sub', p_user_id::text, 'email', p_email),
      'email',
      p_email,
      now(),
      now(),
      now()
    ) ON CONFLICT (provider, provider_id) DO UPDATE
    SET identity_data = EXCLUDED.identity_data;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 3. Insert/Update public.user_profiles
  INSERT INTO public.user_profiles (id, full_name_en, full_name_gu, mobile, is_active)
  VALUES (p_user_id, p_full_name, p_full_name, p_mobile, true)
  ON CONFLICT (id) DO UPDATE
  SET full_name_en = EXCLUDED.full_name_en,
      full_name_gu = EXCLUDED.full_name_gu,
      mobile = EXCLUDED.mobile,
      is_active = true;

  -- 4. Assign Role in public.user_roles
  SELECT id INTO v_role_id FROM roles WHERE code = p_role_code;
  IF v_role_id IS NOT NULL THEN
    DELETE FROM user_roles WHERE user_id = p_user_id;
    INSERT INTO user_roles (user_id, role_id, event_id)
    VALUES (p_user_id, v_role_id, '00000000-0000-0000-0000-000000000010');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute Seed Function for all 7 Test User Roles
SELECT seed_test_user('8d24a3f2-3fb5-4c0c-a78a-ee3e08c2b5ae', 'superadmin@test.com', 'Test Super Admin',          '9000000001', 'SUPER_ADMIN');
SELECT seed_test_user('46510e45-d2fe-4819-b0b1-29af43e9c6bc', 'admin@test.com',      'Test Event Admin',          '9000000002', 'EVENT_ADMIN');
SELECT seed_test_user('f544de16-7c3a-4cc4-9aca-727d3f4a4e1b', 'verifier@test.com',   'Test Verifier',             '9000000003', 'VERIFIER');
SELECT seed_test_user('d8ae6a0a-798c-48cb-bc46-6ee8329d40c2', 'deo@test.com',        'Test Data Entry Operator',  '9000000004', 'DATA_ENTRY_OPERATOR');
SELECT seed_test_user('6ad85ed9-0553-4d80-80b6-dd1c8859c914', 'specialid@test.com',  'Test Special ID Operator',  '9000000005', 'SPECIAL_ID_OPERATOR');
SELECT seed_test_user('031d3933-4e15-4f74-a4c3-a6c6299b58d7', 'printer@test.com',    'Test Printer Operator',     '9000000006', 'PRINTER_OPERATOR');
SELECT seed_test_user('19dd098c-f496-4841-83b9-3727467b2c38', 'security@test.com',   'Test Security Officer',     '9000000007', 'SECURITY');

DROP FUNCTION IF EXISTS seed_test_user;

-- ------------------------------------------------------------------------------
-- 12. VERIFICATION & ZERO DUMMY DATA CONFIRMATION
-- ------------------------------------------------------------------------------
-- All participant tables (registrations, documents, id_cards, print_jobs, qr_scans)
-- are clean with 0 dummy records and ready for production enrollment.
-- ==============================================================================
