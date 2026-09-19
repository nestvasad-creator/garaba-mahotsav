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

async function testActions() {
  const { data: sponsorCat } = await supabase
    .from('card_types')
    .select('id, code')
    .eq('code', 'SPONSOR')
    .single();

  const { data: crewCat } = await supabase
    .from('card_types')
    .select('id, code')
    .eq('code', 'CREW')
    .single();

  const randomDigits = Math.floor(100000 + Math.random() * 900000);

  // Testing Sponsor insertion with receipt_number: ''
  const sponsorPayload = {
    event_id: DEFAULT_EVENT_ID,
    category_id: sponsorCat.id,
    registration_number: `NEST-2026-${randomDigits}`,
    physical_form_number: `SPON-${randomDigits}`,
    receipt_number: '',
    full_name_en: 'RELIANCE (SPONSOR TEST)',
    full_name_gu: 'RELIANCE (SPONSOR TEST)',
    mobile: '9898989898',
    gender: 'MALE',
    address_en: 'Sponsor Desk',
    address_gu: 'Sponsor Desk',
    status: 'APPROVED',
  };

  const { data: s, error: sErr } = await supabase.from('registrations').insert(sponsorPayload).select().single();
  if (sErr) {
    console.error('Sponsor error:', sErr.message);
  } else {
    console.log('SUCCESS: Sponsor registered successfully! ID:', s.id, 'Form #:', s.physical_form_number);
    await supabase.from('registrations').delete().eq('id', s.id);
  }

  // Testing Crew insertion with receipt_number: ''
  const crewDigits = Math.floor(100000 + Math.random() * 900000);
  const crewPayload = {
    event_id: DEFAULT_EVENT_ID,
    category_id: crewCat.id,
    registration_number: `NEST-2026-${crewDigits}`,
    physical_form_number: `CREW-${crewDigits}`,
    receipt_number: '',
    full_name_en: 'SANJAY PATEL (CREW TEST)',
    full_name_gu: 'SANJAY PATEL (CREW TEST)',
    mobile: '9797979797',
    gender: 'MALE',
    address_en: 'Crew Area',
    address_gu: 'Crew Area',
    status: 'APPROVED',
  };

  const { data: c, error: cErr } = await supabase.from('registrations').insert(crewPayload).select().single();
  if (cErr) {
    console.error('Crew error:', cErr.message);
  } else {
    console.log('SUCCESS: Crew registered successfully! ID:', c.id, 'Form #:', c.physical_form_number);
    await supabase.from('registrations').delete().eq('id', c.id);
  }
}

testActions().catch(console.error);
