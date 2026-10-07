-- ====================================================================
-- Event ID Card Management System - Card Categories Update (Oct 2026)
-- Migration: 20261007000001_update_categories_trustee_guest_staff.sql
-- 1. Replace CREW with STAFF (Staff passes for Police, GEB, Event Duty)
-- 2. Add TRUSTEE (Similar layout to Sponsor: center logo & name, right Gujarati banner)
-- 3. Add GUEST (Anonymous badge template: logo, side text, bottom year text)
-- ====================================================================

-- 1. Replace CREW with STAFF in card_types
INSERT INTO card_types (id, event_id, code, name_en, name_gu, is_registered, requires_approval)
VALUES (
  '10000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000010',
  'STAFF',
  'Staff',
  'સ્ટાફ',
  true,
  true
)
ON CONFLICT (id) DO UPDATE
SET code = 'STAFF',
    name_en = 'Staff',
    name_gu = 'સ્ટાફ',
    is_registered = true,
    requires_approval = true;

-- 2. Insert/Update TRUSTEE in card_types
INSERT INTO card_types (id, event_id, code, name_en, name_gu, is_registered, requires_approval)
VALUES (
  '10000000-0000-0000-0000-000000000022',
  '00000000-0000-0000-0000-000000000010',
  'TRUSTEE',
  'Trustee',
  'ટ્રસ્ટી',
  true,
  true
)
ON CONFLICT (id) DO UPDATE
SET code = 'TRUSTEE',
    name_en = 'Trustee',
    name_gu = 'ટ્રસ્ટી',
    is_registered = true,
    requires_approval = true;

-- 3. Insert/Update GUEST in card_types (Non-registered pass)
INSERT INTO card_types (id, event_id, code, name_en, name_gu, is_registered, requires_approval)
VALUES (
  '10000000-0000-0000-0000-000000000023',
  '00000000-0000-0000-0000-000000000010',
  'GUEST',
  'Guest',
  'મહેમાન',
  false,
  true
)
ON CONFLICT (id) DO UPDATE
SET code = 'GUEST',
    name_en = 'Guest',
    name_gu = 'મહેમાન',
    is_registered = false,
    requires_approval = true;

-- 4. Default Card Themes
-- Staff Theme (Midnight Navy / Slate)
INSERT INTO card_themes (event_id, card_type_id, gender_rule, primary_color, header_color, footer_color, accent_color, text_color)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000021',
  NULL,
  '#0F172A',
  '#1E293B',
  '#1E293B',
  '#38BDF8',
  '#FFFFFF'
)
ON CONFLICT (event_id, card_type_id, gender_rule) DO UPDATE
SET primary_color = EXCLUDED.primary_color,
    header_color = EXCLUDED.header_color,
    footer_color = EXCLUDED.footer_color,
    accent_color = EXCLUDED.accent_color,
    text_color = EXCLUDED.text_color;

-- Trustee Theme (Royal Purple / Maroon with Gold)
INSERT INTO card_themes (event_id, card_type_id, gender_rule, primary_color, header_color, footer_color, accent_color, text_color)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000022',
  NULL,
  '#581C87',
  '#3B0764',
  '#3B0764',
  '#F59E0B',
  '#FFFFFF'
)
ON CONFLICT (event_id, card_type_id, gender_rule) DO UPDATE
SET primary_color = EXCLUDED.primary_color,
    header_color = EXCLUDED.header_color,
    footer_color = EXCLUDED.footer_color,
    accent_color = EXCLUDED.accent_color,
    text_color = EXCLUDED.text_color;

-- Guest Theme (Emerald Green with Amber/Gold)
INSERT INTO card_themes (event_id, card_type_id, gender_rule, primary_color, header_color, footer_color, accent_color, text_color)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000023',
  NULL,
  '#065F46',
  '#064E3B',
  '#064E3B',
  '#FDE047',
  '#FFFFFF'
)
ON CONFLICT (event_id, card_type_id, gender_rule) DO UPDATE
SET primary_color = EXCLUDED.primary_color,
    header_color = EXCLUDED.header_color,
    footer_color = EXCLUDED.footer_color,
    accent_color = EXCLUDED.accent_color,
    text_color = EXCLUDED.text_color;
