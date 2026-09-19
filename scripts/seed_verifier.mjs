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
  console.log('Seeding Document Verifier user for NEST Vasad...');

  const email = 'verifier@nestvasad.org';
  const password = 'Verifier@NEST2026';

  let userId;
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'Vijay Parekh',
      full_name_gu: 'વિજય પારેખ (દસ્તાવેજ ચકાસણી)',
      mobile: '9876500003',
    },
  });

  if (authError) {
    console.log('Auth note:', authError.message);
    const { data: users } = await adminClient.auth.admin.listUsers();
    userId = users.users.find((u) => u.email === email)?.id;
  } else {
    userId = authData?.user?.id;
    console.log('Created verifier auth user:', userId);
  }

  if (!userId) return;

  // Profile
  await adminClient.from('user_profiles').upsert({
    id: userId,
    full_name_en: 'Vijay Parekh',
    full_name_gu: 'વિજય પારેખ (દસ્તાવેજ ચકાસણી)',
    mobile: '9876500003',
    is_active: true,
  });

  // Assign VERIFIER role
  const { data: role } = await adminClient.from('roles').select('id').eq('code', 'VERIFIER').single();
  await adminClient.from('user_roles').delete().eq('user_id', userId).eq('event_id', '00000000-0000-0000-0000-000000000010');
  await adminClient.from('user_roles').insert({
    user_id: userId,
    role_id: role.id,
    event_id: '00000000-0000-0000-0000-000000000010',
  });

  console.log('Verifier user initialized successfully with VERIFIER role.');
}

main().catch(console.error);
