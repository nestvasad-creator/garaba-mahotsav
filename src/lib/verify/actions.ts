'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserSession } from '@/lib/auth/actions';

export interface ScanVerificationResult {
  valid: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'NOT_FOUND';
  statusText: string;
  card?: {
    id: string;
    cardNumber: string;
    qrToken: string;
    recipientNameEn: string;
    recipientNameGu: string;
    recipientMobile: string | null;
    photoUrl: string | null;
    categoryEn: string;
    categoryGu: string;
    eventNameEn: string;
    eventNameGu: string;
    validFrom: string;
    validTo: string;
    issuedAt: string | null;
    isReprinted: boolean;
    metadata: any;
    theme: {
      primaryColor: string;
      headerColor: string;
      footerColor: string;
      accentColor: string;
      textColor: string;
    };
  };
  scannedAt: string;
  gateName: string;
}

/**
 * Validates a physical ID card at gate turnstiles by QR token or card number.
 */
export async function verifyCardByToken(
  tokenOrCardNo: string,
  gateName: string = 'Main Gate 1'
): Promise<ScanVerificationResult> {
  const adminClient = createAdminClient();
  const now = new Date().toISOString();
  const session = await getCurrentUserSession();

  try {
    if (!tokenOrCardNo || !tokenOrCardNo.trim()) {
      return {
        valid: false,
        status: 'NOT_FOUND',
        statusText: 'No QR token provided',
        scannedAt: now,
        gateName,
      };
    }

    const cleanToken = tokenOrCardNo.trim();

    // Query card by qr_code_hash OR card_number
    const { data: card, error } = await adminClient
      .from('id_cards')
      .select('*, card_types!card_type_id(*), card_themes!theme_id(*), events!event_id(*)')
      .or(`qr_code_hash.eq.${cleanToken},card_number.eq.${cleanToken}`)
      .maybeSingle();

    if (error || !card) {
      return {
        valid: false,
        status: 'NOT_FOUND',
        statusText: 'Invalid or Unregistered Card (અમાન્ય અથવા અનોંધાયેલ કાર્ડ)',
        scannedAt: now,
        gateName,
      };
    }

    // Determine validity
    let scanStatus: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' = 'ACTIVE';
    let statusText = 'Valid & Authorized Entry (માન્ય અને અધિકૃત પ્રવેશ)';

    if (card.status === 'CANCELLED' || !card.is_active) {
      scanStatus = 'CANCELLED';
      statusText = 'Revoked or Cancelled Card (રદ થયેલ ઓળખપત્ર)';
    } else if (card.expires_at && new Date(card.expires_at).getTime() < Date.now()) {
      scanStatus = 'EXPIRED';
      statusText = 'Card Validity Expired (કાર્ડની મુદત પૂરી થઈ ગઈ છે)';
    }

    // Record turnstile scan in qr_scans table
    if (session?.id) {
      try {
        await adminClient.from('qr_scans').insert({
          event_id: card.event_id,
          card_id: card.id,
          scanner_user_id: session.id,
          scan_result: scanStatus,
          gate_name: gateName,
          device_info: {
            scanned_by_email: session.email,
            scanned_by_role: session.roleCode,
            timestamp: now,
          },
          scanned_at: now,
        });
      } catch (scanErr) {
        console.error('Record scan error:', scanErr);
      }
    }

    // Resolve photo URL
    let photoUrl: string | null = null;
    if (card.recipient_photo_path) {
      const { data: signed } = await adminClient.storage
        .from('event-photos')
        .createSignedUrl(card.recipient_photo_path, 3600);
      photoUrl = signed?.signedUrl || null;
    } else if (card.registration_id) {
      const { data: doc } = await adminClient
        .from('documents')
        .select('file_path')
        .eq('registration_id', card.registration_id)
        .eq('doc_type', 'PHOTOGRAPH')
        .maybeSingle();

      if (doc?.file_path) {
        const { data: signed } = await adminClient.storage
          .from('event-photos')
          .createSignedUrl(doc.file_path, 3600);
        photoUrl = signed?.signedUrl || null;
      }
    }

    return {
      valid: scanStatus === 'ACTIVE',
      status: scanStatus,
      statusText,
      card: {
        id: card.id,
        cardNumber: card.card_number,
        qrToken: card.qr_code_hash,
        recipientNameEn: card.recipient_name_en,
        recipientNameGu: card.recipient_name_gu,
        recipientMobile: card.recipient_mobile,
        photoUrl,
        categoryEn: (card as any).card_types?.name_en || 'Participant',
        categoryGu: (card as any).card_types?.name_gu || 'ઓળખપત્ર',
        eventNameEn: (card as any).events?.name_en || 'Navratri Mahotsav 2026',
        eventNameGu: (card as any).events?.name_gu || 'નવરાત્રી મહોત્સવ ૨૦૨૬',
        validFrom: card.issued_at ? card.issued_at.split('T')[0] : '2026-10-01',
        validTo: card.expires_at ? card.expires_at.split('T')[0] : '2026-10-12',
        issuedAt: card.issued_at,
        isReprinted: card.status === 'REPRINTED' || Boolean(card.metadata?.reprint_count > 0),
        metadata: card.metadata || {},
        theme: {
          primaryColor: (card as any).card_themes?.primary_color || '#900B09',
          headerColor: (card as any).card_themes?.header_color || '#700908',
          footerColor: (card as any).card_themes?.footer_color || '#700908',
          accentColor: (card as any).card_themes?.accent_color || '#F59E0B',
          textColor: (card as any).card_themes?.text_color || '#FFFFFF',
        },
      },
      scannedAt: now,
      gateName,
    };
  } catch (err: any) {
    console.error('verifyCardByToken error:', err);
    return {
      valid: false,
      status: 'NOT_FOUND',
      statusText: err.message || 'Verification system error',
      scannedAt: now,
      gateName,
    };
  }
}

export interface GateScanHistoryItem {
  id: string;
  cardNumber: string;
  recipientNameEn: string;
  categoryEn: string;
  scanResult: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'NOT_FOUND';
  gateName: string;
  scannedAt: string;
  photoUrl?: string | null;
}

/**
 * Retrieves recent scan activity for display on the gate operator dashboard.
 */
export async function getRecentGateScans(
  gateName?: string,
  limit: number = 10
): Promise<GateScanHistoryItem[]> {
  try {
    const adminClient = createAdminClient();
    let query = adminClient
      .from('qr_scans')
      .select('id, scan_result, gate_name, scanned_at, id_cards(id, card_number, recipient_name_en, recipient_photo_path, card_types(name_en))')
      .order('scanned_at', { ascending: false })
      .limit(limit);

    if (gateName && gateName !== 'ALL') {
      query = query.eq('gate_name', gateName);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.id,
      cardNumber: item.id_cards?.card_number || 'N/A',
      recipientNameEn: item.id_cards?.recipient_name_en || 'Unknown Attendee',
      categoryEn: item.id_cards?.card_types?.name_en || 'Pass Holder',
      scanResult: item.scan_result,
      gateName: item.gate_name || 'Gate',
      scannedAt: item.scanned_at,
      photoUrl: null,
    }));
  } catch (err) {
    console.error('getRecentGateScans error:', err);
    return [];
  }
}

