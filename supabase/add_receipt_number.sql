-- ==============================================================================
-- ADD RECEIPT NUMBER TO REGISTRATIONS TABLE
-- ==============================================================================
-- Run this in your Supabase Dashboard -> SQL Editor

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(100);

-- Enforce Unique Receipt Number per event (allows multiple NULLs for optional receipts)
DROP INDEX IF EXISTS idx_registrations_receipt_no;
CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_event_receipt_no
ON registrations(event_id, receipt_number)
WHERE receipt_number IS NOT NULL AND receipt_number != '';
