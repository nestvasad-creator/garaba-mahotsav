'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserSession } from '@/lib/auth/actions';
import { canPerformAction } from '@/lib/auth/permissions';
import { ReprintReason } from '@/types';

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000010';

export interface CardListItem {
  id: string;
  cardNumber: string;
  qrToken: string;
  registrationId: string | null;
  cardTypeId: string;
  cardTypeCode: string;
  categoryEn: string;
  categoryGu: string;
  themeId: string;
  theme: {
    primaryColor: string;
    headerColor: string;
    footerColor: string;
    accentColor: string;
    textColor: string;
  };
  holderNameEn: string;
  holderNameGu: string;
  holderPhotoUrl: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  validFrom: string;
  validTo: string;
  status: string;
  printCount: number;
  reprintCount: number;
  createdAt: string;
}

export interface PrintQueueItem {
  id: string;
  cardId: string;
  cardNumber: string;
  holderNameEn: string;
  holderNameGu: string;
  categoryEn: string;
  categoryGu: string;
  categoryCode?: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  photoUrl: string | null;
  qrToken: string;
  status: string; // 'QUEUED' | 'PRINTED' | 'FAILED'
  cardStatus: string;
  printCount: number;
  reprintCount: number;
  reprintReason?: string | null;
  receiptNumber?: string | null;
  physicalFormNumber?: string | null;
  requestedAt: string;
  theme: {
    primaryColor: string;
    headerColor: string;
    footerColor: string;
    accentColor: string;
    textColor: string;
  };
}

/**
 * Fetches the print queue: approved and print-queued cards.
 */
