import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const client = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function migrateExisting() {
  const { data: unverified, error } = await client
    .from('registrations')
    .select('*')
    .in('status', ['SUBMITTED', 'UNDER_VERIFICATION']);

  if (error) {
    console.error('Error fetching unverified:', error);
    return;
  }

  console.log(`Found ${unverified?.length || 0} unverified registrations to approve.`);

  for (const reg of unverified || []) {
    const now = new Date().toISOString();
    // 1. Update registration to APPROVED
    await client
      .from('registrations')
      .update({
        status: 'APPROVED',
        verified_by: reg.created_by,
        verified_at: now,
        verification_remarks: 'Auto-verified by system default rule',
        updated_at: now,
      })
      .eq('id', reg.id);

    // 2. Update documents to VERIFIED
    await client
      .from('documents')
      .update({
        status: 'VERIFIED',
        verified_by: reg.created_by,
        verified_at: now,
      })
      .eq('registration_id', reg.id);

    // 3. Find theme
    const { data: theme } = await client
      .from('card_themes')
      .select('id')
      .eq('event_id', reg.event_id)
      .eq('card_type_id', reg.category_id)
      .eq('gender_rule', reg.gender)
      .maybeSingle();

    const { data: photoDoc } = await client
      .from('documents')
      .select('file_path')
      .eq('registration_id', reg.id)
      .eq('doc_type', 'PHOTOGRAPH')
      .maybeSingle();

    const cardNum = reg.registration_number.replace('NEST-2026-', 'NEST-CARD-');
    const qrToken = `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

    // 4. Upsert ID card
    await client.from('id_cards').upsert(
      {
        event_id: reg.event_id,
        registration_id: reg.id,
        card_type_id: reg.category_id,
        theme_id: theme?.id || '00000000-0000-0000-0000-000000000001',
        card_number: cardNum,
        qr_code_hash: qrToken,
        status: 'APPROVED',
        is_active: true,
        recipient_name_en: reg.full_name_en,
        recipient_name_gu: reg.full_name_gu || reg.full_name_en,
        recipient_mobile: reg.mobile,
        recipient_photo_path: photoDoc?.file_path || null,
        approved_by: reg.created_by,
        approved_at: now,
        metadata: {
          physical_form_number: reg.physical_form_number,
          receipt_number: reg.receipt_number || null,
          gender: reg.gender,
          dob: reg.dob,
          address: reg.address_en,
          city: reg.city,
          pincode: reg.pincode,
        },
      },
      { onConflict: 'event_id,card_number' }
    );

    console.log(`Approved & generated ID card for ${reg.registration_number} (${reg.full_name_en})`);
  }

  console.log('Migration complete!');
}

migrateExisting();
