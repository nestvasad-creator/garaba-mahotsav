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
  const { data: users } = await adminClient.auth.admin.listUsers();
  const op = users.users.find((u) => u.email === 'operator@nestvasad.org');
  console.log('Operator ID:', op.id);

  // 1. Promote to VERIFIER
  const { data: verifierRole } = await adminClient.from('roles').select('id').eq('code', 'VERIFIER').single();
  await adminClient.from('user_roles').delete().eq('user_id', op.id).eq('event_id', '00000000-0000-0000-0000-000000000010');
  await adminClient.from('user_roles').insert({
    user_id: op.id,
    role_id: verifierRole.id,
    event_id: '00000000-0000-0000-0000-000000000010',
  });

  const { data: check1 } = await adminClient.from('user_roles').select('*, roles(code, name)').eq('user_id', op.id);
  console.log('After promotion to VERIFIER:', check1[0].roles);

  // 2. Revert to DATA_ENTRY_OPERATOR
  const { data: deRole } = await adminClient.from('roles').select('id').eq('code', 'DATA_ENTRY_OPERATOR').single();
  await adminClient.from('user_roles').delete().eq('user_id', op.id).eq('event_id', '00000000-0000-0000-0000-000000000010');
  await adminClient.from('user_roles').insert({
    user_id: op.id,
    role_id: deRole.id,
    event_id: '00000000-0000-0000-0000-000000000010',
  });

  const { data: check2 } = await adminClient.from('user_roles').select('*, roles(code, name)').eq('user_id', op.id);
  console.log('After resetting to DATA_ENTRY_OPERATOR:', check2[0].roles);
}

main().catch(console.error);
