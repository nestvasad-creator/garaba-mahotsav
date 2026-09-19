'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserSession } from '@/lib/auth/actions';
import { canPerformAction } from '@/lib/auth/permissions';

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000010';

export interface SpecialCardItem {
  id: string;
  cardNumber: string;
  qrToken: string;
  cardTypeId: string;
  categoryCode: string;
  categoryNameEn: string;
  categoryNameGu: string;
  recipientNameEn: string;
  recipientNameGu: string;
  recipientMobile: string | null;
  recipientPhotoUrl: string | null;
  status: string;
  isActive: boolean;
  issuedAt: string | null;
  expiresAt: string | null;
  issuerName: string;
  createdAt: string;
}

export interface IssueSpecialCardInput {
  eventId?: string;
  cardTypeId: string;
  recipientNameEn: string;
  recipientNameGu?: string;
  recipientMobile?: string;
  gender?: 'MALE' | 'FEMALE';
  designation?: string;
  organization?: string;
  validFrom?: string;
  validTo?: string;
  photoBase64?: string;
  photoMime?: string;
}

/**
 * Fetches non-registered categories for Special Cards issuance.
 */
export async function getSpecialCardCategories(eventId: string = DEFAULT_EVENT_ID) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('card_types')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getSpecialCardCategories error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Fetches all issued Special ID cards (cards without a linked registration).
 */
export async function getSpecialCardsList(eventId: string = DEFAULT_EVENT_ID): Promise<SpecialCardItem[]> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !canPerformAction(session.roleCode, 'VIEW_SPECIAL_CARD')) {
      console.warn('Unauthorized view_special_card attempt:', session?.email);
      return [];
    }

    const adminClient = createAdminClient();

    const { data: cards, error } = await adminClient
      .from('id_cards')
      .select('*, card_types!card_type_id(id, code, name_en, name_gu), user_profiles!approved_by(full_name_en)')
      .eq('event_id', eventId)
      .is('registration_id', null)
      .order('created_at', { ascending: false });

    if (error || !cards) {
      console.error('getSpecialCardsList error:', error?.message);
      return [];
    }

    // Resolve signed URLs for photos
    const result: SpecialCardItem[] = [];
    for (const c of cards) {
      let photoUrl: string | null = null;
      if (c.recipient_photo_path) {
        const { data: signed } = await adminClient.storage
          .from('event-photos')
          .createSignedUrl(c.recipient_photo_path, 3600);
        photoUrl = signed?.signedUrl || null;
      }

      result.push({
        id: c.id,
        cardNumber: c.card_number,
        qrToken: c.qr_code_hash,
        cardTypeId: c.card_type_id,
        categoryCode: (c as any).card_types?.code || 'SPECIAL',
        categoryNameEn: (c as any).card_types?.name_en || 'Special Pass',
        categoryNameGu: (c as any).card_types?.name_gu || 'ખાસ પાસ',
        recipientNameEn: c.recipient_name_en,
        recipientNameGu: c.recipient_name_gu,
        recipientMobile: c.recipient_mobile,
        recipientPhotoUrl: photoUrl,
        status: c.status,
        isActive: c.is_active,
        issuedAt: c.issued_at,
        expiresAt: c.expires_at,
        issuerName: (c as any).user_profiles?.full_name_en || 'Special Desk',
        createdAt: c.created_at,
      });
    }

    return result;
  } catch (err: any) {
    console.error('getSpecialCardsList exception:', err);
    return [];
  }
}

/**
 * Issues and activates a new Special ID Card (VIP, Guest, Trustee, Volunteer, Security, etc.)
 */
