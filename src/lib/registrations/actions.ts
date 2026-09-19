'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Registration, RegistrationStatus, DuplicateCheckResult, CardType } from '@/types';
import { getCurrentUserSession } from '@/lib/auth/actions';

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000010';
const DEFAULT_CATEGORY_ID = '10000000-0000-0000-0000-000000000001';

/**
 * Fetches all available card types / categories for an event.
 */
export async function getCardTypes(eventId: string = DEFAULT_EVENT_ID): Promise<CardType[]> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('card_types')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Fetch card_types error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Checks for existing duplicate registrations by mobile within the event.
 */
export async function checkDuplicateRegistration(
  mobileOrEventId: string,
  maybeMobile?: string,
  fullNameEn?: string
): Promise<DuplicateCheckResult> {
  let eventId = DEFAULT_EVENT_ID;
  let mobile = '';

  if (maybeMobile) {
    eventId = mobileOrEventId;
    mobile = maybeMobile;
  } else {
    mobile = mobileOrEventId;
  }

  if (!mobile || mobile.length < 10) {
    return { isDuplicate: false };
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('registrations')
    .select('registration_number, full_name_en, full_name_gu, mobile, status')
    .eq('event_id', eventId)
    .eq('mobile', mobile)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Duplicate check error:', error.message);
    return { isDuplicate: false };
  }

  if (data) {
    return {
      isDuplicate: true,
      message: `Possible duplicate record found for mobile ${mobile}`,
      matchedRecord: {
        registrationNumber: data.registration_number,
        fullNameEn: data.full_name_en,
        fullNameGu: data.full_name_gu,
        mobile: data.mobile,
        status: data.status,
      },
    };
  }

  return { isDuplicate: false, matchedRecord: null };
}

/**
 * Real-time check if a Physical Form Serial Number or Receipt Number is already assigned.
 */
export async function checkUniqueField(params: {
  eventId?: string;
  field: 'physical_form_number' | 'receipt_number';
  value: string;
  excludeId?: string;
}): Promise<{ isUnique: boolean; conflictingRegNo?: string; conflictingName?: string }> {
  try {
    const adminClient = createAdminClient();
    const eventId = params.eventId || DEFAULT_EVENT_ID;
    const trimmedVal = params.value.trim();
    if (!trimmedVal) return { isUnique: true };

    let query = adminClient
      .from('registrations')
      .select('id, registration_number, full_name_en')
      .eq('event_id', eventId)
      .eq(params.field, trimmedVal);

    if (params.excludeId) {
      query = query.neq('id', params.excludeId);
    }

    const { data, error } = await query.maybeSingle();
    if (error && error.code !== 'PGRST116') {
      console.error(`Check unique ${params.field} error:`, error.message);
      return { isUnique: true };
    }

    if (data) {
      return {
        isUnique: false,
        conflictingRegNo: data.registration_number,
        conflictingName: data.full_name_en,
      };
    }

    return { isUnique: true };
  } catch (err) {
    console.error('checkUniqueField exception:', err);
    return { isUnique: true };
  }
}

/**
 * Fetches registrations from Supabase.
 */
