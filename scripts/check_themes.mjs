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
  const { data: themes, error: tErr } = await adminClient.from('card_themes').select('*');
  console.log('Themes count:', themes?.length, 'Err:', tErr?.message);
  console.log('Themes:', JSON.stringify(themes, null, 2));

  const { data: cardTypes, error: ctErr } = await adminClient.from('card_types').select('*');
  console.log('Card Types count:', cardTypes?.length, 'Err:', ctErr?.message);
  console.log('Card Types:', JSON.stringify(cardTypes, null, 2));
}
check();
