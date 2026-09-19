-- ==============================================================================
-- STANDALONE SEED SCRIPT FOR 7 TEST AUTH USERS & RBAC ROLES
-- ==============================================================================
-- Shared Password for all accounts: TestUser@2026
-- ==============================================================================

SET search_path = public, extensions;

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
  -- 1. Generate standard bcrypt hash
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- 2. Upsert into Supabase auth.users
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

  -- 3. Safely Upsert into auth.identities
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

  -- 4. Upsert into public.user_profiles
  INSERT INTO public.user_profiles (id, full_name_en, full_name_gu, mobile, is_active)
  VALUES (p_user_id, p_full_name, p_full_name, p_mobile, true)
  ON CONFLICT (id) DO UPDATE
  SET full_name_en = EXCLUDED.full_name_en,
      full_name_gu = EXCLUDED.full_name_gu,
      mobile = EXCLUDED.mobile,
      is_active = true;

  -- 5. Assign Role in public.user_roles for default event
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
