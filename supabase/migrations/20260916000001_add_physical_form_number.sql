-- ====================================================================
-- Migration: Add physical_form_number to registrations table
-- Purpose: Support mandatory tracking and de-duplication of physical paper forms
-- ====================================================================

-- Step 1: Add physical_form_number column if it doesn't exist
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS physical_form_number VARCHAR(100);

-- Step 2: Backfill existing registrations with fallback paper form numbers
UPDATE registrations
SET physical_form_number = 'LEGACY-' || registration_number
WHERE physical_form_number IS NULL;

-- Step 3: Enforce NOT NULL constraint now that existing records are backfilled
ALTER TABLE registrations
ALTER COLUMN physical_form_number SET NOT NULL;

-- Step 4: Create index for lightning-fast lookups during DEO entry and verification
CREATE INDEX IF NOT EXISTS idx_registrations_physical_form_no
ON registrations(event_id, physical_form_number);

-- Step 5: Prevent accidental double-entry of the exact same physical paper form within the same event
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_registrations_event_physical_form'
  ) THEN
    ALTER TABLE registrations
    ADD CONSTRAINT uq_registrations_event_physical_form
    UNIQUE (event_id, physical_form_number);
  END IF;
END $$;
