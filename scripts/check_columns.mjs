import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const lines = fs.readFileSync('.env.local', 'utf-8').split('\n');
const env = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}
const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
async function check() {
  const { data: cards } = await adminClient.from('id_cards').select('*').limit(1);
  console.log('Sample id_card keys:', cards && cards[0] ? Object.keys(cards[0]) : 'no records');
  
  const { data: jobs } = await adminClient.from('print_jobs').select('*').limit(1);
  console.log('Sample print_jobs keys:', jobs && jobs[0] ? Object.keys(jobs[0]) : 'no records');
}
check();
