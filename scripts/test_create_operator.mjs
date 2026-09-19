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

async function main() {
  console.log('Testing creating a Data Entry Operator user...');
  const email = 'operator@nestvasad.org';
  const password = 'Operator@NEST2026';

  // 1. Create in Supabase Auth
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'Bhavesh Patel',
      full_name_gu: 'ભાવેશ પટેલ',
      mobile: '9876500002',
    },
  });

  if (authErr) {
    console.log('Auth user creation note:', authErr.message);
  } else {
    console.log('Created user:', authData.user.id, authData.user.email);
    // 2. Profile
    await adminClient.from('user_profiles').upsert({
      id: authData.user.id,
      full_name_en: 'Bhavesh Patel',
      full_name_gu: 'ભાવેશ પટેલ',
      mobile: '9876500002',
      is_active: true,
    });

    // 3. Role
    const { data: role } = await adminClient.from('roles').select('id').eq('code', 'DATA_ENTRY_OPERATOR').single();
    await adminClient.from('user_roles').upsert({
      user_id: authData.user.id,
      role_id: role.id,
      event_id: '00000000-0000-0000-0000-000000000010',
    });
    console.log('Assigned DATA_ENTRY_OPERATOR role successfully.');
  }

  // 4. Test listAllUsers logic
  const { data: authUsers } = await adminClient.auth.admin.listUsers();
  const { data: profiles } = await adminClient.from('user_profiles').select('*');
  const { data: userRoles } = await adminClient.from('user_roles').select('user_id, roles(code, name)');

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  const roleMap = new Map((userRoles || []).map((ur) => [ur.user_id, ur.roles]));

  const mapped = authUsers.users.map((u) => {
    const prof = profileMap.get(u.id);
    const r = roleMap.get(u.id);
    return {
      email: u.email,
      fullNameEn: prof?.full_name_en,
      fullNameGu: prof?.full_name_gu,
      roleCode: r?.code,
      roleName: r?.name,
    };
  });

  console.log('\n--- listAllUsers Results ---');
  console.log(JSON.stringify(mapped, null, 2));
}

main().catch(console.error);

