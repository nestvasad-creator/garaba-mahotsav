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
const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000010';

async function verify() {
  console.log('--- 1. Verifying card_types table ---');
  const { data: types, error: ctErr } = await supabase
    .from('card_types')
    .select('id, code, name_en, name_gu')
    .order('created_at', { ascending: true });

  if (ctErr) throw ctErr;
  console.log('Active Card Types:', types.map(t => `${t.code} (${t.name_en})`));

  const removedCodes = ['GUEST', 'VIP', 'STAFF', 'MEDIA'];
  const hasRemoved = types.some(t => removedCodes.includes(t.code));
  if (hasRemoved) {
    console.error('FAIL: Found removed categories in card_types!');
  } else {
    console.log('SUCCESS: GUEST, VIP, STAFF, MEDIA are completely absent.');
  }

  const hasSponsor = types.some(t => t.code === 'SPONSOR');
  const hasCrew = types.some(t => t.code === 'CREW');
  if (hasSponsor && hasCrew) {
    console.log('SUCCESS: Both SPONSOR and CREW are present in card_types.');
  } else {
    console.error('FAIL: SPONSOR or CREW missing from card_types!');
  }

  console.log('\n--- 2. Verifying card_themes table ---');
  const { data: themes, error: thErr } = await supabase
    .from('card_themes')
    .select('id, card_type_id, primary_color, header_color, card_types(code, name_en)');

  if (thErr) throw thErr;
  console.log('Configured themes count:', themes.length);
  const sponsorTheme = themes.find(t => t.card_types?.code === 'SPONSOR');
  const crewTheme = themes.find(t => t.card_types?.code === 'CREW');
  console.log('Sponsor theme:', sponsorTheme?.primary_color);
  console.log('Crew theme:', crewTheme?.primary_color);

  console.log('\n--- 3. Testing HTTP routes on dev server (port 5500) ---');
  const routes = ['/card-designer', '/registrations/new', '/print-queue', '/special-cards'];
  for (const r of routes) {
    try {
      const res = await fetch(`http://localhost:5500${r}`);
      console.log(`Route ${r}: Status ${res.status}`);
    } catch (err) {
      console.error(`Route ${r} fetch error:`, err.message);
    }
  }

  console.log('\n--- VERIFICATION COMPLETED ---');
}

verify().catch(console.error);
