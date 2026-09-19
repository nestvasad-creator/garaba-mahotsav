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
  verificationStatus: string;  // registration.status
  cardStatus: string | null;   // id_cards.status (PRINTED / PRINT_QUEUED etc.)
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
  specialCards: number;       // non-registered card types (VIP, Guest, Security etc.)
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

// ─── Server Actions ───────────────────────────────────────────────────────────

/**
 * Fetches all report rows from registrations joined with id_cards.
 */
export async function getReportRows(
  filters: ReportFilters = {},
  eventId: string = DEFAULT_EVENT_ID
): Promise<{ rows: ReportRow[]; error?: string }> {
  const session = await getCurrentUserSession();
  if (!session || !canPerformAction(session.roleCode, 'VIEW_REPORTS')) {
    return { rows: [], error: 'Unauthorized' };
  }

  const supabase = createAdminClient();

  let query = supabase
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
      card_types!inner ( code, name_en ),
      id_cards ( card_number, status, print_count, reprint_count )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }
  if (filters.gender && filters.gender !== 'ALL') {
    query = query.eq('gender', filters.gender);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    // Add 1 day so dateTo is inclusive
    const toDate = new Date(filters.dateTo);
    toDate.setDate(toDate.getDate() + 1);
    query = query.lt('created_at', toDate.toISOString().split('T')[0]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Reports] getReportRows error:', error);
    return { rows: [], error: error.message };
  }

  const rows: ReportRow[] = (data ?? []).map((r: any) => {
    const card = Array.isArray(r.id_cards) ? r.id_cards[0] : r.id_cards;
    const cardType = Array.isArray(r.card_types) ? r.card_types[0] : r.card_types;

    // Apply category filter after join (Supabase nested filter limitation)
    return {
      registrationNumber: r.registration_number,
      cardNumber: card?.card_number ?? null,
      holderNameEn: r.full_name_en,
      holderNameGu: r.full_name_gu,
      categoryEn: cardType?.name_en ?? '',
      categoryCode: cardType?.code ?? '',
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
  }).filter((row) => {
    if (filters.categoryCode && filters.categoryCode !== 'ALL') {
      return row.categoryCode === filters.categoryCode;
    }
    return true;
  });

  return { rows };
}

/**
 * Fetches aggregate summary stats for the KPI dashboard cards.
 */
export async function getReportSummary(
  eventId: string = DEFAULT_EVENT_ID
): Promise<{ summary: ReportSummary | null; error?: string }> {
  const session = await getCurrentUserSession();
  if (!session || !canPerformAction(session.roleCode, 'VIEW_REPORTS')) {
    return { summary: null, error: 'Unauthorized' };
  }

  const supabase = createAdminClient();

  // 1. Registration status breakdown
  const { data: regData, error: regError } = await supabase
    .from('registrations')
    .select('status, created_at, card_types!inner(code, name_en, is_registered)')
    .eq('event_id', eventId);

  if (regError) {
    return { summary: null, error: regError.message };
  }

  // 2. ID cards stats
  const { data: cardData, error: cardError } = await supabase
    .from('id_cards')
    .select('status, print_count, reprint_count, card_types!inner(is_registered)')
    .eq('event_id', eventId);

  if (cardError) {
    return { summary: null, error: cardError.message };
  }

  // 3. Gender breakdown
  const { data: genderData, error: genderError } = await supabase
    .from('registrations')
    .select('gender')
    .eq('event_id', eventId);

  if (genderError) {
    return { summary: null, error: genderError.message };
  }

  // 4. Category breakdown
  const { data: catData, error: catError } = await supabase
    .from('registrations')
    .select('card_types!inner(code, name_en)')
    .eq('event_id', eventId);

  if (catError) {
    return { summary: null, error: catError.message };
  }

  // 5. Daily registrations (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: dailyData, error: dailyError } = await supabase
    .from('registrations')
    .select('created_at')
    .eq('event_id', eventId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (dailyError) {
    return { summary: null, error: dailyError.message };
  }

  // ── Compute aggregates ──────────────────────────────────────
  const regs = regData ?? [];
  const cards = cardData ?? [];

  const countByStatus = (status: string) =>
    regs.filter((r: any) => r.status === status).length;

  const genderCounts = { MALE: 0, FEMALE: 0, OTHER: 0 };
  for (const g of genderData ?? []) {
    const key = (g.gender as string) in genderCounts ? (g.gender as keyof typeof genderCounts) : 'OTHER';
    genderCounts[key]++;
  }

  // Category breakdown
  const catMap = new Map<string, { code: string; nameEn: string; count: number }>();
  for (const r of catData ?? []) {
    const ct = Array.isArray(r.card_types) ? r.card_types[0] : r.card_types as any;
    if (!ct) continue;
    if (!catMap.has(ct.code)) {
      catMap.set(ct.code, { code: ct.code, nameEn: ct.name_en, count: 0 });
    }
    catMap.get(ct.code)!.count++;
  }

  // Daily registrations
  const dailyMap = new Map<string, number>();
  for (const d of dailyData ?? []) {
    const date = (d.created_at as string).split('T')[0];
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + 1);
  }
  const dailyRegistrations = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Card stats
  const cardsPrinted = cards.filter((c: any) => c.status === 'PRINTED').length;
  const cardsQueued = cards.filter((c: any) => c.status === 'PRINT_QUEUED').length;
  const totalReprintCount = cards.reduce((sum: number, c: any) => sum + (c.reprint_count ?? 0), 0);
  const specialCards = cards.filter((c: any) => {
    const ct = Array.isArray(c.card_types) ? c.card_types[0] : c.card_types as any;
    return ct && ct.is_registered === false;
  }).length;

  const summary: ReportSummary = {
    totalRegistrations: regs.length,
    approved: countByStatus('APPROVED'),
    underVerification: countByStatus('UNDER_VERIFICATION'),
    correctionRequired: countByStatus('CORRECTION_REQUIRED'),
    rejected: countByStatus('REJECTED'),
    draft: countByStatus('DRAFT'),
    cardsPrinted,
    cardsQueued,
    totalReprintCount,
    specialCards,
    categoryBreakdown: Array.from(catMap.values()).sort((a, b) => b.count - a.count),
    genderBreakdown: genderCounts,
    dailyRegistrations,
  };

  return { summary };
}

/**
 * Fetches all available card type categories for filter dropdown.
 */
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
