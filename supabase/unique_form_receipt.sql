-- ==============================================================================
-- DATABASE LEVEL UNIQUE CONSTRAINTS FOR PHYSICAL FORM & RECEIPT NUMBER
-- ==============================================================================
-- Run this in your Supabase Dashboard -> SQL Editor

-- 1. Ensure receipt_number column exists
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(100);

-- 2. Unique Index for physical_form_number per event (enforces 1:1 physical paper form uniqueness)
-- Drops older duplicate index if exists, then creates partial unique index
DROP INDEX IF EXISTS idx_registrations_physical_form_no;
CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_event_physical_form_no
ON registrations (event_id, physical_form_number)
WHERE physical_form_number IS NOT NULL AND physical_form_number != '';

-- 3. Unique Index for receipt_number per event (enforces unique receipt when provided)
DROP INDEX IF EXISTS idx_registrations_receipt_no;
CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_event_receipt_no
ON registrations (event_id, receipt_number)
WHERE receipt_number IS NOT NULL AND receipt_number != '';
