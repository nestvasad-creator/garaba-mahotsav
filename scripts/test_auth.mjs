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

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Testing connection to:', env.NEXT_PUBLIC_SUPABASE_URL);

  const { data: users, error: uErr } = await client.auth.admin.listUsers();
  console.log('Auth Users Count:', users?.users?.length, 'Error:', uErr?.message);
  if (users?.users && users.users.length > 0) {
    for (const u of users.users) {
      console.log(' - User:', u.email, 'ID:', u.id);
    }
  }

  const { data: roles, error: rErr } = await client.from('roles').select('id, code, name');
  console.log('Roles Count:', roles?.length, 'Error:', rErr?.message);
  if (roles) {
    for (const r of roles) {
      console.log(' - Role:', r.code, `(${r.name})`);
    }
  }

  const { data: profiles } = await client.from('user_profiles').select('*');
  console.log('User Profiles Count:', profiles?.length);

  const { data: events, error: eErr } = await client.from('events').select('id, code, name_en');
  console.log('Events in DB:', events, 'Error:', eErr?.message);
}

run().catch(console.error);