export async function getRegistrations(eventId: string = DEFAULT_EVENT_ID) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('registrations')
    .select('*, card_types(*)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch registrations error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Creates a new participant registration in Supabase with optional photo & proof uploads.
 */
export async function createRegistration(
  formData: Partial<Registration> & {
    photoBase64?: string;
    photoMime?: string;
    proofBase64?: string;
    proofMime?: string;
    proofFileName?: string;
    formBase64?: string;
    formMime?: string;
    formFileName?: string;
  }
) {
  const adminClient = createAdminClient();
  const session = await getCurrentUserSession();

  // Validate session user against user_profiles
  let creatorId = session?.id || null;
  if (creatorId) {
    const { data: prof } = await adminClient
      .from('user_profiles')
      .select('id')
      .eq('id', creatorId)
      .maybeSingle();
    if (!prof) creatorId = null;
  }

  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  const regNumber =
    formData.registration_number ||
    `NEST-2026-${randomDigits}`;

  if (!formData.full_name_en || !formData.full_name_en.trim()) {
    return {
      success: false,
      error: 'Full Name is mandatory.',
    };
  }

  if (!formData.mobile || !formData.mobile.trim()) {
    return {
      success: false,
      error: 'Mobile number is mandatory.',
    };
  }

  // Resolve category_id safely
  let targetCategoryId = formData.category_id || DEFAULT_CATEGORY_ID;
  const { data: catCheck } = await adminClient
    .from('card_types')
    .select('id, code, name_en')
    .eq('id', targetCategoryId)
    .maybeSingle();

  let resolvedCat = catCheck;
  if (!resolvedCat) {
    const { data: firstCat } = await adminClient
      .from('card_types')
      .select('id, code, name_en')
      .eq('event_id', formData.event_id || DEFAULT_EVENT_ID)
      .limit(1)
      .maybeSingle();
    if (firstCat) {
      targetCategoryId = firstCat.id;
      resolvedCat = firstCat;
    }
  }

  const isSponsor = resolvedCat?.code === 'SPONSOR' || resolvedCat?.name_en?.toUpperCase().includes('SPONSOR');
  const formNo = formData.physical_form_number || (formData as any).formSerialNo || null;

  if (!isSponsor && (!formNo || !formNo.trim())) {
    return {
      success: false,
      error: 'Physical Paper Form Serial Number is mandatory.',
    };
  }

  const resolvedFormNo = formNo?.trim() || (isSponsor ? `SPON-${randomDigits}` : '');

  // Proactive Uniqueness check for physical_form_number (only if provided or not sponsor)
  if (formNo && formNo.trim()) {
    const { data: existForm } = await adminClient
      .from('registrations')
      .select('registration_number, full_name_en')
      .eq('event_id', formData.event_id || DEFAULT_EVENT_ID)
      .eq('physical_form_number', formNo.trim())
      .maybeSingle();

    if (existForm) {
      return {
        success: false,
        error: `Physical Form Serial #${formNo.trim()} is already assigned to ${existForm.full_name_en} (${existForm.registration_number}). Form numbers must be unique.`,
      };
    }
  }

  let receiptNo = formData.receipt_number?.trim().toUpperCase() || (formData as any).receiptNo?.trim().toUpperCase() || null;
  const gender = formData.gender || 'MALE';

  // Auto-prefix receipt number: M for male and F for female
  if (receiptNo) {
    const genderPrefix = gender === 'FEMALE' ? 'F' : 'M';
    if (!receiptNo.startsWith('M') && !receiptNo.startsWith('F')) {
      receiptNo = `${genderPrefix}${receiptNo}`;
    } else if (receiptNo.startsWith('M') && gender === 'FEMALE') {
      receiptNo = `F${receiptNo.slice(1)}`;
    } else if (receiptNo.startsWith('F') && gender === 'MALE') {
      receiptNo = `M${receiptNo.slice(1)}`;
    }
  }

  const payload: Record<string, any> = {
    event_id: formData.event_id || DEFAULT_EVENT_ID,
    category_id: targetCategoryId,
    registration_number: regNumber,
    physical_form_number: resolvedFormNo,
    full_name_en: formData.full_name_en.trim(),
    full_name_gu: (formData.full_name_gu || formData.full_name_en).trim(),
    father_husband_name_en: formData.father_husband_name_en?.trim() || null,
    father_husband_name_gu: formData.father_husband_name_gu?.trim() || null,
    gender: gender,
    dob: formData.dob || null,
    mobile: formData.mobile.trim(),
    alternate_mobile: formData.alternate_mobile?.trim() || null,
    address_en: formData.address_en?.trim() || 'As per physical form / Vasad',
    address_gu: formData.address_gu?.trim() || formData.address_en?.trim() || 'As per physical form / Vasad',
    area_zone: formData.area_zone || (formNo ? `Form #${formNo.trim()}` : (isSponsor ? 'Sponsor Lounge' : (resolvedCat?.code === 'CREW' ? 'Production Crew' : 'East Zone / Vasad'))),
    city: formData.city || 'Vasad',
    state: formData.state || 'Gujarat',
    pincode: formData.pincode || '388306',
    status: formData.status || 'APPROVED',
    created_by: creatorId,
    verified_by: creatorId,
    verified_at: new Date().toISOString(),
    verification_remarks: 'Auto-verified upon enrollment',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    receipt_number: receiptNo || '',
  };

  // 1. Proactive Uniqueness check for Physical Form Serial Number (if supplied)
  if (formNo && formNo.trim()) {
    const { data: existForm } = await adminClient
      .from('registrations')
      .select('registration_number, full_name_en')
      .eq('event_id', payload.event_id)
      .eq('physical_form_number', formNo.trim())
      .maybeSingle();

    if (existForm) {
      return {
        success: false,
        error: `Physical Form Serial #${formNo.trim()} is already assigned to ${existForm.full_name_en} (${existForm.registration_number}). Physical Form Serial numbers must be unique.`,
      };
    }
  }

  // 2. Proactive Uniqueness check for Receipt Number (if entered)
  if (receiptNo) {
    const { data: existReceipt } = await adminClient
      .from('registrations')
      .select('registration_number, full_name_en')
      .eq('event_id', payload.event_id)
      .eq('receipt_number', receiptNo)
      .maybeSingle();

    if (existReceipt) {
      return {
        success: false,
        error: `Receipt #${receiptNo} is already assigned to ${existReceipt.full_name_en} (${existReceipt.registration_number}). Receipt numbers must be unique.`,
      };
    }
  }

  let { data, error } = await adminClient
    .from('registrations')
    .insert(payload)
    .select()
    .single();

  // If receipt_number column does not exist yet in DB schema cache, retry without it
  if (error && (error.message?.includes('receipt_number') || error.code === 'PGRST204')) {
    delete payload.receipt_number;
    if (receiptNo) {
      payload.area_zone = `${payload.area_zone || ''} | Receipt #${receiptNo}`;
    }
    const retryRes = await adminClient
      .from('registrations')
      .insert(payload)
      .select()
      .single();
    data = retryRes.data;
    error = retryRes.error;
  }

  if (error) {
    console.error('Insert registration error:', error.message);
    if (error.code === '23505') {
      if (error.message.includes('physical_form') || error.message.includes('uq_registrations_event_physical_form')) {
        return {
          success: false,
          error: `Physical Form Serial #${formNo.trim()} has already been registered for this event. Form numbers must be unique.`,
        };
      }
      if (error.message.includes('receipt') || error.message.includes('uq_registrations_event_receipt')) {
        return {
          success: false,
          error: `Receipt #${receiptNo} has already been registered for this event. Receipt numbers must be unique.`,
        };
      }
      if (error.message.includes('registration_number')) {
        return {
          success: false,
          error: `Registration number ${regNumber} already exists. Please retry.`,
        };
      }
    }
    return { success: false, error: error.message };
  }

  // 1. Process Photo Upload if provided
  if (formData.photoBase64) {
    try {
      const base64Data = formData.photoBase64.includes(';base64,')
        ? formData.photoBase64.split(';base64,')[1]
        : formData.photoBase64;
      const photoBuffer = Buffer.from(base64Data, 'base64');
      const photoPath = `registrations/${data.id}/photo.jpg`;
      const mime = formData.photoMime || 'image/jpeg';

      const { error: photoUpErr } = await adminClient.storage
        .from('event-photos')
        .upload(photoPath, photoBuffer, {
          contentType: mime,
          upsert: true,
        });

      if (!photoUpErr) {
        await adminClient.from('documents').insert({
          registration_id: data.id,
          event_id: payload.event_id,
          doc_type: 'PHOTOGRAPH',
          file_path: photoPath,
          original_filename: 'passport_photo.jpg',
          mime_type: mime,
          file_size_bytes: photoBuffer.length,
          status: payload.status === 'APPROVED' ? 'VERIFIED' : 'PENDING',
          verified_by: payload.status === 'APPROVED' ? creatorId : null,
          verified_at: payload.status === 'APPROVED' ? payload.verified_at : null,
          uploaded_by: creatorId,
        });
      } else {
        console.error('Photo upload error:', photoUpErr.message);
      }
    } catch (photoErr) {
      console.error('Photo processing error:', photoErr);
    }
  }

  // 2. Process Identity Proof (Aadhaar Card) Upload if provided
  if (formData.proofBase64) {
    try {
      const base64Data = formData.proofBase64.includes(';base64,')
        ? formData.proofBase64.split(';base64,')[1]
        : formData.proofBase64;
      const proofBuffer = Buffer.from(base64Data, 'base64');
      const ext = formData.proofMime?.includes('pdf') ? 'pdf' : 'png';
      const proofPath = `registrations/${data.id}/id_proof.${ext}`;
      const mime = formData.proofMime || (ext === 'pdf' ? 'application/pdf' : 'image/png');

      const { error: proofUpErr } = await adminClient.storage
        .from('event-identity-documents')
        .upload(proofPath, proofBuffer, {
          contentType: mime,
          upsert: true,
        });

      if (!proofUpErr) {
        await adminClient.from('documents').insert({
          registration_id: data.id,
          event_id: payload.event_id,
          doc_type: 'IDENTITY_PROOF',
          file_path: proofPath,
          original_filename: formData.proofFileName || `aadhaar_card.${ext}`,
          mime_type: mime,
          file_size_bytes: proofBuffer.length,
          status: payload.status === 'APPROVED' ? 'VERIFIED' : 'PENDING',
          verified_by: payload.status === 'APPROVED' ? creatorId : null,
          verified_at: payload.status === 'APPROVED' ? payload.verified_at : null,
          uploaded_by: creatorId,
        });
      } else {
        console.error('Identity proof upload error:', proofUpErr.message);
      }
    } catch (proofErr) {
      console.error('Proof processing error:', proofErr);
    }
  }

  // 3. Process Physical Filled-Up Form Upload if provided
  if (formData.formBase64) {
    try {
      const base64Data = formData.formBase64.includes(';base64,')
        ? formData.formBase64.split(';base64,')[1]
        : formData.formBase64;
      const formBuffer = Buffer.from(base64Data, 'base64');
      const ext = formData.formMime?.includes('pdf') ? 'pdf' : 'png';
      const formPath = `registrations/${data.id}/physical_form.${ext}`;
      const mime = formData.formMime || (ext === 'pdf' ? 'application/pdf' : 'image/png');

      const { error: formUpErr } = await adminClient.storage
        .from('event-identity-documents')
        .upload(formPath, formBuffer, {
          contentType: mime,
          upsert: true,
        });

      if (!formUpErr) {
        await adminClient.from('documents').insert({
          registration_id: data.id,
          event_id: payload.event_id,
          doc_type: 'APPLICATION_FORM',
          file_path: formPath,
          original_filename: formData.formFileName || `physical_form.${ext}`,
          mime_type: mime,
          file_size_bytes: formBuffer.length,
          status: payload.status === 'APPROVED' ? 'VERIFIED' : 'PENDING',
          verified_by: payload.status === 'APPROVED' ? creatorId : null,
          verified_at: payload.status === 'APPROVED' ? payload.verified_at : null,
          uploaded_by: creatorId,
        });
      } else {
        console.error('Physical form upload error:', formUpErr.message);
      }
    } catch (formErr) {
      console.error('Physical form processing error:', formErr);
    }
  }

  // 4. Insert Audit Log
  if (creatorId) {
    try {
      await adminClient.from('audit_logs').insert({
        event_id: payload.event_id,
        user_id: creatorId,
        action: 'REGISTRATION_ENROLL',
        resource_type: 'REGISTRATION',
        resource_id: data.id,
        details: {
          registration_number: data.registration_number,
          physical_form_number: data.physical_form_number,
          name_en: data.full_name_en,
          mobile: data.mobile,
          status: payload.status,
        },
      });
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }
  }

  // 5. Automatically create & sync ID Card so it is immediately queued for printing
  if (data && (payload.status === 'APPROVED' || data.status === 'APPROVED')) {
    try {
      await syncRegistrationToIdCard(adminClient, data.id, {
        ...data,
        status: 'APPROVED',
      });
    } catch (cardErr) {
      console.error('Auto card generation error:', cardErr);
    }
  }

  return { success: true, data };
}

/**
 * Updates registration status (Approve, Reject, Correction Required)
 */
export async function updateRegistrationStatus(
  registrationId: string,
  status: RegistrationStatus,
  remarks?: string
) {
  const adminClient = createAdminClient();

  const updatePayload: Record<string, any> = {
    status,
    verification_remarks: remarks || null,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await adminClient
    .from('registrations')
    .update(updatePayload)
    .eq('id', registrationId)
    .select()
    .single();

  if (error) {
    console.error('Update status error:', error.message);
    return { success: false, error: error.message };
  }

  // If approved, automatically ensure card is generated in id_cards
  if (status === 'APPROVED' && data) {
    const cardNum = data.registration_number.replace('NEST-2026-', 'NEST-CARD-');
    const qrToken = `tok_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;

    // Get theme for category and gender
    const { data: theme } = await adminClient
      .from('card_themes')
      .select('id')
      .eq('event_id', data.event_id)
      .eq('card_type_id', data.category_id)
      .eq('gender_rule', data.gender)
      .maybeSingle();

    const fallbackThemeId = theme?.id || '00000000-0000-0000-0000-000000000001';

    await adminClient.from('id_cards').upsert(
      {
        event_id: data.event_id,
        registration_id: data.id,
        card_number: cardNum,
        qr_token: qrToken,
        card_type_id: data.category_id,
        theme_id: fallbackThemeId,
        holder_name_en: data.full_name_en,
        holder_name_gu: data.full_name_gu,
        gender: data.gender,
        valid_from: '2026-10-01',
        valid_to: '2026-10-12',
        status: 'APPROVED',
      },
      { onConflict: 'qr_token' }
    );
  }

  return { success: true, data };
}

/**
 * Fetches a single registration by ID with linked documents & signed storage URLs.
 */
export async function getRegistrationById(id: string) {
  try {
    const adminClient = createAdminClient();

    const { data: reg, error: regErr } = await adminClient
      .from('registrations')
      .select('*, card_types(*), creator:user_profiles!created_by(full_name_en), verifier:user_profiles!verified_by(full_name_en)')
      .eq('id', id)
      .maybeSingle();

    if (regErr || !reg) {
      return { success: false, error: regErr?.message || 'Registration not found' };
    }

    // Fetch documents
    const { data: docs } = await adminClient
      .from('documents')
      .select('*')
      .eq('registration_id', id);

    const enrichedDocs = [];
    for (const d of docs || []) {
      let signedUrl: string | null = null;
      if (d.doc_type === 'PHOTOGRAPH') {
        const { data: s } = await adminClient.storage
          .from('event-photos')
          .createSignedUrl(d.file_path, 3600);
        signedUrl = s?.signedUrl || null;
      } else {
        const { data: s } = await adminClient.storage
          .from('event-identity-documents')
          .createSignedUrl(d.file_path, 3600);
        signedUrl = s?.signedUrl || null;
      }

      enrichedDocs.push({
        ...d,
        signedUrl,
      });
    }

    // Fetch associated ID card and theme if generated
    const { data: card } = await adminClient
      .from('id_cards')
      .select('*, card_themes(*)')
      .eq('registration_id', id)
      .maybeSingle();

    return {
      success: true,
      registration: {
        ...reg,
        id_card: card || null,
      },
      documents: enrichedDocs,
    };
  } catch (err: any) {
    console.error('getRegistrationById error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Updates an existing participant registration and optionally replaces document attachments.
 */
export async function updateRegistration(
  id: string,
  formData: {
    physical_form_number?: string;
    receipt_number?: string | null;
    full_name_en?: string;
    full_name_gu?: string;
    father_husband_name_en?: string;
    father_husband_name_gu?: string;
    gender?: 'MALE' | 'FEMALE';
    dob?: string | null;
    mobile?: string;
    alternate_mobile?: string | null;
    category_id?: string;
    address_en?: string;
    address_gu?: string;
    area_zone?: string;
    city?: string;
    state?: string;
    pincode?: string;
    photoBase64?: string;
    photoMime?: string;
    proofBase64?: string;
    proofMime?: string;
    proofFileName?: string;
    formBase64?: string;
    formMime?: string;
    formFileName?: string;
  }
) {
  try {
    const adminClient = createAdminClient();
    const session = await getCurrentUserSession();

    let updaterId = session?.id || null;
    if (updaterId) {
      const { data: prof } = await adminClient
        .from('user_profiles')
        .select('id')
        .eq('id', updaterId)
        .maybeSingle();
      if (!prof) updaterId = null;
    }

    // 1. Fetch current record
    const { data: currentReg, error: fetchErr } = await adminClient
      .from('registrations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !currentReg) {
      return { success: false, error: 'Registration record not found.' };
    }

    const formNo = formData.physical_form_number !== undefined
      ? formData.physical_form_number.trim()
      : currentReg.physical_form_number;

    if (!formNo) {
      return { success: false, error: 'Physical Paper Form Serial Number cannot be empty.' };
    }

    const updatePayload: Record<string, any> = {
      physical_form_number: formNo,
      updated_at: new Date().toISOString(),
    };

    if (formData.full_name_en !== undefined) {
      updatePayload.full_name_en = formData.full_name_en.trim();
      updatePayload.full_name_gu = (formData.full_name_gu || formData.full_name_en).trim();
    }
    if (formData.father_husband_name_en !== undefined) {
      updatePayload.father_husband_name_en = formData.father_husband_name_en?.trim() || null;
      updatePayload.father_husband_name_gu = formData.father_husband_name_gu?.trim() || null;
    }
    if (formData.gender !== undefined) {
      updatePayload.gender = formData.gender;
    }
    if (formData.dob !== undefined) {
      updatePayload.dob = formData.dob || null;
    }
    if (formData.mobile !== undefined) {
      updatePayload.mobile = formData.mobile.trim();
    }
    if (formData.alternate_mobile !== undefined) {
      updatePayload.alternate_mobile = formData.alternate_mobile?.trim() || null;
    }
    if (formData.category_id !== undefined) {
      updatePayload.category_id = formData.category_id;
    }
    if (formData.address_en !== undefined) {
      updatePayload.address_en = formData.address_en;
      updatePayload.address_gu = formData.address_gu || formData.address_en;
    }
    const targetGender = formData.gender || currentReg.gender || 'MALE';
    if (formData.receipt_number !== undefined) {
      let rNo = formData.receipt_number ? formData.receipt_number.trim().toUpperCase() : null;
      if (rNo) {
        const genderPrefix = targetGender === 'FEMALE' ? 'F' : 'M';
        if (!rNo.startsWith('M') && !rNo.startsWith('F')) {
          rNo = `${genderPrefix}${rNo}`;
        } else if (rNo.startsWith('M') && targetGender === 'FEMALE') {
          rNo = `F${rNo.slice(1)}`;
        } else if (rNo.startsWith('F') && targetGender === 'MALE') {
          rNo = `M${rNo.slice(1)}`;
        }
      }
      updatePayload.receipt_number = rNo;
    }
    if (formData.area_zone !== undefined) {
      updatePayload.area_zone = formData.area_zone;
    }
    if (formData.city !== undefined) {
      updatePayload.city = formData.city;
    }
    if (formData.state !== undefined) {
      updatePayload.state = formData.state;
    }
    if (formData.pincode !== undefined) {
      updatePayload.pincode = formData.pincode;
    }

    // Proactive Uniqueness check for physical_form_number
    const { data: existForm } = await adminClient
      .from('registrations')
      .select('registration_number, full_name_en')
      .eq('event_id', currentReg.event_id)
      .eq('physical_form_number', formNo)
      .neq('id', id)
      .maybeSingle();

    if (existForm) {
      return {
        success: false,
        error: `Physical Form Serial #${formNo} is already assigned to ${existForm.full_name_en} (${existForm.registration_number}). Form numbers must be unique.`,
      };
    }

    // Proactive Uniqueness check for receipt_number if specified
    const targetReceiptNo = updatePayload.receipt_number !== undefined
      ? updatePayload.receipt_number
      : currentReg.receipt_number;

    if (targetReceiptNo) {
      const { data: existReceipt } = await adminClient
        .from('registrations')
        .select('registration_number, full_name_en')
        .eq('event_id', currentReg.event_id)
        .eq('receipt_number', targetReceiptNo)
        .neq('id', id)
        .maybeSingle();

      if (existReceipt) {
        return {
          success: false,
          error: `Receipt #${targetReceiptNo} is already assigned to ${existReceipt.full_name_en} (${existReceipt.registration_number}). Receipt numbers must be unique.`,
        };
      }
    }

    // 2. Perform Update on registrations
    let { data: updated, error: updateErr } = await adminClient
      .from('registrations')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateErr && (updateErr.message?.includes('receipt_number') || updateErr.code === 'PGRST204')) {
      delete updatePayload.receipt_number;
      const retryUpdate = await adminClient
        .from('registrations')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      updated = retryUpdate.data;
      updateErr = retryUpdate.error;
    }

    if (updateErr) {
      console.error('Update registration error:', updateErr.message);
      if (updateErr.code === '23505') {
        if (updateErr.message.includes('physical_form') || updateErr.message.includes('uq_registrations_event_physical_form')) {
          return {
            success: false,
            error: `Physical Form Serial #${formNo} is already assigned to another participant.`,
          };
        }
        if (updateErr.message.includes('receipt') || updateErr.message.includes('uq_registrations_event_receipt')) {
          return {
            success: false,
            error: `Receipt #${targetReceiptNo} is already assigned to another participant.`,
          };
        }
      }
      return { success: false, error: updateErr.message };
    }

    // 3. Process Photo Replacement if provided
    if (formData.photoBase64) {
      try {
        const base64Data = formData.photoBase64.includes(';base64,')
          ? formData.photoBase64.split(';base64,')[1]
          : formData.photoBase64;
        const photoBuffer = Buffer.from(base64Data, 'base64');
        const photoPath = `registrations/${id}/photo.jpg`;
        const mime = formData.photoMime || 'image/jpeg';

        await adminClient.storage
          .from('event-photos')
          .upload(photoPath, photoBuffer, { contentType: mime, upsert: true });

        const { data: existDoc } = await adminClient
          .from('documents')
          .select('id')
          .eq('registration_id', id)
          .eq('doc_type', 'PHOTOGRAPH')
          .maybeSingle();

        if (existDoc) {
          await adminClient.from('documents').update({
            file_path: photoPath,
            original_filename: 'passport_photo.jpg',
            mime_type: mime,
            file_size_bytes: photoBuffer.length,
            status: 'PENDING',
            updated_at: new Date().toISOString(),
          }).eq('id', existDoc.id);
        } else {
          await adminClient.from('documents').insert({
            registration_id: id,
            event_id: currentReg.event_id,
            doc_type: 'PHOTOGRAPH',
            file_path: photoPath,
            original_filename: 'passport_photo.jpg',
            mime_type: mime,
            file_size_bytes: photoBuffer.length,
            status: 'PENDING',
            uploaded_by: updaterId,
          });
        }
      } catch (photoErr) {
        console.error('Update photo error:', photoErr);
      }
    }

    // 4. Process Aadhaar Proof Replacement if provided
    if (formData.proofBase64) {
      try {
        const base64Data = formData.proofBase64.includes(';base64,')
          ? formData.proofBase64.split(';base64,')[1]
          : formData.proofBase64;
        const proofBuffer = Buffer.from(base64Data, 'base64');
        const ext = formData.proofMime?.includes('pdf') ? 'pdf' : 'png';
        const proofPath = `registrations/${id}/id_proof.${ext}`;
        const mime = formData.proofMime || (ext === 'pdf' ? 'application/pdf' : 'image/png');

        await adminClient.storage
          .from('event-identity-documents')
          .upload(proofPath, proofBuffer, { contentType: mime, upsert: true });

        const { data: existDoc } = await adminClient
          .from('documents')
          .select('id')
          .eq('registration_id', id)
          .eq('doc_type', 'IDENTITY_PROOF')
          .maybeSingle();

        if (existDoc) {
          await adminClient.from('documents').update({
            file_path: proofPath,
            original_filename: formData.proofFileName || `aadhaar_card.${ext}`,
            mime_type: mime,
            file_size_bytes: proofBuffer.length,
            status: 'PENDING',
            updated_at: new Date().toISOString(),
          }).eq('id', existDoc.id);
        } else {
          await adminClient.from('documents').insert({
            registration_id: id,
            event_id: currentReg.event_id,
            doc_type: 'IDENTITY_PROOF',
            file_path: proofPath,
            original_filename: formData.proofFileName || `aadhaar_card.${ext}`,
            mime_type: mime,
            file_size_bytes: proofBuffer.length,
            status: 'PENDING',
            uploaded_by: updaterId,
          });
        }
      } catch (proofErr) {
        console.error('Update proof error:', proofErr);
      }
    }

    // 5. Process Physical Form Replacement if provided
    if (formData.formBase64) {
      try {
        const base64Data = formData.formBase64.includes(';base64,')
          ? formData.formBase64.split(';base64,')[1]
          : formData.formBase64;
        const formBuffer = Buffer.from(base64Data, 'base64');
        const ext = formData.formMime?.includes('pdf') ? 'pdf' : 'png';
        const formPath = `registrations/${id}/physical_form.${ext}`;
        const mime = formData.formMime || (ext === 'pdf' ? 'application/pdf' : 'image/png');

        await adminClient.storage
          .from('event-identity-documents')
          .upload(formPath, formBuffer, { contentType: mime, upsert: true });

        const { data: existDoc } = await adminClient
          .from('documents')
          .select('id')
          .eq('registration_id', id)
          .eq('doc_type', 'APPLICATION_FORM')
          .maybeSingle();

        if (existDoc) {
          await adminClient.from('documents').update({
            file_path: formPath,
            original_filename: formData.formFileName || `physical_form.${ext}`,
            mime_type: mime,
            file_size_bytes: formBuffer.length,
            status: 'PENDING',
            updated_at: new Date().toISOString(),
          }).eq('id', existDoc.id);
        } else {
          await adminClient.from('documents').insert({
            registration_id: id,
            event_id: currentReg.event_id,
            doc_type: 'APPLICATION_FORM',
            file_path: formPath,
            original_filename: formData.formFileName || `physical_form.${ext}`,
            mime_type: mime,
            file_size_bytes: formBuffer.length,
            status: 'PENDING',
            uploaded_by: updaterId,
          });
        }
      } catch (formErr) {
        console.error('Update form scan error:', formErr);
      }
    }

    // 6. Synchronize with id_cards table so Print Queue and physical badge reflect updates immediately
    await syncRegistrationToIdCard(adminClient, id, updated);

    // 7. Audit Log
    if (updaterId) {
      try {
        await adminClient.from('audit_logs').insert({
          event_id: currentReg.event_id,
          user_id: updaterId,
          action: 'REGISTRATION_UPDATE',
          resource_type: 'REGISTRATION',
          resource_id: id,
          details: {
            updated_fields: Object.keys(updatePayload),
            physical_form_number: formNo,
            full_name_en: updatePayload.full_name_en || currentReg.full_name_en,
          },
        });
      } catch (auditErr) {
        console.error('Audit log error:', auditErr);
      }
    }

    return { success: true, data: updated };
  } catch (err: any) {
    console.error('updateRegistration error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Synchronizes any registration changes directly into the associated id_cards record
 * so the print queue and physical card reflect the latest data immediately.
 */
async function syncRegistrationToIdCard(adminClient: any, regId: string, updatedReg: any) {
  try {
    const { data: existCard } = await adminClient
      .from('id_cards')
      .select('*')
      .eq('registration_id', regId)
      .maybeSingle();

    // Determine matching theme based on category and gender
    const targetGender = updatedReg.gender || 'MALE';
    const targetCategoryId = updatedReg.category_id;

    const { data: theme } = await adminClient
      .from('card_themes')
      .select('id')
      .eq('event_id', updatedReg.event_id)
      .eq('card_type_id', targetCategoryId)
      .eq('gender_rule', targetGender)
      .maybeSingle();

    const targetThemeId = theme?.id || existCard?.theme_id;

    // Get latest photo document
    const { data: photoDoc } = await adminClient
      .from('documents')
      .select('file_path')
      .eq('registration_id', regId)
      .eq('doc_type', 'PHOTOGRAPH')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const meta = {
      ...(existCard?.metadata || {}),
      physical_form_number: updatedReg.physical_form_number,
      receipt_number: updatedReg.receipt_number || null,
      gender: targetGender,
      dob: updatedReg.dob,
      address: updatedReg.address_en,
      city: updatedReg.city,
      pincode: updatedReg.pincode,
    };

    if (existCard) {
      await adminClient
        .from('id_cards')
        .update({
          recipient_name_en: updatedReg.full_name_en,
          recipient_name_gu: updatedReg.full_name_gu || updatedReg.full_name_en,
          recipient_mobile: updatedReg.mobile,
          recipient_photo_path: photoDoc?.file_path || existCard.recipient_photo_path,
          card_type_id: targetCategoryId,
          theme_id: targetThemeId || existCard.theme_id,
          metadata: meta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existCard.id);
    } else if (updatedReg.status === 'APPROVED') {
      const cardNum = updatedReg.registration_number.replace('NEST-2026-', 'NEST-CARD-');
      const qrToken = `tok_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      await adminClient.from('id_cards').insert({
        event_id: updatedReg.event_id,
        registration_id: updatedReg.id,
        card_number: cardNum,
        qr_code_hash: qrToken,
        card_type_id: targetCategoryId,
        theme_id: targetThemeId || '00000000-0000-0000-0000-000000000001',
        status: 'APPROVED',
        is_active: true,
        recipient_name_en: updatedReg.full_name_en,
        recipient_name_gu: updatedReg.full_name_gu || updatedReg.full_name_en,
        recipient_mobile: updatedReg.mobile,
        recipient_photo_path: photoDoc?.file_path || null,
        metadata: meta,
      });
    }
  } catch (syncErr) {
    console.error('syncRegistrationToIdCard error:', syncErr);
  }
}


