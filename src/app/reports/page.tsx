'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  ArrowLeft,
  Download,
  BarChart3,
  CheckCircle,
  RefreshCw,
  Users,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Filter,
  Search,
  TrendingUp,
  XCircle,
  Clock,
  RotateCcw,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { exportToCsvWithBom } from '@/lib/gujarati/export';
import {
  getReportRows,
  getReportSummary,
  getReportCategories,
  ReportRow,
  ReportSummary,
  ReportFilters,
} from '@/lib/reports/actions';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    UNDER_VERIFICATION: 'bg-amber-50 text-amber-700 border border-amber-200',
    CORRECTION_REQUIRED: 'bg-orange-50 text-orange-700 border border-orange-200',
    REJECTED: 'bg-red-50 text-red-700 border border-red-200',
    DRAFT: 'bg-slate-100 text-slate-600 border border-slate-200',
    SUBMITTED: 'bg-blue-50 text-blue-700 border border-blue-200',
  };
  return map[status] ?? 'bg-slate-100 text-slate-600';
}

function cardStatusBadge(status: string | null) {
  if (!status) return 'bg-slate-100 text-slate-500 border border-slate-200';
  const map: Record<string, string> = {
    PRINTED: 'bg-purple-50 text-purple-700 border border-purple-200',
    PRINT_QUEUED: 'bg-blue-50 text-blue-700 border border-blue-200',
    APPROVED: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    REPRINTED: 'bg-rose-50 text-rose-700 border border-rose-200',
  };
  return map[status] ?? 'bg-slate-100 text-slate-600';
}

// ─── Mini Bar Chart (sparkline) ───────────────────────────────────────────────

function MiniBarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (!data.length) return <div className="text-xs text-slate-400 py-4 text-center">No data in last 30 days</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const last7 = data.slice(-14); // show last 14 days
  return (
    <div className="flex items-end gap-1 h-14 w-full">
      {last7.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group">
          <div
            className="w-full rounded-t bg-teal-400 group-hover:bg-teal-500 transition-all"
            style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }}
            title={`${d.date}: ${d.count} registrations`}
          />
          <span className="text-[8px] text-slate-400 rotate-45 origin-left hidden sm:block">
            {d.date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</div>
      {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SortKey = 'registrationNumber' | 'holderNameEn' | 'categoryEn' | 'createdAt' | 'printCount';

export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [categories, setCategories] = useState<Array<{ code: string; nameEn: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<ReportFilters>({
    categoryCode: 'ALL',
    status: 'ALL',
    gender: 'ALL',
    dateFrom: '',
    dateTo: '',
  });
  const [searchText, setSearchText] = useState('');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    const res = await getReportSummary();
    if (res.error) setError(res.error);
    else setSummary(res.summary);
    setSummaryLoading(false);
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const activeFilters: ReportFilters = {
      categoryCode: filters.categoryCode !== 'ALL' ? filters.categoryCode : undefined,
      status: filters.status !== 'ALL' ? filters.status : undefined,
      gender: filters.gender !== 'ALL' ? filters.gender : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    };
    const res = await getReportRows(activeFilters);
    if (res.error) setError(res.error);
    else setRows(res.rows);
    setLoading(false);
  }, [filters]);

  const loadCategories = useCallback(async () => {
    const cats = await getReportCategories();
    setCategories(cats);
  }, []);

  useEffect(() => {
    loadSummary();
    loadCategories();
  }, [loadSummary, loadCategories]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // ── Sorting + Search filter ────────────────────────────────────────────────

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? sortAsc
        ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-blue-500" />
        : <ChevronDown className="w-3 h-3 inline ml-0.5 text-blue-500" />
      : null;

  const visibleRows = [...rows]
    .filter((r) => {
      if (!searchText.trim()) return true;
      const q = searchText.toLowerCase();
      return (
        r.holderNameEn.toLowerCase().includes(q) ||
        r.holderNameGu.includes(q) ||
        r.registrationNumber.toLowerCase().includes(q) ||
        (r.mobile ?? '').includes(q) ||
        (r.cardNumber ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sortKey === 'registrationNumber') { av = a.registrationNumber; bv = b.registrationNumber; }
      else if (sortKey === 'holderNameEn') { av = a.holderNameEn; bv = b.holderNameEn; }
      else if (sortKey === 'categoryEn') { av = a.categoryEn; bv = b.categoryEn; }
      else if (sortKey === 'createdAt') { av = a.createdAt; bv = b.createdAt; }
      else if (sortKey === 'printCount') { av = a.printCount; bv = b.printCount; }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  // ── CSV Export ────────────────────────────────────────────────────────────

  const handleExportCsv = () => {
    if (!visibleRows.length) {
      setFeedback('No data to export.');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    const headers = [
      'Registration No',
      'Card No',
      'Full Name (EN)',
      'Full Name (GU)',
      'Category',
      'Gender',
      'Mobile',
      'Area / Zone',
      'City',
      'Verification Status',
      'Card Status',
      'Print Count',
      'Reprint Count',
      'Registered On',
      'Verified On',
    ].join(',');

    const escapeCell = (v: string | number | null | undefined) =>
      `"${String(v ?? '').replace(/"/g, '""')}"`;

    const csvRows = visibleRows.map((r) =>
      [
        escapeCell(r.registrationNumber),
        escapeCell(r.cardNumber ?? '—'),
        escapeCell(r.holderNameEn),
        escapeCell(r.holderNameGu),
        escapeCell(r.categoryEn),
        escapeCell(r.gender),
        escapeCell(r.mobile),
        escapeCell(r.areaZone ?? ''),
        escapeCell(r.city ?? ''),
        escapeCell(r.verificationStatus),
        escapeCell(r.cardStatus ?? 'NOT GENERATED'),
        r.printCount,
        r.reprintCount,
        escapeCell(fmtDate(r.createdAt)),
        escapeCell(fmtDate(r.verifiedAt)),
      ].join(',')
    );

    exportToCsvWithBom(
      `event_report_${new Date().toISOString().split('T')[0]}`,
      `${headers}\n${csvRows.join('\n')}`
    );

    setFeedback(`Exported ${visibleRows.length} rows to CSV successfully.`);
    setTimeout(() => setFeedback(null), 4000);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center space-x-4">
          <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-teal-600" />
              Reports &amp; Analytics
            </h1>
            <p className="text-xs text-slate-500">
              Live data from database — registrations, cards, print audit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadSummary(); loadRows(); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-6 flex-1 space-y-6">

        {/* Feedback */}
        {feedback && (
          <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
            {feedback}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            Error loading data: {error}
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {summaryLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-pulse h-24" />
            ))
          ) : summary ? (
            <>
              <KpiCard label="Total Registrations" value={summary.totalRegistrations} sub="All time" color="text-slate-900" icon={Users} />
              <KpiCard label="Approved" value={summary.approved} sub={`${summary.totalRegistrations > 0 ? Math.round((summary.approved / summary.totalRegistrations) * 100) : 0}% of total`} color="text-emerald-600" icon={CheckCircle} />
              <KpiCard label="Pending Verification" value={summary.underVerification} sub="In review queue" color="text-amber-600" icon={Clock} />
              <KpiCard label="Cards Printed" value={summary.cardsPrinted} sub={`${summary.cardsQueued} in queue`} color="text-purple-600" icon={Printer} />
              <KpiCard label="Special / VIP Cards" value={summary.specialCards} sub="Non-registered" color="text-rose-600" icon={ShieldCheck} />
              <KpiCard label="Reprint Audit" value={summary.totalReprintCount} sub="Controlled & logged" color="text-orange-600" icon={RotateCcw} />
            </>
          ) : null}
        </div>

        {/* ── Secondary Stats Row ── */}
        {summary && !summaryLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Gender Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                Gender Breakdown
              </h4>
              <div className="space-y-2">
                {[
                  { label: 'Male', value: summary.genderBreakdown.MALE, color: 'bg-blue-400' },
                  { label: 'Female', value: summary.genderBreakdown.FEMALE, color: 'bg-pink-400' },
                  { label: 'Other', value: summary.genderBreakdown.OTHER, color: 'bg-slate-300' },
                ].map(({ label, value, color }) => {
                  const total = summary.totalRegistrations || 1;
                  const pct = Math.round((value / total) * 100);
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-600 font-medium">{label}</span>
                        <span className="text-slate-500 font-mono">{value} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Verification Status
              </h4>
              <div className="space-y-1.5 text-xs">
                {[
                  { label: 'Approved', value: summary.approved, color: 'text-emerald-600' },
                  { label: 'Under Verification', value: summary.underVerification, color: 'text-amber-600' },
                  { label: 'Correction Required', value: summary.correctionRequired, color: 'text-orange-600' },
                  { label: 'Rejected', value: summary.rejected, color: 'text-red-600' },
                  { label: 'Draft', value: summary.draft, color: 'text-slate-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-slate-600">{label}</span>
                    <span className={`font-bold font-mono ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Registration Trend */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-500" />
                Daily Registrations (last 14 days)
              </h4>
              <MiniBarChart data={summary.dailyRegistrations} />
            </div>

          </div>
        )}

        {/* ── Category Breakdown ── */}
        {summary && !summaryLoading && summary.categoryBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Registrations by Category
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {summary.categoryBreakdown.map(({ code, nameEn, count }) => (
                <div key={code} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-lg font-bold text-slate-900">{count}</div>
                  <div className="text-xs text-slate-600 font-medium leading-tight mt-0.5">{nameEn}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{code}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-1 text-xs font-bold text-slate-600 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filters
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, mobile, reg no…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-8 pr-3 py-2 w-full rounded-xl border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Category */}
          <select
            value={filters.categoryCode ?? 'ALL'}
            onChange={(e) => setFilters((p) => ({ ...p, categoryCode: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>{c.nameEn}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filters.status ?? 'ALL'}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="UNDER_VERIFICATION">Under Verification</option>
            <option value="CORRECTION_REQUIRED">Correction Required</option>
            <option value="REJECTED">Rejected</option>
            <option value="DRAFT">Draft</option>
          </select>

          {/* Gender */}
          <select
            value={filters.gender ?? 'ALL'}
            onChange={(e) => setFilters((p) => ({ ...p, gender: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="ALL">All Genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>

          {/* Date Range */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              className="px-2 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
              className="px-2 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Clear */}
          <button
            onClick={() => {
              setFilters({ categoryCode: 'ALL', status: 'ALL', gender: 'ALL', dateFrom: '', dateTo: '' });
              setSearchText('');
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 text-xs hover:bg-slate-50 transition flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3" /> Clear
          </button>
        </div>

        {/* ── Data Table ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Registration &amp; Card Ledger
            </h3>
            <div className="flex items-center gap-2">
              {loading && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Loading…
                </span>
              )}
              <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                {visibleRows.length} {visibleRows.length === 1 ? 'record' : 'records'}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
                    onClick={() => handleSort('registrationNumber')}
                  >
                    Reg No <SortIcon k="registrationNumber" />
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-blue-600 select-none"
                    onClick={() => handleSort('holderNameEn')}
                  >
                    Name <SortIcon k="holderNameEn" />
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-blue-600 select-none"
                    onClick={() => handleSort('categoryEn')}
                  >
                    Category <SortIcon k="categoryEn" />
                  </th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Zone</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Card Status</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-blue-600 select-none"
                    onClick={() => handleSort('printCount')}
                  >
                    Prints <SortIcon k="printCount" />
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-blue-600 select-none"
                    onClick={() => handleSort('createdAt')}
                  >
                    Registered <SortIcon k="createdAt" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="h-3 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No records found matching current filters.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.registrationNumber} className="hover:bg-slate-50/75 transition">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {row.registrationNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{row.holderNameEn}</div>
                        <div className="text-[10px] text-slate-400">{row.holderNameGu}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {row.categoryEn}
                        <div className="text-[10px] text-slate-400 font-mono">{row.gender}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{row.mobile}</td>
                      <td className="py-3 px-4 text-slate-600">{row.areaZone ?? '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusBadge(row.verificationStatus)}`}>
                          {row.verificationStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${cardStatusBadge(row.cardStatus)}`}>
                          {row.cardStatus ? row.cardStatus.replace('_', ' ') : 'NO CARD'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-slate-800">{row.printCount}</span>
                        {row.reprintCount > 0 && (
                          <span className="ml-1 text-[9px] text-orange-600 font-bold">
                            +{row.reprintCount}R
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {fmtDate(row.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          {!loading && visibleRows.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
              <span>
                Showing <strong>{visibleRows.length}</strong> records
                {rows.length !== visibleRows.length && ` (filtered from ${rows.length})`}
              </span>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 text-teal-600 font-semibold hover:text-teal-700 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Export {visibleRows.length} rows as CSV
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
