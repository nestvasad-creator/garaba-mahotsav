'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserSession } from '@/lib/auth/actions';
import { canPerformAction } from '@/lib/auth/permissions';

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000010';

export interface VerificationItem {
  id: string;
  regNo: string;
  categoryName?: string;
  physicalFormNumber?: string | null;
  receiptNumber?: string | null;
  nameEn: string;
  nameGu: string;
  fatherHusbandEn?: string;
  fatherHusbandGu?: string;
  gender: string;
  dob?: string;
  mobile: string;
  addressEn: string;
  addressGu: string;
  city?: string | null;
  pincode?: string | null;
  zone: string;
  operatorName: string;
  createdBy: string | null;
  status: string;
  submittedAt: string;
  photoUrl: string | null;
  proofUrl: string | null;
  formUrl?: string | null;
  proofType: string;
  documents: Array<{
    id: string;
    docType: string;
    fileName: string;
    signedUrl: string | null;
    status: string;
  }>;
}

/**
 * Fetches the Maker-Checker verification queue with ephemeral signed URLs.
 */
export async function getPendingVerificationQueue(
  eventId: string = DEFAULT_EVENT_ID
): Promise<VerificationItem[]> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !canPerformAction(session.roleCode, 'VERIFY_DOCUMENT')) {
      console.warn('Unauthorized attempt to read verification queue:', session?.email);
      return [];
    }

    const adminClient = createAdminClient();

    // 1. Fetch pending registrations
    const { data: records, error: regError } = await adminClient
      .from('registrations')
      .select('*, card_types!category_id(name_en, name_gu), user_profiles!created_by(full_name_en, full_name_gu)')
      .eq('event_id', eventId)
      .in('status', ['SUBMITTED', 'UNDER_VERIFICATION', 'CORRECTION_REQUIRED'])
      .order('created_at', { ascending: true });

    if (regError || !records) {
      console.error('Fetch verification queue error:', regError?.message);
      return [];
    }

    if (records.length === 0) {
      return [];
    }

    const regIds = records.map((r) => r.id);

    // 2. Fetch documents for these registrations
    const { data: docs } = await adminClient
      .from('documents')
      .select('*')
      .in('registration_id', regIds);

    const docsByReg = new Map<string, any[]>();
    const photoPaths: string[] = [];
    const docPaths: string[] = [];

    for (const d of docs || []) {
      const arr = docsByReg.get(d.registration_id) || [];
      arr.push(d);
      docsByReg.set(d.registration_id, arr);

      if (d.file_path) {
        if (d.doc_type === 'PHOTOGRAPH') {
          photoPaths.push(d.file_path);
        } else {
          docPaths.push(d.file_path);
        }
      }
    }

    // 3. Batch generate ephemeral signed URLs in parallel (2 batch requests instead of N sequential requests)
    const signedUrlMap = new Map<string, string>();
    try {
      const [photosRes, docsRes] = await Promise.all([
        photoPaths.length > 0
          ? adminClient.storage.from('event-photos').createSignedUrls(photoPaths, 600)
          : Promise.resolve({ data: [] as any[] }),
        docPaths.length > 0
          ? adminClient.storage.from('event-identity-documents').createSignedUrls(docPaths, 600)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      if (photosRes.data) {
        for (const item of photosRes.data) {
          if (item?.path && item?.signedUrl) {
            signedUrlMap.set(item.path, item.signedUrl);
          }
        }
      }
      if (docsRes.data) {
        for (const item of docsRes.data) {
          if (item?.path && item?.signedUrl) {
            signedUrlMap.set(item.path, item.signedUrl);
          }
        }
      }
    } catch (signErr) {
      console.warn('Batch createSignedUrls warning:', signErr);
    }

    // 4. Assemble queue items
    const result: VerificationItem[] = [];

    for (const r of records) {
      const regDocs = docsByReg.get(r.id) || [];
      let photoUrl: string | null = null;
      let proofUrl: string | null = null;
      let formUrl: string | null = null;
      let proofType = 'Aadhaar Card';

      const enrichedDocs: Array<{
        id: string;
        docType: string;
        fileName: string;
        signedUrl: string | null;
        status: string;
      }> = [];

      for (const d of regDocs) {
        const signedUrl = (d.file_path && signedUrlMap.get(d.file_path)) || null;

        if (d.doc_type === 'PHOTOGRAPH') {
          photoUrl = signedUrl;
        } else if (d.doc_type === 'APPLICATION_FORM') {
          formUrl = signedUrl;
        } else {
          proofUrl = signedUrl;
          proofType = d.original_filename || 'Aadhaar Card';
        }

        enrichedDocs.push({
          id: d.id,
          docType: d.doc_type,
          fileName: d.original_filename,
          signedUrl,
          status: d.status,
        });
      }

      const creator = (r as any).user_profiles;

      result.push({
        id: r.id,
        regNo: r.registration_number,
        categoryName: (r as any).card_types?.name_en || 'Participant',
        physicalFormNumber:
          (r as any).physical_form_number ||
          (r.area_zone?.startsWith('Form #') ? r.area_zone.replace('Form #', '') : null),
        receiptNumber: (r as any).receipt_number || null,
        nameEn: r.full_name_en,
        nameGu: r.full_name_gu,
        fatherHusbandEn: r.father_husband_name_en,
        fatherHusbandGu: r.father_husband_name_gu,
        gender: r.gender,
        dob: r.dob,
        mobile: r.mobile,
        addressEn: r.address_en,
        addressGu: r.address_gu,
        city: r.city || null,
        pincode: r.pincode || null,
        zone: r.area_zone || 'Vasad',
        operatorName: creator?.full_name_en || 'Data Entry Desk',
        createdBy: r.created_by,
        status: r.status,
        submittedAt: new Date(r.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        photoUrl,
        proofUrl,
        formUrl,
        proofType,
        documents: enrichedDocs,
      });
    }

    return result;
  } catch (err: any) {
    console.error('getPendingVerificationQueue exception:', err);
    return [];
  }
}

/**
 * Performs Maker-Checker verification action (APPROVE, REJECT, CORRECTION)
 */
export async function verifyRegistrationAction(params: {
  registrationId: string;
  action: 'APPROVE' | 'REJECT' | 'CORRECTION';
  remarks?: string;
}) {
  try {
    // 1. Check Session & Role
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: 'Authentication required. Please sign in.' };
    }

    if (!canPerformAction(session.roleCode, 'VERIFY_DOCUMENT')) {
      return {
        success: false,
        error: `Unauthorized: Role '${session.roleCode}' cannot approve or reject registrations. Only VERIFIER or EVENT_ADMIN is permitted.`,
      };
    }

    const adminClient = createAdminClient();

    // 2. Fetch the registration record
    const { data: reg, error: fetchErr } = await adminClient
      .from('registrations')
      .select('*')
      .eq('id', params.registrationId)
      .single();

    if (fetchErr || !reg) {
      return { success: false, error: 'Registration record not found.' };
    }

    // 3. Validation: Rejection or Correction requires proper remarks and permissions
    if (params.action === 'REJECT') {
      if (session.roleCode === 'DATA_ENTRY_OPERATOR' || !canPerformAction(session.roleCode, 'REJECT_REGISTRATION')) {
        return {
          success: false,
          error: 'Unauthorized: Data Entry Operators (DEO) are not permitted to reject registrations. Rejections must be performed by an authorized Document Verifier or Administrator.',
        };
      }
      if (!params.remarks || !params.remarks.trim()) {
        return {
          success: false,
          error: 'Rejection remarks are mandatory. Please provide a clear reason for rejecting this registration.',
        };
      }
    }

    if (params.action === 'CORRECTION') {
      if (!params.remarks || !params.remarks.trim()) {
        return {
          success: false,
          error: 'Remarks are mandatory when returning for correction. Please specify what needs to be updated.',
        };
      }
    }

    const newStatus =
      params.action === 'APPROVE'
        ? 'APPROVED'
        : params.action === 'REJECT'
        ? 'REJECTED'
        : 'CORRECTION_REQUIRED';

    const now = new Date().toISOString();

    // 4. Update registration table
    const { error: updateErr } = await adminClient
      .from('registrations')
      .update({
        status: newStatus,
        verified_by: session.id,
        verified_at: now,
        verification_remarks: params.remarks?.trim() || null,
        updated_at: now,
      })
      .eq('id', params.registrationId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // 5. Update associated documents
    const docStatus =
      params.action === 'APPROVE'
        ? 'VERIFIED'
        : params.action === 'REJECT'
        ? 'REJECTED'
        : 'CORRECTION_REQUIRED';

    await adminClient
      .from('documents')
      .update({
        status: docStatus,
        verified_by: session.id,
        verified_at: now,
        remarks: params.remarks?.trim() || null,
      })
      .eq('registration_id', params.registrationId);

    // If Rejected, revoke any active card so it leaves the print queue
    if (params.action === 'REJECT') {
      await adminClient
        .from('id_cards')
        .update({
          status: 'REVOKED',
          is_active: false,
          updated_at: now,
        })
        .eq('registration_id', params.registrationId);
    }

    // 6. If Approved, auto-generate or re-activate ID card record
    if (params.action === 'APPROVE') {
      const cardNum = reg.registration_number.replace('NEST-2026-', 'NEST-CARD-');
      const qrToken = `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

      // Find matching theme (Gender-specific -> Category default -> Any event theme)
      let themeId: string | null = null;
      const { data: genderTheme } = await adminClient
        .from('card_themes')
        .select('id')
        .eq('event_id', reg.event_id)
        .eq('card_type_id', reg.category_id)
        .eq('gender_rule', reg.gender)
        .maybeSingle();

      if (genderTheme?.id) {
        themeId = genderTheme.id;
      } else {
        const { data: defaultTheme } = await adminClient
          .from('card_themes')
          .select('id')
          .eq('event_id', reg.event_id)
          .eq('card_type_id', reg.category_id)
          .maybeSingle();

        if (defaultTheme?.id) {
          themeId = defaultTheme.id;
        } else {
          const { data: anyTheme } = await adminClient
            .from('card_themes')
            .select('id')
            .eq('event_id', reg.event_id)
            .limit(1)
            .maybeSingle();
          themeId = anyTheme?.id || null;
        }
      }

      if (!themeId) {
        return { success: false, error: 'No valid card theme found for this event and card type.' };
      }

      // Retrieve photo document if available
      const { data: photoDoc } = await adminClient
        .from('documents')
        .select('file_path')
        .eq('registration_id', reg.id)
        .eq('doc_type', 'PHOTOGRAPH')
        .maybeSingle();

      await adminClient.from('id_cards').upsert(
        {
          event_id: reg.event_id,
          registration_id: reg.id,
          card_type_id: reg.category_id,
          theme_id: themeId,
          card_number: cardNum,
          qr_code_hash: qrToken,
          status: 'APPROVED',
          is_active: true,
          recipient_name_en: reg.full_name_en,
          recipient_name_gu: reg.full_name_gu || reg.full_name_en,
          recipient_mobile: reg.mobile,
          recipient_photo_path: photoDoc?.file_path || null,
          approved_by: session.id,
          approved_at: now,
          metadata: {
            physical_form_number: reg.physical_form_number,
            receipt_number: (reg as any).receipt_number || null,
            gender: reg.gender,
            dob: reg.dob,
            address: reg.address_en,
            city: reg.city,
            pincode: reg.pincode,
          },
        },
        { onConflict: 'event_id,card_number' }
      );
    }

    // 7. Audit log
    await adminClient.from('audit_logs').insert({
      event_id: reg.event_id,
      user_id: session.id,
      action: `VERIFICATION_${params.action}`,
      resource_type: 'REGISTRATION',
      resource_id: reg.id,
      details: {
        registration_number: reg.registration_number,
        action: params.action,
        remarks: params.remarks || null,
        verifier_email: session.email,
        verifier_role: session.roleCode,
      },
    });

    return {
      success: true,
      status: newStatus,
      message:
        params.action === 'APPROVE'
          ? `Registration ${reg.registration_number} approved and physical card generated!`
          : params.action === 'REJECT'
          ? `Registration ${reg.registration_number} rejected.`
          : `Registration ${reg.registration_number} returned for correction.`,
    };
  } catch (err: any) {
    console.error('verifyRegistrationAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Performs batch verification action (APPROVE or REJECT) on multiple registrations.
 */
export async function batchVerifyRegistrationAction(params: {
  registrationIds: string[];
  action: 'APPROVE' | 'REJECT';
  remarks?: string;
}): Promise<{
  success: boolean;
  count: number;
  message?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, count: 0, error: 'Authentication required. Please sign in.' };
    }

    if (!canPerformAction(session.roleCode, 'VERIFY_DOCUMENT')) {
      return {
        success: false,
        count: 0,
        error: `Unauthorized: Role '${session.roleCode}' cannot verify registrations. Only VERIFIER or EVENT_ADMIN is permitted.`,
      };
    }

    if (params.action === 'REJECT') {
      if (session.roleCode === 'DATA_ENTRY_OPERATOR' || !canPerformAction(session.roleCode, 'REJECT_REGISTRATION')) {
        return {
          success: false,
          count: 0,
          error: 'Unauthorized: Data Entry Operators are not permitted to reject registrations.',
        };
      }
      if (!params.remarks || !params.remarks.trim()) {
        return {
          success: false,
          count: 0,
          error: 'Rejection remarks are mandatory when rejecting registrations.',
        };
      }
    }

    if (!params.registrationIds || params.registrationIds.length === 0) {
      return { success: true, count: 0, message: 'No registrations selected.' };
    }

    const adminClient = createAdminClient();
    const now = new Date().toISOString();

    // 1. Fetch all target registration records
    const { data: records, error: fetchErr } = await adminClient
      .from('registrations')
      .select('*')
      .in('id', params.registrationIds);

    if (fetchErr || !records || records.length === 0) {
      return { success: false, count: 0, error: 'No matching registration records found.' };
    }

    const validIds = records.map((r) => r.id);
    const newStatus = params.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const docStatus = params.action === 'APPROVE' ? 'VERIFIED' : 'REJECTED';

    // 2. Batch update registrations
    const { error: regUpdateErr } = await adminClient
      .from('registrations')
      .update({
        status: newStatus,
        verified_by: session.id,
        verified_at: now,
        verification_remarks: params.remarks?.trim() || null,
        updated_at: now,
      })
      .in('id', validIds);

    if (regUpdateErr) {
      return { success: false, count: 0, error: regUpdateErr.message };
    }

    // 3. Batch update associated documents
    await adminClient
      .from('documents')
      .update({
        status: docStatus,
        verified_by: session.id,
        verified_at: now,
        remarks: params.remarks?.trim() || null,
      })
      .in('registration_id', validIds);

    // 4. If Rejected, revoke any active card records
    if (params.action === 'REJECT') {
      await adminClient
        .from('id_cards')
        .update({
          status: 'REVOKED',
          is_active: false,
          updated_at: now,
        })
        .in('registration_id', validIds);
    }

    // 5. If Approved, bulk generate ID card records
    if (params.action === 'APPROVE') {
      const eventId = records[0]?.event_id || DEFAULT_EVENT_ID;

      // Pre-fetch all card themes for the event
      const { data: themes } = await adminClient
        .from('card_themes')
        .select('id, event_id, card_type_id, gender_rule')
        .eq('event_id', eventId);

      // Pre-fetch photo documents for all registrations
      const { data: photos } = await adminClient
        .from('documents')
        .select('registration_id, file_path')
        .in('registration_id', validIds)
        .eq('doc_type', 'PHOTOGRAPH');

      const photoMap = new Map<string, string>();
      for (const p of photos || []) {
        if (p.registration_id && p.file_path) {
          photoMap.set(p.registration_id, p.file_path);
        }
      }

      const idCardUpserts: any[] = [];

      for (const reg of records) {
        const cardNum = reg.registration_number.replace('NEST-2026-', 'NEST-CARD-');
        const qrToken = `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

        let themeId: string | null = null;
        if (themes && themes.length > 0) {
          const matchGender = themes.find(
            (t) => t.card_type_id === reg.category_id && t.gender_rule === reg.gender
          );
          const matchCat = themes.find((t) => t.card_type_id === reg.category_id);
          themeId = matchGender?.id || matchCat?.id || themes[0]?.id || null;
        }

        if (themeId) {
          idCardUpserts.push({
            event_id: reg.event_id,
            registration_id: reg.id,
            card_type_id: reg.category_id,
            theme_id: themeId,
            card_number: cardNum,
            qr_code_hash: qrToken,
            status: 'APPROVED',
            is_active: true,
            recipient_name_en: reg.full_name_en,
            recipient_name_gu: reg.full_name_gu || reg.full_name_en,
            recipient_mobile: reg.mobile,
            recipient_photo_path: photoMap.get(reg.id) || null,
            approved_by: session.id,
            approved_at: now,
            metadata: {
              physical_form_number: reg.physical_form_number,
              receipt_number: (reg as any).receipt_number || null,
              gender: reg.gender,
              dob: reg.dob,
              address: reg.address_en,
              city: reg.city,
              pincode: reg.pincode,
            },
          });
        }
      }

      if (idCardUpserts.length > 0) {
        await adminClient.from('id_cards').upsert(idCardUpserts, {
          onConflict: 'event_id,card_number',
        });
      }
    }

    // 6. Bulk Insert Audit Logs
    const auditEntries = records.map((reg) => ({
      event_id: reg.event_id,
      user_id: session.id,
      action: `VERIFICATION_BATCH_${params.action}`,
      resource_type: 'REGISTRATION',
      resource_id: reg.id,
      details: {
        registration_number: reg.registration_number,
        action: params.action,
        remarks: params.remarks || null,
        batch_size: validIds.length,
        verifier_email: session.email,
        verifier_role: session.roleCode,
      },
    }));

    await adminClient.from('audit_logs').insert(auditEntries);

    return {
      success: true,
      count: validIds.length,
      message:
        params.action === 'APPROVE'
          ? `Successfully batch-approved ${validIds.length} registration(s) and queued physical ID cards for printing!`
          : `Successfully batch-rejected ${validIds.length} registration(s).`,
    };
  } catch (err: any) {
    console.error('batchVerifyRegistrationAction error:', err);
    return { success: false, count: 0, error: err.message };
  }
}
