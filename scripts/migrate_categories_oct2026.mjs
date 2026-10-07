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
  console.log('--- Migrating Card Categories and Themes ---');

  // 1. Replace CREW with STAFF in card_types
  console.log('1. Updating CREW -> STAFF in card_types...');
  const { data: crewType } = await supabase
    .from('card_types')
    .select('id')
    .eq('code', 'CREW')
    .maybeSingle();

  const staffTypeId = crewType?.id || '10000000-0000-0000-0000-000000000021';
  const { error: staffErr } = await supabase
    .from('card_types')
    .upsert({
      id: staffTypeId,
      event_id: DEFAULT_EVENT_ID,
      code: 'STAFF',
      name_en: 'Staff',
      name_gu: 'સ્ટાફ',
      is_registered: true,
      requires_approval: true,
    }, { onConflict: 'id' });

  if (staffErr) console.error('Staff upsert error:', staffErr.message);
  else console.log('Successfully set STAFF category (ID:', staffTypeId, ')');

  // 2. Add or update TRUSTEE
  console.log('2. Inserting/updating TRUSTEE in card_types...');
  const trusteeTypeId = '10000000-0000-0000-0000-000000000022';
  const { error: trusteeErr } = await supabase
    .from('card_types')
    .upsert({
      id: trusteeTypeId,
      event_id: DEFAULT_EVENT_ID,
      code: 'TRUSTEE',
      name_en: 'Trustee',
      name_gu: 'ટ્રસ્ટી',
      is_registered: true,
      requires_approval: true,
    }, { onConflict: 'id' });

  if (trusteeErr) console.error('Trustee upsert error:', trusteeErr.message);
  else console.log('Successfully set TRUSTEE category (ID:', trusteeTypeId, ')');

  // 3. Add or update GUEST
  console.log('3. Inserting/updating GUEST in card_types...');
  const guestTypeId = '10000000-0000-0000-0000-000000000023';
  const { error: guestErr } = await supabase
    .from('card_types')
    .upsert({
      id: guestTypeId,
      event_id: DEFAULT_EVENT_ID,
      code: 'GUEST',
      name_en: 'Guest',
      name_gu: 'મહેમાન',
      is_registered: false,
      requires_approval: true,
    }, { onConflict: 'id' });

  if (guestErr) console.error('Guest upsert error:', guestErr.message);
  else console.log('Successfully set GUEST category (ID:', guestTypeId, ')');

  // 4. Update / Insert Card Themes
  console.log('4. Configuring themes for STAFF, TRUSTEE, and GUEST...');

  // Staff Theme (Midnight Navy / Slate with Sky Blue accent)
  const { data: existStaffTheme } = await supabase
    .from('card_themes')
    .select('id')
    .eq('card_type_id', staffTypeId)
    .maybeSingle();

  const staffThemePayload = {
    event_id: DEFAULT_EVENT_ID,
    card_type_id: staffTypeId,
    gender_rule: null,
    primary_color: '#0F172A',
    header_color: '#1E293B',
    footer_color: '#1E293B',
    accent_color: '#38BDF8',
    text_color: '#FFFFFF',
    template_config: {},
  };

  if (existStaffTheme) {
    await supabase.from('card_themes').update(staffThemePayload).eq('id', existStaffTheme.id);
  } else {
    await supabase.from('card_themes').insert(staffThemePayload);
  }
  console.log('Staff theme configured.');

  // Trustee Theme (Royal Purple / Maroon with Gold accent)
  const { data: existTrusteeTheme } = await supabase
    .from('card_themes')
    .select('id')
    .eq('card_type_id', trusteeTypeId)
    .maybeSingle();

  const trusteeThemePayload = {
    event_id: DEFAULT_EVENT_ID,
    card_type_id: trusteeTypeId,
    gender_rule: null,
    primary_color: '#581C87',
    header_color: '#3B0764',
    footer_color: '#3B0764',
    accent_color: '#F59E0B',
    text_color: '#FFFFFF',
    template_config: {},
  };

  if (existTrusteeTheme) {
    await supabase.from('card_themes').update(trusteeThemePayload).eq('id', existTrusteeTheme.id);
  } else {
    await supabase.from('card_themes').insert(trusteeThemePayload);
  }
  console.log('Trustee theme configured.');

  // Guest Theme (Emerald Green with Amber/Gold accent)
  const { data: existGuestTheme } = await supabase
    .from('card_themes')
    .select('id')
    .eq('card_type_id', guestTypeId)
    .maybeSingle();

  const guestThemePayload = {
    event_id: DEFAULT_EVENT_ID,
    card_type_id: guestTypeId,
    gender_rule: null,
    primary_color: '#065F46',
    header_color: '#064E3B',
    footer_color: '#064E3B',
    accent_color: '#FDE047',
    text_color: '#FFFFFF',
    template_config: {},
  };

  if (existGuestTheme) {
    await supabase.from('card_themes').update(guestThemePayload).eq('id', existGuestTheme.id);
  } else {
    await supabase.from('card_themes').insert(guestThemePayload);
  }
  console.log('Guest theme configured.');

  // Verify final list
  const { data: allTypes } = await supabase.from('card_types').select('*').order('created_at', { ascending: true });
  console.log('\n--- Final Card Types in DB ---');
  allTypes?.forEach((t) => console.log(`• [${t.code}] ${t.name_en} (${t.name_gu}) - ID: ${t.id}, is_registered: ${t.is_registered}`));

  const { data: allThemes } = await supabase.from('card_themes').select('id, card_type_id, primary_color, card_types(code, name_en)');
  console.log('\n--- Final Themes in DB ---');
  allThemes?.forEach((th) => console.log(`• ${th.card_types?.name_en} (${th.card_types?.code}): primary=${th.primary_color}`));
}

main().catch(console.error);
