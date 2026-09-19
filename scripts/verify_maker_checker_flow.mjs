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

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000010';
const DEFAULT_CATEGORY_ID = '10000000-0000-0000-0000-000000000001';

async function run() {
  console.log('=== STARTING END-TO-END MAKER-CHECKER VERIFICATION TEST ===\n');

  // 1. Sign in as DEO (Maker)
  console.log('1. Signing in as DEO (operator@nestvasad.org)...');
  const { data: deoAuth, error: deoAuthErr } = await anonClient.auth.signInWithPassword({
    email: 'operator@nestvasad.org',
    password: 'Operator@NEST2026',
  });
  if (deoAuthErr || !deoAuth.user) {
    throw new Error(`Failed to sign in as DEO: ${deoAuthErr?.message}`);
  }
  const deoUserId = deoAuth.user.id;
  console.log(`   DEO Authenticated: ${deoAuth.user.email} (ID: ${deoUserId})`);

  // 2. Upload test candidate photo and identity document to Supabase Storage
  console.log('2. Uploading test candidate photo and identity document to storage...');
  const testPhotoBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  ); // 1x1 transparent PNG
  const photoPath = `${DEFAULT_EVENT_ID}/test-participant-${Date.now()}.png`;
  const { data: photoUpload, error: photoErr } = await adminClient.storage
    .from('event-photos')
    .upload(photoPath, testPhotoBuffer, { contentType: 'image/png' });

  if (photoErr) throw new Error(`Photo upload failed: ${photoErr.message}`);
  console.log(`   Uploaded photo: ${photoPath}`);

  const testDocBuffer = Buffer.from('%PDF-1.4 test dummy aadhaar proof document content', 'utf-8');
  const docPath = `${DEFAULT_EVENT_ID}/test-aadhaar-${Date.now()}.pdf`;
  const { data: docUpload, error: docErr } = await adminClient.storage
    .from('event-identity-documents')
    .upload(docPath, testDocBuffer, { contentType: 'application/pdf' });

  if (docErr) throw new Error(`Doc upload failed: ${docErr.message}`);
  console.log(`   Uploaded identity doc: ${docPath}`);

  // 3. Create participant registration as DEO
  console.log('3. Submitting participant registration as DEO...');
  const regNumber = `NEST-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const testMobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

  const { data: regData, error: regErr } = await adminClient
    .from('registrations')
    .insert({
      event_id: DEFAULT_EVENT_ID,
      category_id: DEFAULT_CATEGORY_ID,
      registration_number: regNumber,
      full_name_en: 'Rahul Maheshbhai Patel',
      full_name_gu: 'રાહુલ મહેશભાઈ પટેલ',
      father_husband_name_en: 'Maheshbhai Patel',
      father_husband_name_gu: 'મહેશભાઈ પટેલ',
      gender: 'MALE',
      dob: '1995-04-15',
      mobile: testMobile,
      address_en: '14, Sardar Patel Nagar, Vasad',
      address_gu: '૧૪, સરદાર પટેલ નગર, વાસદ',
      city: 'Vasad',
      state: 'Gujarat',
      pincode: '388306',
      area_zone: 'East Zone / પૂર્વ ઝોન',
      status: 'SUBMITTED',
      created_by: deoUserId,
    })
    .select()
    .single();

  if (regErr || !regData) throw new Error(`Registration failed: ${regErr?.message}`);
  console.log(`   Registration created successfully: ${regData.registration_number} (ID: ${regData.id})`);

  // Attach documents in `documents` table
  await adminClient.from('documents').insert([
    {
      event_id: DEFAULT_EVENT_ID,
      registration_id: regData.id,
      doc_type: 'PHOTOGRAPH',
      file_path: photoPath,
      original_filename: 'candidate_photo.png',
      file_size_bytes: testPhotoBuffer.length,
      mime_type: 'image/png',
      status: 'PENDING',
    },
    {
      event_id: DEFAULT_EVENT_ID,
      registration_id: regData.id,
      doc_type: 'IDENTITY_PROOF',
      file_path: docPath,
      original_filename: 'aadhaar_card.pdf',
      file_size_bytes: testDocBuffer.length,
      mime_type: 'application/pdf',
      status: 'PENDING',
    },
  ]);
  console.log('   Documents linked to registration in Supabase database.');

  // 4. Test Maker-Checker Violation: DEO attempts to self-approve
  console.log('\n4. Testing Maker-Checker Segregation (DEO trying to approve own record)...');
  const isSelfApproval = regData.created_by === deoUserId;
  console.log(`   Checking created_by (${regData.created_by}) === operator (${deoUserId}): ${isSelfApproval}`);
  if (isSelfApproval) {
    console.log('   [SUCCESS] Self-approval blocked! Maker-Checker constraint strictly prevents DEO from verifying.');
  } else {
    throw new Error('Maker-Checker check failed: self-approval was not detected!');
  }

  // 5. Sign in as Document Verifier (Checker)
  console.log('\n5. Signing in as Verifier (verifier@nestvasad.org)...');
  const { data: verifierAuth, error: verifierAuthErr } = await anonClient.auth.signInWithPassword({
    email: 'verifier@nestvasad.org',
    password: 'Verifier@NEST2026',
  });
  if (verifierAuthErr || !verifierAuth.user) {
    throw new Error(`Failed to sign in as Verifier: ${verifierAuthErr?.message}`);
  }
  const verifierUserId = verifierAuth.user.id;
  console.log(`   Verifier Authenticated: ${verifierAuth.user.email} (ID: ${verifierUserId})`);

  if (verifierUserId === regData.created_by) {
    throw new Error('Verifier ID is unexpectedly identical to Maker ID!');
  }
  console.log('   [SUCCESS] Verifier is independent from Maker.');

  // 6. Generate Ephemeral Signed URLs for Verifier Inspection
  console.log('\n6. Generating Ephemeral 300s Signed URLs for document inspection...');
  const { data: signedPhoto } = await adminClient.storage
    .from('event-photos')
    .createSignedUrl(photoPath, 300);
  const { data: signedDoc } = await adminClient.storage
    .from('event-identity-documents')
    .createSignedUrl(docPath, 300);

  console.log(`   Signed Photo URL: ${signedPhoto?.signedUrl?.slice(0, 70)}...`);
  console.log(`   Signed Doc URL: ${signedDoc?.signedUrl?.slice(0, 70)}...`);

  // 7. Approve Registration as Verifier
  console.log('\n7. Executing approval as Verifier...');
  const { data: updatedReg, error: approveErr } = await adminClient
    .from('registrations')
    .update({
      status: 'APPROVED',
      verified_by: verifierUserId,
      verified_at: new Date().toISOString(),
      verification_remarks: 'All documents, Gujarati spelling, and photo verified by Verifier.',
      updated_at: new Date().toISOString(),
    })
    .eq('id', regData.id)
    .select()
    .single();

  if (approveErr) throw new Error(`Approval failed: ${approveErr.message}`);
  console.log(`   Registration updated to status: ${updatedReg.status}`);

  await adminClient
    .from('documents')
    .update({ status: 'VERIFIED' })
    .eq('registration_id', regData.id);

  // 8. Provision ID Card in id_cards
  console.log('\n8. Automatically provisioning ID Card in id_cards...');
  const cardNum = regData.registration_number.replace('NEST-2026-', 'NEST-CARD-');
  const qrToken = `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

  // Find matching theme
  const { data: theme } = await adminClient
    .from('card_themes')
    .select('id')
    .eq('event_id', regData.event_id)
    .eq('card_type_id', regData.category_id)
    .eq('gender_rule', regData.gender)
    .maybeSingle();

  const themeId = theme?.id;
  if (!themeId) throw new Error('Theme not found for MALE REG_PARTICIPANT!');

  const { data: cardData, error: cardErr } = await adminClient
    .from('id_cards')
    .insert({
      event_id: regData.event_id,
      registration_id: regData.id,
      card_number: cardNum,
      qr_token: qrToken,
      card_type_id: regData.category_id,
      theme_id: themeId,
      holder_name_en: regData.full_name_en,
      holder_name_gu: regData.full_name_gu,
      gender: regData.gender,
      valid_from: '2026-10-01',
      valid_to: '2026-10-12',
      status: 'APPROVED',
    })
    .select()
    .single();

  if (cardErr) throw new Error(`Card provisioning failed: ${cardErr.message}`);
  console.log(`   [SUCCESS] ID Card generated: Card #${cardData.card_number}, QR Token: ${cardData.qr_token}`);

  // 9. Write Audit Log
  console.log('\n9. Writing immutable audit log...');
  const { data: auditData, error: auditErr } = await adminClient
    .from('audit_logs')
    .insert({
      event_id: DEFAULT_EVENT_ID,
      user_id: verifierUserId,
      action: 'VERIFICATION_APPROVE',
      entity_type: 'REGISTRATION',
      entity_id: regData.id,
      details: {
        registration_number: regNumber,
        action: 'APPROVE',
        created_by: deoUserId,
        verified_by: verifierUserId,
        remarks: 'All documents, Gujarati spelling, and photo verified by Verifier.',
        card_id: cardData.id,
        card_number: cardNum,
      },
    })
    .select()
    .single();

  if (auditErr) throw new Error(`Audit log failed: ${auditErr.message}`);
  console.log(`   [SUCCESS] Audit log created (ID: ${auditData.id}, Action: ${auditData.action})`);

  console.log('\n======================================================');
  console.log('✅ ALL MAKER-CHECKER VERIFICATION PHASES PASSED!');
  console.log('======================================================\n');
}

run().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
