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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: cards } = await supabase.from('id_cards').select('id, card_number, card_type_id');
  console.log('ID Cards count:', cards?.length);
  if (cards && cards.length > 0) {
    console.log('Card types in id_cards:', cards.map(c => c.card_type_id));
  }
}

main().catch(console.error);
