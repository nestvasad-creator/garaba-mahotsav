-- ====================================================================
-- Event ID Card Management System - Participant Categories Update
-- Remove: Guest, Special Guest, Staff/Committee, Media/Press
-- Introduce: Sponsor (No QR, No Photo, No Form), Crew (No Photo, Requires QR)
-- ====================================================================

-- 1. Remove old card types and themes
DELETE FROM card_themes WHERE card_type_id IN (
  SELECT id FROM card_types WHERE code IN ('GUEST', 'VIP', 'STAFF', 'MEDIA')
);

DELETE FROM card_types WHERE code IN ('GUEST', 'VIP', 'STAFF', 'MEDIA');

-- 2. Ensure physical_form_number in registrations is nullable (not required for Sponsor)
ALTER TABLE registrations ALTER COLUMN physical_form_number DROP NOT NULL;

-- 3. Insert new Card Types
INSERT INTO card_types (id, event_id, code, name_en, name_gu, is_registered, requires_approval)
VALUES
  ('10000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 'SPONSOR', 'Sponsor', 'સ્પોન્સર', true, true),
  ('10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000010', 'CREW', 'Crew', 'ક્રૂ', true, true)
ON CONFLICT (event_id, code) DO UPDATE
SET name_en = EXCLUDED.name_en,
    name_gu = EXCLUDED.name_gu;

-- 4. Insert Default Card Themes for Sponsor & Crew
INSERT INTO card_themes (event_id, card_type_id, gender_rule, primary_color, header_color, footer_color, accent_color, text_color)
VALUES
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
