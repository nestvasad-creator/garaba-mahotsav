'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserSession } from '@/lib/auth/actions';
import { canPerformAction } from '@/lib/auth/permissions';

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000010';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportRow {
  registrationNumber: string;
  cardNumber: string | null;
  holderNameEn: string;
  holderNameGu: string;
  categoryEn: string;
  categoryCode: string;
  gender: string;
  mobile: string;
  areaZone: string | null;
  city: string | null;
  verificationStatus: string;
  cardStatus: string | null;
  printCount: number;
  reprintCount: number;
  createdAt: string;
  verifiedAt: string | null;
}

export interface ReportSummary {
  totalRegistrations: number;
  approved: number;
  underVerification: number;
  correctionRequired: number;
  rejected: number;
  draft: number;
  cardsPrinted: number;
  cardsQueued: number;
  totalReprintCount: number;
  specialCards: number;
  categoryBreakdown: Array<{ code: string; nameEn: string; count: number }>;
  genderBreakdown: { MALE: number; FEMALE: number; OTHER: number };
  dailyRegistrations: Array<{ date: string; count: number }>;
}

export interface ReportFilters {
  categoryCode?: string;
  status?: string;
  gender?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireAuth() {
  return getCurrentUserSession();
}

// ─── getReportRows ────────────────────────────────────────────────────────────

export async function getReportRows(
  filters: ReportFilters = {},
  eventId: string = DEFAULT_EVENT_ID
): Promise<{ rows: ReportRow[]; error?: string }> {
  const session = await requireAuth();
  if (!session || !canPerformAction(session.roleCode, 'VIEW_REPORTS')) {
    return { rows: [], error: 'Unauthorized' };
  }

  const supabase = createAdminClient();

  // Step 1: Fetch registrations with card_type join using explicit FK hint
  let regQuery = supabase
    .from('registrations')
    .select(`
      id,
      registration_number,
      full_name_en,
      full_name_gu,
      gender,
      mobile,
      area_zone,
      city,
      status,
      created_at,
      verified_at,
      category_id,
      card_types!category_id ( code, name_en )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'ALL') {
    regQuery = regQuery.eq('status', filters.status);
  }
  if (filters.gender && filters.gender !== 'ALL') {
    regQuery = regQuery.eq('gender', filters.gender);
  }
  if (filters.dateFrom) {
    regQuery = regQuery.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setDate(toDate.getDate() + 1);
    regQuery = regQuery.lt('created_at', toDate.toISOString().split('T')[0]);
  }

  const { data: regs, error: regError } = await regQuery;

  if (regError) {
    console.error('[Reports] registrations fetch error:', regError);
    return { rows: [], error: regError.message };
  }

  if (!regs || regs.length === 0) {
    return { rows: [] };
  }

  // Step 2: Fetch id_cards for these registrations using registration_id FK
  const regIds = regs.map((r: any) => r.id);
  const { data: cards, error: cardError } = await supabase
    .from('id_cards')
    .select('registration_id, card_number, status, print_count, reprint_count')
    .in('registration_id', regIds)
    .eq('event_id', eventId);

  if (cardError) {
    console.error('[Reports] id_cards fetch error:', cardError);
    // Don't fail — just proceed without card data
  }

  // Build a map: registration_id → card
  const cardMap = new Map<string, any>();
  for (const c of cards ?? []) {
    if (!cardMap.has(c.registration_id)) {
      cardMap.set(c.registration_id, c);
    }
  }

  // Step 3: Map and filter
  const rows: ReportRow[] = regs
    .map((r: any) => {
      const card = cardMap.get(r.id) ?? null;
      const ct = r.card_types as any;
      return {
        registrationNumber: r.registration_number,
        cardNumber: card?.card_number ?? null,
        holderNameEn: r.full_name_en,
        holderNameGu: r.full_name_gu,
        categoryEn: ct?.name_en ?? '',
        categoryCode: ct?.code ?? '',
        gender: r.gender,
        mobile: r.mobile,
        areaZone: r.area_zone,
        city: r.city,
        verificationStatus: r.status,
        cardStatus: card?.status ?? null,
        printCount: card?.print_count ?? 0,
        reprintCount: card?.reprint_count ?? 0,
        createdAt: r.created_at,
        verifiedAt: r.verified_at,
      };
    })
    .filter((row) => {
      if (filters.categoryCode && filters.categoryCode !== 'ALL') {
        return row.categoryCode === filters.categoryCode;
      }
      return true;
    });

  return { rows };
}

// ─── getReportSummary ─────────────────────────────────────────────────────────

export async function getReportSummary(
  eventId: string = DEFAULT_EVENT_ID
): Promise<{ summary: ReportSummary | null; error?: string }> {
  const session = await requireAuth();
  if (!session || !canPerformAction(session.roleCode, 'VIEW_REPORTS')) {
    return { summary: null, error: 'Unauthorized' };
  }

  const supabase = createAdminClient();

  // 1. All registrations with category info
  const { data: regs, error: regErr } = await supabase
    .from('registrations')
    .select('id, status, gender, created_at, card_types!category_id(code, name_en)')
    .eq('event_id', eventId);

  if (regErr) return { summary: null, error: regErr.message };

  // 2. All id_cards for this event
  const { data: cards, error: cardErr } = await supabase
    .from('id_cards')
    .select('status, print_count, reprint_count, card_types!card_type_id(is_registered)')
    .eq('event_id', eventId);

  if (cardErr) return { summary: null, error: cardErr.message };

  const allRegs = regs ?? [];
  const allCards = cards ?? [];

  // Aggregate registration counts
  const statusCount = (s: string) => allRegs.filter((r: any) => r.status === s).length;

  // Gender breakdown
  const gender = { MALE: 0, FEMALE: 0, OTHER: 0 };
  for (const r of allRegs) {
    const g = (r as any).gender as string;
    if (g === 'MALE') gender.MALE++;
    else if (g === 'FEMALE') gender.FEMALE++;
    else gender.OTHER++;
  }

  // Category breakdown
  const catMap = new Map<string, { code: string; nameEn: string; count: number }>();
  for (const r of allRegs) {
    const ct = (r as any).card_types as any;
    if (!ct) continue;
    if (!catMap.has(ct.code)) {
      catMap.set(ct.code, { code: ct.code, nameEn: ct.name_en, count: 0 });
    }
    catMap.get(ct.code)!.count++;
  }

  // Daily registrations (last 30 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const dailyMap = new Map<string, number>();
  for (const r of allRegs) {
    const d = new Date((r as any).created_at);
    if (d >= cutoff) {
      const key = d.toISOString().split('T')[0];
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
    }
  }
  const dailyRegistrations = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Card stats
  const cardsPrinted = allCards.filter((c: any) => c.status === 'PRINTED').length;
  const cardsQueued = allCards.filter((c: any) => c.status === 'PRINT_QUEUED').length;
  const totalReprintCount = allCards.reduce((sum, c: any) => sum + (c.reprint_count ?? 0), 0);
  const specialCards = allCards.filter((c: any) => {
    const ct = (c as any).card_types as any;
    return ct?.is_registered === false;
  }).length;

  return {
    summary: {
      totalRegistrations: allRegs.length,
      approved: statusCount('APPROVED'),
      underVerification: statusCount('UNDER_VERIFICATION'),
      correctionRequired: statusCount('CORRECTION_REQUIRED'),
      rejected: statusCount('REJECTED'),
      draft: statusCount('DRAFT'),
      cardsPrinted,
      cardsQueued,
      totalReprintCount,
      specialCards,
      categoryBreakdown: Array.from(catMap.values()).sort((a, b) => b.count - a.count),
      genderBreakdown: gender,
      dailyRegistrations,
    },
  };
}

// ─── getReportCategories ──────────────────────────────────────────────────────

export async function getReportCategories(
  eventId: string = DEFAULT_EVENT_ID
): Promise<Array<{ code: string; nameEn: string }>> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('card_types')
    .select('code, name_en')
    .eq('event_id', eventId)
    .order('name_en');
  return (data ?? []).map((d: any) => ({ code: d.code, nameEn: d.name_en }));
}
