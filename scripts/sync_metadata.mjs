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

async function syncMetadata() {
  const { data: users } = await adminClient.auth.admin.listUsers();
  for (const u of users.users) {
    let role = 'DATA_ENTRY_OPERATOR';
    if (u.email === 'admin@nestvasad.org') role = 'SUPER_ADMIN';
    if (u.email === 'verifier@nestvasad.org') role = 'VERIFIER';
    if (u.email === 'operator@nestvasad.org') role = 'DATA_ENTRY_OPERATOR';
    await adminClient.auth.admin.updateUserById(u.id, { user_metadata: { ...u.user_metadata, role } });
    console.log('Synced:', u.email, '->', role);
  }
}
syncMetadata().catch(console.error);
