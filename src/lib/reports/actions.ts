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
  search?: string;
}

export type ReportSortKey =
  | 'registrationNumber'
  | 'holderNameEn'
  | 'categoryEn'
  | 'createdAt'
  | 'printCount';

export interface ReportRowsResult {
  rows: ReportRow[];
  /** Total number of records matching the active filters in Postgres. */
  totalCount: number;
  /** Total pages calculated from totalCount and pageSize. */
  totalPages: number;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireAuth() {
  return getCurrentUserSession();
}

// ─── getReportRows (Paginated with Server-Side Search & Sorting) ───────────────

/**
 * Fetches a server-paginated page of registrations joined with id_cards.
 * Supports server-side keyword search (ILIKE), server-side category filtering,
 * status/gender/date filters, and server-side ordering.
 */
export async function getReportRows(
  filters: ReportFilters = {},
  page: number = 1,
  pageSize: number = 50,
  sortKey: ReportSortKey = 'createdAt',
  sortAsc: boolean = false,
  eventId: string = DEFAULT_EVENT_ID
): Promise<ReportRowsResult> {
  const session = await requireAuth();
  if (!session || !canPerformAction(session.roleCode, 'VIEW_REPORTS')) {
    return { rows: [], totalCount: 0, totalPages: 0, error: 'Unauthorized' };
  }

  const supabase = createAdminClient();

  // 1. Resolve Category ID for server-side index-accelerated filtering if specified
  let targetCategoryId: string | null = null;
  if (filters.categoryCode && filters.categoryCode !== 'ALL') {
    const { data: catRecord } = await supabase
      .from('card_types')
      .select('id')
      .eq('event_id', eventId)
      .eq('code', filters.categoryCode)
      .maybeSingle();

    if (catRecord) {
      targetCategoryId = catRecord.id;
    }
  }

  // 2. Base query on registrations with count: 'exact'
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let regQuery = supabase
    .from('registrations')
    .select(
      `
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
    `,
      { count: 'exact' }
    )
    .eq('event_id', eventId);

  // Server-side category filter via foreign key
  if (targetCategoryId) {
    regQuery = regQuery.eq('category_id', targetCategoryId);
  }

  // Server-side status filter
  if (filters.status && filters.status !== 'ALL') {
    regQuery = regQuery.eq('status', filters.status);
  }

  // Server-side gender filter
  if (filters.gender && filters.gender !== 'ALL') {
    regQuery = regQuery.eq('gender', filters.gender);
  }

  // Server-side date range filters
  if (filters.dateFrom) {
    regQuery = regQuery.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setDate(toDate.getDate() + 1);
    regQuery = regQuery.lt('created_at', toDate.toISOString().split('T')[0]);
  }

  // Server-side keyword search across name, gujarati name, mobile, and reg number
  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim();
    regQuery = regQuery.or(
      `full_name_en.ilike.%${s}%,full_name_gu.ilike.%${s}%,mobile.ilike.%${s}%,registration_number.ilike.%${s}%`
    );
  }

  // Server-side sorting
  const sortMap: Record<string, string> = {
    registrationNumber: 'registration_number',
    holderNameEn: 'full_name_en',
    createdAt: 'created_at',
  };

  const dbSortCol = sortMap[sortKey];
  if (dbSortCol) {
    regQuery = regQuery.order(dbSortCol, { ascending: sortAsc });
  } else {
    regQuery = regQuery.order('created_at', { ascending: false });
  }

  // Apply server-side pagination LIMIT & OFFSET
  regQuery = regQuery.range(from, to);

  const { data: regs, count: totalCount, error: regError } = await regQuery;

  if (regError) {
    console.error('[Reports] registrations fetch error:', regError);
    return { rows: [], totalCount: 0, totalPages: 0, error: regError.message };
  }

  if (!regs || regs.length === 0) {
    return { rows: [], totalCount: totalCount ?? 0, totalPages: 0 };
  }

  // 3. Fetch id_cards for only this slice's registrations
  const regIds = regs.map((r: any) => r.id);
  const { data: cards, error: cardError } = await supabase
    .from('id_cards')
    .select('registration_id, card_number, status, metadata')
    .in('registration_id', regIds)
    .eq('event_id', eventId);

  if (cardError) {
    console.error('[Reports] id_cards fetch error:', cardError);
  }

  const cardMap = new Map<string, any>();
  for (const c of cards ?? []) {
    if (!cardMap.has(c.registration_id)) {
      cardMap.set(c.registration_id, c);
    }
  }

  // 4. Map DB records to ReportRow
  let rows: ReportRow[] = regs.map((r: any) => {
    const card = cardMap.get(r.id) ?? null;
    const ct = r.card_types as any;
    const meta = card?.metadata ?? {};
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
      printCount: Number(meta.print_count ?? 0),
      reprintCount: Number(meta.reprint_count ?? 0),
      createdAt: r.created_at,
      verifiedAt: r.verified_at,
    };
  });

  // Client-side sort fallback for join-specific columns (categoryEn, printCount)
  if (sortKey === 'categoryEn') {
    rows.sort((a, b) => (sortAsc ? a.categoryEn.localeCompare(b.categoryEn) : b.categoryEn.localeCompare(a.categoryEn)));
  } else if (sortKey === 'printCount') {
    rows.sort((a, b) => (sortAsc ? a.printCount - b.printCount : b.printCount - a.printCount));
  }

  const serverTotal = totalCount ?? 0;
  const totalPages = Math.ceil(serverTotal / pageSize);

  return { rows, totalCount: serverTotal, totalPages };
}

// ─── exportAllReportRows (Bulk Export of All Matching Filtered Rows) ──────────