export async function issueSpecialCard(input: IssueSpecialCardInput) {
  try {
    const session = await getCurrentUserSession();
    if (!session || !canPerformAction(session.roleCode, 'GENERATE_SPECIAL_CARD')) {
      return {
        success: false,
        error: `Unauthorized: Role '${session?.roleCode}' does not have permission to issue Special ID Cards.`,
      };
    }

    if (!input.cardTypeId || !input.recipientNameEn?.trim()) {
      return { success: false, error: 'Recipient name and category are required.' };
    }

    const eventId = input.eventId || DEFAULT_EVENT_ID;
    const adminClient = createAdminClient();

    // 1. Fetch category
    const { data: cardType, error: typeErr } = await adminClient
      .from('card_types')
      .select('*')
      .eq('id', input.cardTypeId)
      .single();

    if (typeErr || !cardType) {
      return { success: false, error: 'Invalid card category selected.' };
    }

    // 2. Resolve matching theme
    let themeId: string | null = null;
    const { data: genderTheme } = await adminClient
      .from('card_themes')
      .select('id')
      .eq('event_id', eventId)
      .eq('card_type_id', input.cardTypeId)
      .eq('gender_rule', input.gender || 'MALE')
      .maybeSingle();

    if (genderTheme?.id) {
      themeId = genderTheme.id;
    } else {
      const { data: defaultTheme } = await adminClient
        .from('card_themes')
        .select('id')
        .eq('event_id', eventId)
        .eq('card_type_id', input.cardTypeId)
        .maybeSingle();

      if (defaultTheme?.id) {
        themeId = defaultTheme.id;
      } else {
        const { data: anyTheme } = await adminClient
          .from('card_themes')
          .select('id')
          .eq('event_id', eventId)
          .limit(1)
          .maybeSingle();
        themeId = anyTheme?.id || null;
      }
    }

    if (!themeId) {
      return { success: false, error: 'No card theme template configured for this event category.' };
    }

    // 3. Generate unique card number & QR token
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const categoryPrefix = cardType.code.replace(/[^A-Z0-9]/g, '').slice(0, 4).toUpperCase();
    const cardNumber = `NEST-SP-${categoryPrefix}-${randomSuffix}`;
    const qrToken = `tok_sp_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

    // 4. Handle recipient photo upload if provided
    let photoPath: string | null = null;
    if (input.photoBase64) {
      try {
        const base64Data = input.photoBase64.includes(';base64,')
          ? input.photoBase64.split(';base64,')[1]
          : input.photoBase64;
        const photoBuffer = Buffer.from(base64Data, 'base64');
        const ext = input.photoMime?.includes('png') ? 'png' : 'jpg';
        photoPath = `special-cards/${cardNumber}.${ext}`;

        await adminClient.storage
          .from('event-photos')
          .upload(photoPath, photoBuffer, {
            contentType: input.photoMime || 'image/jpeg',
            upsert: true,
          });
      } catch (uploadErr) {
        console.error('Special card photo upload error:', uploadErr);
      }
    }

    const now = new Date().toISOString();
    const defaultExpiresAt = input.validTo ? new Date(input.validTo).toISOString() : '2026-10-13T00:00:00Z';

    // 5. Insert card record
    const { data: newCard, error: insertErr } = await adminClient
      .from('id_cards')
      .insert({
        event_id: eventId,
        registration_id: null,
        card_type_id: input.cardTypeId,
        theme_id: themeId,
        card_number: cardNumber,
        qr_code_hash: qrToken,
        status: 'APPROVED',
        is_active: true,
        recipient_name_en: input.recipientNameEn.trim(),
        recipient_name_gu: (input.recipientNameGu || input.recipientNameEn).trim(),
        recipient_mobile: input.recipientMobile?.trim() || null,
        recipient_photo_path: photoPath,
        approved_by: session.id,
        approved_at: now,
        issued_at: now,
        expires_at: defaultExpiresAt,
        metadata: {
          designation: input.designation || null,
          organization: input.organization || null,
          gender: input.gender || 'MALE',
          issued_by_email: session.email,
        },
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Special card insert error:', insertErr.message);
      return { success: false, error: insertErr.message };
    }

    // 6. Automatically queue print job
    const jobNumber = `JOB-SP-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;
    await adminClient.from('print_jobs').insert({
      event_id: eventId,
      card_id: newCard.id,
      job_number: jobNumber,
      status: 'QUEUED',
      is_reprint: false,
      printed_by: null,
      created_at: now,
    });

    // 7. Audit Log
    await adminClient.from('audit_logs').insert({
      event_id: eventId,
      user_id: session.id,
      action: 'SPECIAL_CARD_ISSUED',
      resource_type: 'ID_CARD',
      resource_id: newCard.id,
      details: {
        card_number: cardNumber,
        recipient_name_en: input.recipientNameEn,
        category: cardType.name_en,
        operator_email: session.email,
        operator_role: session.roleCode,
      },
    });

    return {
      success: true,
      card: newCard,
      message: `Special Pass ${cardNumber} issued and sent to print queue!`,
    };
  } catch (err: any) {
    console.error('issueSpecialCard exception:', err);
    return { success: false, error: err.message };
  }
}
