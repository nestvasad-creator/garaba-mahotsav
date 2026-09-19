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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const testEmails = [
  'superadmin@test.com',
  'admin@test.com',
  'verifier@test.com',
  'deo@test.com',
  'specialid@test.com',
  'printer@test.com',
  'security@test.com',
];

async function verifyAllLogins() {
  console.log('Testing authentication for all 7 test users...\n');
  for (const email of testEmails) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: 'TestUser@2026',
    });
    if (error) {
      console.log(`❌ ${email}: ${error.message}`);
    } else {
      console.log(`✅ ${email}: Authenticated successfully! User ID: ${data.user.id}`);
      await supabase.auth.signOut();
    }
  }
}

verifyAllLogins().catch(console.error);
