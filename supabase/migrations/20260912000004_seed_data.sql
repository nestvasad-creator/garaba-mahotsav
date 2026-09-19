-- ====================================================================
-- Event ID Card Management System - Initial Seed Data
-- ====================================================================

-- 1. Create Initial Trust / Organization
INSERT INTO organizations (id, name_en, name_gu, code)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'The New English School Trust, Vasad',
  'The New English School Trust, Vasad',
  'NEST'
) ON CONFLICT (code) DO UPDATE
SET name_en = EXCLUDED.name_en,
    name_gu = EXCLUDED.name_gu;

-- 2. Create Initial Target Event: NEST 2026
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

-- 3. Create Default Card Types / Categories (Pure English labels)
INSERT INTO card_types (id, event_id, code, name_en, name_gu, is_registered, requires_approval)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'REG_PARTICIPANT', 'Registered Participant', 'Registered Participant', true, true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', 'GUEST', 'Guest', 'Guest', false, true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000010', 'VIP', 'Special Guest / VIP', 'Special Guest / VIP', false, true),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000010', 'SECURITY', 'Security Personnel', 'Security Personnel', false, true),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000010', 'VOLUNTEER', 'Volunteer', 'Volunteer', false, true),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000010', 'STAFF', 'Staff / Committee', 'Staff / Committee', false, true),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000010', 'MEDIA', 'Media / Press', 'Media / Press', false, true)
ON CONFLICT (event_id, code) DO UPDATE
SET name_en = EXCLUDED.name_en,
    name_gu = EXCLUDED.name_gu;

-- 4. Create Card Themes with Dynamic Category & Gender Rules
INSERT INTO card_themes (event_id, card_type_id, gender_rule, primary_color, header_color, footer_color, accent_color, text_color)
VALUES
  -- Registered Participant - Male (Blue)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'MALE', '#1E40AF', '#1E3A8A', '#1E3A8A', '#F59E0B', '#FFFFFF'),
  -- Registered Participant - Female (Pink/Ruby Rose)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'FEMALE', '#BE185D', '#831843', '#831843', '#FDE047', '#FFFFFF'),
  -- Registered Participant - Default (if gender unassigned)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', NULL, '#1E40AF', '#1E3A8A', '#1E3A8A', '#F59E0B', '#FFFFFF'),
  -- Guest (Green)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000002', NULL, '#047857', '#064E3B', '#064E3B', '#6EE7B7', '#FFFFFF'),
  -- VIP (Gold)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000003', NULL, '#B45309', '#78350F', '#78350F', '#FBBF24', '#FFFFFF'),
  -- Security (Red)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000004', NULL, '#B91C1C', '#7F1D1D', '#7F1D1D', '#FCA5A5', '#FFFFFF'),
  -- Volunteer (Orange)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000005', NULL, '#C2410C', '#7C2D12', '#7C2D12', '#FDBA74', '#FFFFFF'),
  -- Staff (Teal)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000006', NULL, '#0F766E', '#134E4A', '#134E4A', '#5EEAD4', '#FFFFFF'),
  -- Media (Slate Gray)
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000007', NULL, '#374151', '#1F2937', '#1F2937', '#9CA3AF', '#FFFFFF')
ON CONFLICT (event_id, card_type_id, gender_rule) DO UPDATE
SET primary_color = EXCLUDED.primary_color,
    header_color = EXCLUDED.header_color,
    footer_color = EXCLUDED.footer_color,
    accent_color = EXCLUDED.accent_color,
    text_color = EXCLUDED.text_color;

-- 5. Seed Test Auth Users (7 System Roles with Test Names Only)
-- Password for all test accounts: TestUser@2026
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
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  -- auth.users
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

  -- auth.identities
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

  -- user_profiles
  INSERT INTO public.user_profiles (id, full_name_en, full_name_gu, mobile, is_active)
  VALUES (p_user_id, p_full_name, p_full_name, p_mobile, true)
  ON CONFLICT (id) DO UPDATE
  SET full_name_en = EXCLUDED.full_name_en,
      full_name_gu = EXCLUDED.full_name_gu,
      mobile = EXCLUDED.mobile;

  -- user_roles
  SELECT id INTO v_role_id FROM roles WHERE code = p_role_code;
  IF v_role_id IS NOT NULL THEN
    DELETE FROM user_roles WHERE user_id = p_user_id;
    INSERT INTO user_roles (user_id, role_id, event_id)
    VALUES (p_user_id, v_role_id, '00000000-0000-0000-0000-000000000010');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT seed_test_user('8d24a3f2-3fb5-4c0c-a78a-ee3e08c2b5ae', 'superadmin@test.com', 'Test Super Admin',          '9000000001', 'SUPER_ADMIN');
SELECT seed_test_user('46510e45-d2fe-4819-b0b1-29af43e9c6bc', 'admin@test.com',      'Test Event Admin',          '9000000002', 'EVENT_ADMIN');
SELECT seed_test_user('f544de16-7c3a-4cc4-9aca-727d3f4a4e1b', 'verifier@test.com',   'Test Verifier',             '9000000003', 'VERIFIER');
SELECT seed_test_user('d8ae6a0a-798c-48cb-bc46-6ee8329d40c2', 'deo@test.com',        'Test Data Entry Operator',  '9000000004', 'DATA_ENTRY_OPERATOR');
SELECT seed_test_user('6ad85ed9-0553-4d80-80b6-dd1c8859c914', 'specialid@test.com',  'Test Special ID Operator',  '9000000005', 'SPECIAL_ID_OPERATOR');
SELECT seed_test_user('031d3933-4e15-4f74-a4c3-a6c6299b58d7', 'printer@test.com',    'Test Printer Operator',     '9000000006', 'PRINTER_OPERATOR');
SELECT seed_test_user('19dd098c-f496-4841-83b9-3727467b2c38', 'security@test.com',   'Test Security Officer',     '9000000007', 'SECURITY');

DROP FUNCTION IF EXISTS seed_test_user;
