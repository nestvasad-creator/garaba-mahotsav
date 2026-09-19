import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const lines = fs.readFileSync('.env.local', 'utf-8').split('\n');
const env = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
}

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  console.log('Seeding initial Super Admin for NEST Vasad...');

  const email = 'admin@nestvasad.org';
  const password = 'Admin@NEST2026';

  // 1. Create user in Supabase Auth via Admin API
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'Super Administrator',
      full_name_gu: 'મુખ્ય વ્યવસ્થાપક (ટ્રસ્ટી)',
      mobile: '9876500001',
    },
  });

  if (authError) {
    console.error('Auth create error:', authError.message);
  } else {
    console.log('Created auth user:', authData.user.id, authData.user.email);
  }

  const userId = authData?.user?.id;
  if (!userId) return;

  // 2. Insert into user_profiles
  const { error: profError } = await adminClient.from('user_profiles').upsert({
    id: userId,
    full_name_en: 'Super Administrator',
    full_name_gu: 'મુખ્ય વ્યવસ્થાપક (ટ્રસ્ટી)',
    mobile: '9876500001',
    is_active: true,
  });

  if (profError) {
    console.error('Profile upsert error:', profError.message);
  } else {
    console.log('Profile upserted successfully.');
  }

  // 3. Find SUPER_ADMIN role
  const { data: roleData, error: roleError } = await adminClient
    .from('roles')
    .select('id')
    .eq('code', 'SUPER_ADMIN')
    .single();

  if (roleError || !roleData) {
    console.error('Role find error:', roleError?.message);
    return;
  }

  // 4. Assign user_roles
  const { error: urError } = await adminClient.from('user_roles').upsert({
    user_id: userId,
    role_id: roleData.id,
    event_id: '00000000-0000-0000-0000-000000000010',
  });

  if (urError) {
    console.error('User role assignment error:', urError.message);
  } else {
    console.log('User assigned SUPER_ADMIN role successfully.');
  }

  // 5. Test sign in with anon client
  console.log('\nTesting Sign In via anon client with email & password...');
  const { data: loginData, error: loginError } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });

  if (loginError) {
    console.error('Login test failed:', loginError.message);
  } else {
    console.log('Login successful! Access token obtained.');
    console.log('User ID:', loginData.user.id);
    console.log('Session expires at:', new Date(loginData.session.expires_at * 1000).toLocaleString());
  }
}

main().catch(console.error);