export async function getPrintQueue(
  eventId: string = DEFAULT_EVENT_ID
): Promise<PrintQueueItem[]> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !canPerformAction(session.roleCode, 'PRINT_CARD')) {
      console.warn('Unauthorized attempt to read print queue:', session?.email);
      return [];
    }

    const adminClient = createAdminClient();

    // 1. Fetch cards with status APPROVED, PRINT_QUEUED, or PRINTED
    // Linked with registrations table so edited participant details are always fresh
    let { data: cards, error } = await adminClient
      .from('id_cards')
      .select('*, registrations!registration_id(id, full_name_en, full_name_gu, mobile, gender, receipt_number, physical_form_number, category_id, status), card_types!card_type_id(id, code, name_en, name_gu), card_themes!theme_id(*)')
      .eq('event_id', eventId)
      .in('status', ['APPROVED', 'PRINT_QUEUED', 'PRINTED', 'REPRINTED'])
      .order('updated_at', { ascending: false });

    // 2. Ensure any approved registrations that might be missing an id_cards row get generated automatically
    const { data: approvedRegs } = await adminClient
      .from('registrations')
      .select('id, event_id, registration_number, full_name_en, full_name_gu, mobile, gender, category_id, receipt_number, physical_form_number')
      .eq('event_id', eventId)
      .eq('status', 'APPROVED');

    if (approvedRegs && approvedRegs.length > 0) {
      const existingRegIds = new Set((cards || []).map((c) => c.registration_id).filter(Boolean));
      let createdAny = false;
      for (const ar of approvedRegs) {
        if (!existingRegIds.has(ar.id)) {
          const cardNum = ar.registration_number.replace('NEST-2026-', 'NEST-CARD-');
          const qrToken = `tok_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
          const { data: theme } = await adminClient
            .from('card_themes')
            .select('id')
            .eq('event_id', ar.event_id)
            .eq('card_type_id', ar.category_id)
            .eq('gender_rule', ar.gender)
            .maybeSingle();

          const { data: photoDoc } = await adminClient
            .from('documents')
            .select('file_path')
            .eq('registration_id', ar.id)
            .eq('doc_type', 'PHOTOGRAPH')
            .maybeSingle();

          await adminClient.from('id_cards').insert({
            event_id: ar.event_id,
            registration_id: ar.id,
            card_number: cardNum,
            qr_code_hash: qrToken,
            card_type_id: ar.category_id,
            theme_id: theme?.id || '00000000-0000-0000-0000-000000000001',
            status: 'APPROVED',
            is_active: true,
            recipient_name_en: ar.full_name_en,
            recipient_name_gu: ar.full_name_gu || ar.full_name_en,
            recipient_mobile: ar.mobile,
            recipient_photo_path: photoDoc?.file_path || null,
            metadata: {
              physical_form_number: ar.physical_form_number,
              receipt_number: ar.receipt_number || null,
              gender: ar.gender,
            },
          });
          createdAny = true;
        }
      }

      if (createdAny) {
        const refetch = await adminClient
          .from('id_cards')
          .select('*, registrations!registration_id(id, full_name_en, full_name_gu, mobile, gender, receipt_number, physical_form_number, category_id, status), card_types!card_type_id(id, code, name_en, name_gu), card_themes!theme_id(*)')
          .eq('event_id', eventId)
          .in('status', ['APPROVED', 'PRINT_QUEUED', 'PRINTED', 'REPRINTED'])
          .order('updated_at', { ascending: false });
        cards = refetch.data || cards;
      }
    }

    if (error || !cards) {
      console.error('getPrintQueue cards error:', error?.message);
      return [];
    }

    // 3. Fetch associated photos for registrations or direct recipient_photo_path
    const regIds = cards.map((c) => c.registration_id).filter(Boolean);
    const regPhotoMap = new Map<string, string>();
    if (regIds.length > 0) {
      const { data: regDocs } = await adminClient
        .from('documents')
        .select('registration_id, file_path')
        .in('registration_id', regIds)
        .eq('doc_type', 'PHOTOGRAPH');

      if (regDocs) {
        for (const d of regDocs) {
          if (!regPhotoMap.has(d.registration_id)) {
            regPhotoMap.set(d.registration_id, d.file_path);
          }
        }
      }
    }

    const photoMap = new Map<string, string>();
    for (const c of cards) {
      const photoPath = c.recipient_photo_path || (c.registration_id ? regPhotoMap.get(c.registration_id) : null);
      if (photoPath) {
        const { data: signed } = await adminClient.storage
          .from('event-photos')
          .createSignedUrl(photoPath, 3600);
        if (signed?.signedUrl) {
          photoMap.set(c.id, signed.signedUrl);
        }
      }
    }

    // 4. Fetch print jobs for these cards
    const cardIds = cards.map((c) => c.id);
    const { data: jobs } = await adminClient
      .from('print_jobs')
      .select('*')
      .in('card_id', cardIds)
      .order('created_at', { ascending: false });

    const jobMap = new Map<string, any>();
    const printCountMap = new Map<string, number>();
    const reprintCountMap = new Map<string, number>();

    if (jobs) {
      for (const job of jobs) {
        if (!jobMap.has(job.card_id)) {
          jobMap.set(job.card_id, job);
        }
        if (job.status === 'PRINTED') {
          printCountMap.set(job.card_id, (printCountMap.get(job.card_id) || 0) + 1);
        }
        if (job.is_reprint) {
          reprintCountMap.set(job.card_id, (reprintCountMap.get(job.card_id) || 0) + 1);
        }
      }
    }

    return cards.map((c: any) => {
      const reg = c.registrations;
      const latestJob = jobMap.get(c.id);
      const photoUrl = photoMap.get(c.id) || null;
      const printCount = printCountMap.get(c.id) || c.metadata?.print_count || 0;
      const reprintCount = reprintCountMap.get(c.id) || c.metadata?.reprint_count || 0;

      const queueStatus =
        c.status === 'PRINTED' && printCount > 0 ? 'PRINTED' : 'QUEUED';

      // Always prioritize latest data from registration record if linked
      const holderNameEn = reg?.full_name_en || c.recipient_name_en;
      const holderNameGu = reg?.full_name_gu || c.recipient_name_gu || holderNameEn;
      const gender = reg?.gender || c.metadata?.gender || null;
      const receiptNumber = reg?.receipt_number || c.metadata?.receipt_number || null;
      const physicalFormNumber = reg?.physical_form_number || c.metadata?.physical_form_number || null;

      return {
        id: latestJob?.id || c.id,
        cardId: c.id,
        cardNumber: c.card_number,
        holderNameEn,
        holderNameGu,
        categoryEn: c.card_types?.name_en || 'Participant',
        categoryGu: c.card_types?.name_gu || 'ખેલૈયા',
        categoryCode: c.card_types?.code || '',
        gender,
        photoUrl,
        qrToken: c.qr_code_hash,
        status: queueStatus,
        cardStatus: c.status,
        printCount,
        reprintCount,
        reprintReason: latestJob?.reprint_reason || null,
        receiptNumber,
        physicalFormNumber,
        requestedAt: new Date(latestJob?.created_at || c.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        theme: {
          primaryColor: c.card_themes?.primary_color || '#900B09',
          headerColor: c.card_themes?.header_color || '#700908',
          footerColor: c.card_themes?.footer_color || '#700908',
          accentColor: c.card_themes?.accent_color || '#F59E0B',
          textColor: c.card_themes?.text_color || '#FFFFFF',
        },
      };
    });
  } catch (err: any) {
    console.error('getPrintQueue exception:', err);
    return [];
  }
}

/**
 * Dispatches a print job for a physical ID card.
 */
export async function dispatchPrint(
  cardId: string,
  printerIdentifier: string = 'ZEBRA-ZC300-USB01'
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !canPerformAction(session.roleCode, 'PRINT_CARD')) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to print ID cards.',
      };
    }

    const adminClient = createAdminClient();
    const now = new Date().toISOString();

    // 1. Fetch current card
    const { data: card, error: fetchErr } = await adminClient
      .from('id_cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (fetchErr || !card) {
      return { success: false, error: 'Card record not found.' };
    }

    const currentMetadata = (card.metadata && typeof card.metadata === 'object') ? card.metadata : {};
    const newPrintCount = (Number(currentMetadata.print_count) || 0) + 1;
    const jobNumber = `JOB-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    // 2. Update card status and count
    const { error: cardErr } = await adminClient
      .from('id_cards')
      .update({
        status: 'PRINTED',
        issued_at: now,
        metadata: {
          ...currentMetadata,
          print_count: newPrintCount,
          last_printer: printerIdentifier,
        },
        updated_at: now,
      })
      .eq('id', cardId);

    if (cardErr) {
      return { success: false, error: cardErr.message };
    }

    // 3. Record in print_jobs
    await adminClient.from('print_jobs').insert({
      event_id: card.event_id,
      card_id: cardId,
      job_number: jobNumber,
      status: 'PRINTED',
      is_reprint: Boolean(currentMetadata.reprint_count > 0),
      printed_by: session.id,
      printed_at: now,
    });

    // 4. Record in audit log
    await adminClient.from('audit_logs').insert({
      event_id: card.event_id,
      user_id: session.id,
      action: 'CARD_PRINTED',
      resource_type: 'ID_CARD',
      resource_id: cardId,
      details: {
        job_number: jobNumber,
        card_number: card.card_number,
        recipient_name_en: card.recipient_name_en,
        print_count: newPrintCount,
        printer: printerIdentifier,
        printed_by_email: session.email,
        printed_by_role: session.roleCode,
      },
    });

    return {
      success: true,
      message: `Card ${card.card_number} dispatched to printer ${printerIdentifier}.`,
    };
  } catch (err: any) {
    console.error('dispatchPrint error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Dispatches a batch of cards for printing.
 */
export async function batchDispatchPrint(
  cardIds: string[],
  printerIdentifier: string = 'ZEBRA-ZC300-USB01'
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    let successCount = 0;
    for (const id of cardIds) {
      const res = await dispatchPrint(id, printerIdentifier);
      if (res.success) successCount++;
    }
    return { success: true, count: successCount };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Reverts a card from PRINTED back to PRINT_QUEUED if print was cancelled in preview or jammed.
 * Prevents requiring a formal reprint request when no physical card was actually printed.
 */
export async function revertCardToQueue(
  cardId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !canPerformAction(session.roleCode, 'PRINT_CARD')) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to modify print queue.',
      };
    }

    const adminClient = createAdminClient();
    const now = new Date().toISOString();

    // 1. Fetch current card
    const { data: card, error: fetchErr } = await adminClient
      .from('id_cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (fetchErr || !card) {
      return { success: false, error: 'Card record not found.' };
    }

    const currentMetadata = (card.metadata && typeof card.metadata === 'object') ? card.metadata : {};
    const adjustedPrintCount = Math.max(0, (Number(currentMetadata.print_count) || 1) - 1);

    // 2. Put card back to PRINT_QUEUED with decremented print_count
    const { error: updateErr } = await adminClient
      .from('id_cards')
      .update({
        status: 'PRINT_QUEUED',
        metadata: {
          ...currentMetadata,
          print_count: adjustedPrintCount,
        },
        updated_at: now,
      })
      .eq('id', cardId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // 3. Remove the most recent print_job if it was logged
    const { data: latestJobs } = await adminClient
      .from('print_jobs')
      .select('id')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (latestJobs && latestJobs.length > 0) {
      await adminClient
        .from('print_jobs')
        .delete()
        .eq('id', latestJobs[0].id);
    }

    // 4. Record audit log
    await adminClient.from('audit_logs').insert({
      event_id: card.event_id,
      user_id: session.id,
      action: 'CARD_PRINT_REVERTED',
      resource_type: 'ID_CARD',
      resource_id: cardId,
      details: {
        card_number: card.card_number,
        reason: 'Operator cancelled print dialog or requested queue rollback',
        reverted_by: session.email,
      },
    });

    return {
      success: true,
      message: `Card ${card.card_number} returned to Print Queue (Status: QUEUED).`,
    };
  } catch (err: any) {
    console.error('revertCardToQueue error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Reverts a batch of cards from PRINTED back to PRINT_QUEUED.
 */
export async function batchRevertToQueue(
  cardIds: string[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    let successCount = 0;
    for (const id of cardIds) {
      const res = await revertCardToQueue(id);
      if (res.success) successCount++;
    }
    return { success: true, count: successCount };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Manually updates the print status of an ID card (either 'PRINTED' or 'QUEUED')
 * with audit logging.
 */
export async function manualSetCardPrintStatus(
  cardId: string,
  targetStatus: 'PRINTED' | 'QUEUED',
  printerIdentifier: string = 'MANUAL-OVERRIDE'
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (targetStatus === 'PRINTED') {
    return dispatchPrint(cardId, printerIdentifier);
  } else {
    return revertCardToQueue(cardId);
  }
}

/**
 * Manually updates the print status of multiple ID cards in bulk.
 */
export async function batchManualSetCardPrintStatus(
  cardIds: string[],
  targetStatus: 'PRINTED' | 'QUEUED',
  printerIdentifier: string = 'MANUAL-OVERRIDE'
): Promise<{ success: boolean; count: number; error?: string }> {
  if (targetStatus === 'PRINTED') {
    return batchDispatchPrint(cardIds, printerIdentifier);
  } else {
    return batchRevertToQueue(cardIds);
  }
}

/**
 * Authorizes and requests a controlled reprint with mandatory reason and audit log.
 */
export async function requestCardReprint(params: {
  cardId: string;
  reason: ReprintReason;
  notes?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !canPerformAction(session.roleCode, 'REPRINT_CARD')) {
      return {
        success: false,
        error: 'Unauthorized: Only authorized operators can request card reprints.',
      };
    }

    if (!params.reason) {
      return {
        success: false,
        error: 'Mandatory reprint reason must be specified for security compliance.',
      };
    }

    const adminClient = createAdminClient();
    const now = new Date().toISOString();

    // 1. Fetch current card
    const { data: card, error: fetchErr } = await adminClient
      .from('id_cards')
      .select('*')
      .eq('id', params.cardId)
      .single();

    if (fetchErr || !card) {
      return { success: false, error: 'Card record not found.' };
    }

    const currentMetadata = (card.metadata && typeof card.metadata === 'object') ? card.metadata : {};
    const newReprintCount = (Number(currentMetadata.reprint_count) || 0) + 1;
    const jobNumber = `REPRINT-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    // 2. Put card back in print queue
    const { error: updateErr } = await adminClient
      .from('id_cards')
      .update({
        status: 'PRINT_QUEUED',
        metadata: {
          ...currentMetadata,
          reprint_count: newReprintCount,
          last_reprint_reason: params.reason,
        },
        updated_at: now,
      })
      .eq('id', params.cardId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // 3. Insert new job in print_jobs table with reason and notes
    await adminClient.from('print_jobs').insert({
      event_id: card.event_id,
      card_id: params.cardId,
      job_number: jobNumber,
      status: 'QUEUED',
      is_reprint: true,
      reprint_reason: params.reason,
      reprint_notes: params.notes || null,
      created_at: now,
    });

    // 4. Immutable Audit Log
    await adminClient.from('audit_logs').insert({
      event_id: card.event_id,
      user_id: session.id,
      action: 'CARD_REPRINT_REQUESTED',
      resource_type: 'ID_CARD',
      resource_id: params.cardId,
      details: {
        job_number: jobNumber,
        card_number: card.card_number,
        recipient_name_en: card.recipient_name_en,
        reprint_reason: params.reason,
        reprint_notes: params.notes || '',
        reprint_count: newReprintCount,
        authorized_by_email: session.email,
        authorized_by_role: session.roleCode,
      },
    });

    return {
      success: true,
      message: `Reprint authorized for Card ${card.card_number}. Placed back in print queue.`,
    };
  } catch (err: any) {
    console.error('requestCardReprint error:', err);
    return { success: false, error: err.message };
  }
}