/**
 * Fetches all records matching active filters without small pagination.
 * Used exclusively when exporting the entire dataset to CSV.
 */
export async function exportAllReportRows(
  filters: ReportFilters = {},
  eventId: string = DEFAULT_EVENT_ID
): Promise<{ rows: ReportRow[]; totalCount: number; error?: string }> {
  const session = await requireAuth();
  if (!session || !canPerformAction(session.roleCode, 'VIEW_REPORTS')) {
    return { rows: [], totalCount: 0, error: 'Unauthorized' };
  }

  const supabase = createAdminClient();

  let targetCategoryId: string | null = null;
  if (filters.categoryCode && filters.categoryCode !== 'ALL') {
    const { data: catRecord } = await supabase
      .from('card_types')
      .select('id')
      .eq('event_id', eventId)
      .eq('code', filters.categoryCode)
      .maybeSingle();

    if (catRecord) {
      targetCategoryId = catRecord.id;
    }
  }

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
    .order('created_at', { ascending: false })
    .limit(10000); // Safety boundary to prevent catastrophic memory spikes

  if (targetCategoryId) {
    regQuery = regQuery.eq('category_id', targetCategoryId);
  }
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
  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim();
    regQuery = regQuery.or(
      `full_name_en.ilike.%${s}%,full_name_gu.ilike.%${s}%,mobile.ilike.%${s}%,registration_number.ilike.%${s}%`
    );
  }

  const { data: regs, error: regError } = await regQuery;

  if (regError) {
    console.error('[Reports] export registrations fetch error:', regError);
    return { rows: [], totalCount: 0, error: regError.message };
  }

  if (!regs || regs.length === 0) {
    return { rows: [], totalCount: 0 };
  }

  // Fetch all associated id_cards in chunks of 500
  const regIds = regs.map((r: any) => r.id);
  const cardMap = new Map<string, any>();
  const chunkSize = 500;

  for (let i = 0; i < regIds.length; i += chunkSize) {
    const chunk = regIds.slice(i, i + chunkSize);
    const { data: cards } = await supabase
      .from('id_cards')
      .select('registration_id, card_number, status, metadata')
      .in('registration_id', chunk)
      .eq('event_id', eventId);

    for (const c of cards ?? []) {
      if (!cardMap.has(c.registration_id)) {
        cardMap.set(c.registration_id, c);
      }
    }
  }

  const rows: ReportRow[] = regs.map((r: any) => {
    const card = cardMap.get(r.id) ?? null;
    const ct = r.card_types as any;
    const meta = card?.metadata ?? {};
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
      printCount: Number(meta.print_count ?? 0),
      reprintCount: Number(meta.reprint_count ?? 0),
      createdAt: r.created_at,
      verifiedAt: r.verified_at,
    };
  });

  return { rows, totalCount: rows.length };
}

// ─── getReportSummary (PostgreSQL RPC with Graceful Fallback) ──────────────────

/**
 * Fetches aggregate statistics for the KPI cards and chart breakdowns.
 * Uses get_event_report_summary stored procedure when available in Postgres,
 * with automatic fallback to optimized batch queries.
 */
export async function getReportSummary(
  eventId: string = DEFAULT_EVENT_ID
): Promise<{ summary: ReportSummary | null; error?: string }> {
  const session = await requireAuth();
  if (!session || !canPerformAction(session.roleCode, 'VIEW_REPORTS')) {
    return { summary: null, error: 'Unauthorized' };
  }

  const supabase = createAdminClient();

  // 1. Try ultra-fast PostgreSQL Stored Procedure / RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_event_report_summary', {
      p_event_id: eventId,
    });

    if (!rpcError && rpcData && typeof rpcData === 'object') {
      return { summary: rpcData as ReportSummary };
    }
  } catch (_e) {
    // Stored procedure not installed or errored — proceed to seamless fallback
  }

  // 2. Fallback: Optimized direct batch queries
  const [regsRes, cardsRes] = await Promise.all([
    supabase
      .from('registrations')
      .select('id, status, gender, created_at, card_types!category_id(code, name_en)')
      .eq('event_id', eventId),
    supabase
      .from('id_cards')
      .select('status, metadata, card_types!card_type_id(is_registered)')
      .eq('event_id', eventId),
  ]);

  if (regsRes.error) return { summary: null, error: regsRes.error.message };
  if (cardsRes.error) return { summary: null, error: cardsRes.error.message };

  const allRegs = regsRes.data ?? [];
  const allCards = cardsRes.data ?? [];

  const statusCount = (s: string) => allRegs.filter((r: any) => r.status === s).length;

  const gender = { MALE: 0, FEMALE: 0, OTHER: 0 };
  for (const r of allRegs) {
    const g = (r as any).gender as string;
    if (g === 'MALE') gender.MALE++;
    else if (g === 'FEMALE') gender.FEMALE++;
    else gender.OTHER++;
  }

  const catMap = new Map<string, { code: string; nameEn: string; count: number }>();
  for (const r of allRegs) {
    const ct = (r as any).card_types as any;
    if (!ct) continue;
    if (!catMap.has(ct.code)) {
      catMap.set(ct.code, { code: ct.code, nameEn: ct.name_en, count: 0 });
    }
    catMap.get(ct.code)!.count++;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
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

  const cardsPrinted = allCards.filter((c: any) => c.status === 'PRINTED').length;
  const cardsQueued = allCards.filter((c: any) => c.status === 'PRINT_QUEUED').length;
  const totalReprintCount = allCards.reduce(
    (sum, c: any) => sum + Number((c as any).metadata?.reprint_count ?? 0),
    0
  );
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
