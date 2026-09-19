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

async function main() {
  console.log('1. Checking existing card types to remove: GUEST, VIP, STAFF, MEDIA...');
  const codesToRemove = ['GUEST', 'VIP', 'STAFF', 'MEDIA'];

  // Fetch their IDs
  const { data: toRemove, error: fetchErr } = await supabase
    .from('card_types')
    .select('id, code')
    .in('code', codesToRemove);

  if (toRemove && toRemove.length > 0) {
    const idsToRemove = toRemove.map(r => r.id);
    console.log(`Found ${idsToRemove.length} card types to remove:`, toRemove.map(r => r.code));

    // Remove themes first
    const { error: delThemeErr } = await supabase
      .from('card_themes')
      .delete()
      .in('card_type_id', idsToRemove);
    if (delThemeErr) console.warn('Theme delete warning:', delThemeErr.message);

    // Remove card types
    const { error: delCtErr } = await supabase
      .from('card_types')
      .delete()
      .in('id', idsToRemove);
    if (delCtErr) console.error('Card type delete error:', delCtErr.message);
    else console.log('Successfully removed card types and themes for:', codesToRemove.join(', '));
  } else {
    console.log('No card types found matching codes to remove.');
  }

  // 2. Introduce new categories: SPONSOR and CREW
  console.log('2. Inserting/updating new card types: SPONSOR and CREW...');
  const newCardTypes = [
    {
      id: '10000000-0000-0000-0000-000000000020',
      event_id: DEFAULT_EVENT_ID,
      code: 'SPONSOR',
      name_en: 'Sponsor',
      name_gu: 'સ્પોન્સર',
      is_registered: true,
      requires_approval: true,
    },
    {
      id: '10000000-0000-0000-0000-000000000021',
      event_id: DEFAULT_EVENT_ID,
      code: 'CREW',
      name_en: 'Crew',
      name_gu: 'ક્રૂ',
      is_registered: true,
      requires_approval: true,
    },
  ];

  for (const ct of newCardTypes) {
    const { error: upsertErr } = await supabase
      .from('card_types')
      .upsert(ct, { onConflict: 'event_id, code' });
    if (upsertErr) console.error(`Failed to upsert card type ${ct.code}:`, upsertErr.message);
    else console.log(`Card type ${ct.code} upserted successfully.`);
  }

  // 3. Create default card themes for SPONSOR and CREW
  console.log('3. Inserting/updating card themes for SPONSOR and CREW...');
  const newThemes = [
    {
      event_id: DEFAULT_EVENT_ID,
      card_type_id: '10000000-0000-0000-0000-000000000020', // SPONSOR
      gender_rule: null,
      primary_color: '#701A75', // Royal Fuchsia / Deep Wine
      header_color: '#581C87',
      footer_color: '#581C87',
      accent_color: '#F59E0B',
      text_color: '#FFFFFF',
    },
    {
      event_id: DEFAULT_EVENT_ID,
      card_type_id: '10000000-0000-0000-0000-000000000021', // CREW
      gender_rule: null,
      primary_color: '#0F172A', // Midnight Slate
      header_color: '#1E293B',
      footer_color: '#1E293B',
      accent_color: '#38BDF8',
      text_color: '#FFFFFF',
    },
  ];

  for (const th of newThemes) {
    // Check if theme already exists
    const { data: existing } = await supabase
      .from('card_themes')
      .select('id')
      .eq('event_id', th.event_id)
      .eq('card_type_id', th.card_type_id)
      .maybeSingle();

    if (existing) {
      console.log(`Theme for card_type_id ${th.card_type_id} already exists.`);
    } else {
      const { error: insErr } = await supabase.from('card_themes').insert(th);
      if (insErr) console.error(`Failed to insert theme for ${th.card_type_id}:`, insErr.message);
      else console.log(`Theme for card_type_id ${th.card_type_id} created successfully.`);
    }
  }

  // 4. Verify updated card_types
  const { data: finalTypes } = await supabase.from('card_types').select('id, code, name_en');
  console.log('Final Card Types in DB:', finalTypes);
}

main().catch(console.error);
