-- ============================================================
-- DATABASE RESET SCRIPT
-- Event ID Card Management System
--
-- WHAT THIS RESETS (operational/transactional data):
--   ✅ audit_logs       — all activity logs
--   ✅ qr_scans         — all gate scan records
--   ✅ print_jobs       — all print job queue entries
--   ✅ id_cards         — all generated ID cards
--   ✅ documents        — all uploaded document records
--   ✅ registrations    — all participant registrations
--
-- WHAT THIS KEEPS (config / auth data):
--   🔒 auth.users           — Supabase auth accounts (DO NOT TOUCH)
--   🔒 user_profiles        — operator profiles
--   🔒 user_roles           — role assignments
--   🔒 roles                — system role definitions
--   🔒 permissions          — permission catalog
--   🔒 role_permissions     — role ↔ permission mappings
--   🔒 organizations        — org master data
--   🔒 events               — event master data
--   🔒 card_types           — card category definitions
--   🔒 card_themes          — card color/theme config
--
-- HOW TO RUN:
--   Go to Supabase Dashboard → SQL Editor → paste this → Run
-- ============================================================

BEGIN;

-- 1. Audit logs (no FK deps, safe to delete first or last)
DELETE FROM audit_logs;

-- 2. QR scan logs
DELETE FROM qr_scans;

-- 3. Print jobs (depends on id_cards, delete before id_cards)
DELETE FROM print_jobs;

-- 4. ID Cards (depends on registrations, delete before registrations)
DELETE FROM id_cards;

-- 5. Documents (depends on registrations, delete before registrations)
DELETE FROM documents;

-- 6. Registrations (main table — delete last among operational tables)
DELETE FROM registrations;

-- Optional: Reset registration number sequences if you use any
-- (skip this if registration numbers are generated as UUIDs or from code)
-- ALTER SEQUENCE registrations_seq RESTART WITH 1;

COMMIT;

-- Verify counts after reset (run this separately to confirm):
-- SELECT 'registrations' AS tbl, COUNT(*) FROM registrations
-- UNION ALL SELECT 'documents',   COUNT(*) FROM documents
-- UNION ALL SELECT 'id_cards',    COUNT(*) FROM id_cards
-- UNION ALL SELECT 'print_jobs',  COUNT(*) FROM print_jobs
-- UNION ALL SELECT 'qr_scans',    COUNT(*) FROM qr_scans
-- UNION ALL SELECT 'audit_logs',  COUNT(*) FROM audit_logs;
