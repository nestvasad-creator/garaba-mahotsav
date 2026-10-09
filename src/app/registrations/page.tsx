'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Search,
  ArrowLeft,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Loader2,
  ShieldCheck,
  XCircle,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { getCurrentUserSession } from '@/lib/auth/actions';

export default function RegistrationsPage() {
  // Search and filter inputs
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Loading and data state
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(undefined);
  const [registrations, setRegistrations] = useState<any[]>([]);

  /**
   * Fetches registrations directly from the database API with search, status, and pagination
   */
  const fetchRegistrations = async (
    targetSearch: string = activeSearch,
    targetStatus: string = statusFilter,
    targetPage: number = page,
    targetLimit: number = pageSize
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (targetSearch.trim()) params.set('search', targetSearch.trim());
      if (targetStatus && targetStatus !== 'ALL') params.set('status', targetStatus);
      params.set('page', targetPage.toString());
      params.set('limit', targetLimit.toString());

      const res = await fetch(`/api/registrations?${params.toString()}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        const mapped = json.data.map((r: any) => ({
          id: r.id,
          regNo: r.registration_number,
          formNo: r.physical_form_number || 'N/A',
          receiptNo: r.receipt_number || null,
          nameEn: r.full_name_en,
          nameGu: r.full_name_gu,
          gender: r.gender,
          mobile: r.mobile,
          zone: r.area_zone || 'Zone A - Vasad',
          category: r.card_types?.name_en || 'Participant',
          status: r.status,
          date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : 'N/A',
        }));
        setRegistrations(mapped);
        const total = json.totalCount ?? json.count ?? mapped.length;
        setTotalCount(total);
        setTotalPages(json.totalPages || Math.ceil(total / targetLimit) || 1);
      } else {
        setRegistrations([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Fetch registrations error:', err);
      setRegistrations([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const sess = await getCurrentUserSession();
        setCurrentUserRole(sess?.roleCode);
      } catch (err) {
        console.error('Session error:', err);
      }
      await fetchRegistrations('', 'ALL', 1, pageSize);
    }
    init();
  }, []);

  /**
   * Search button or form submission triggers query against database API
   */
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = searchInput.trim();
    setActiveSearch(clean);
    setPage(1);
    fetchRegistrations(clean, statusFilter, 1, pageSize);
  };

  /**
   * Clears search query and reloads all records
   */
  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setPage(1);
    fetchRegistrations('', statusFilter, 1, pageSize);
  };

  /**
   * Status filter change directly triggers database search
   */
  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
    fetchRegistrations(activeSearch, newStatus, 1, pageSize);
  };

  /**
   * Page change triggers database fetch for the selected slice
   */
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    fetchRegistrations(activeSearch, statusFilter, newPage, pageSize);
  };

  /**
   * Page size change triggers database fetch
   */
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    fetchRegistrations(activeSearch, statusFilter, 1, newSize);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case 'UNDER_VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
            <Clock className="w-3 h-3" /> Under Review
          </span>
        );
      case 'CORRECTION_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Correction
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
            <FileText className="w-3 h-3" /> Submitted
          </span>
        );
    }
  };

  const fromRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Participant Registrations
            </h1>
            <p className="text-xs text-slate-500">
              Participant registration directory and records monitoring
            </p>
          </div>
        </div>

        {currentUserRole === 'VERIFIER' ? (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verifier View (Read-Only)
            </span>
            <Link
              href="/verification"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition"
            >
              <ShieldCheck className="w-4 h-4" />
              Open Verification Queue →
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {currentUserRole === 'DATA_ENTRY_OPERATOR' && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                DEO Desk
              </span>
            )}
            <Link
              href="/registrations/new"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              New Registration
            </Link>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1 space-y-4">
        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
          >
            {/* Search Input & Submit Button */}
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by Name, Mobile, Reg No, Form No, Receipt No..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-8 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    title="Clear text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Explicit Search Button (Optimized: only triggers DB API when clicked or Enter pressed) */}
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition disabled:opacity-50 shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Search</span>
                  </>
                )}
              </button>

              {activeSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition shrink-0"
                  title="Reset search"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Filter and Refresh */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="APPROVED">Approved</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="UNDER_VERIFICATION">Under Review</option>
                  <option value="CORRECTION_REQUIRED">Correction Required</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => fetchRegistrations(activeSearch, statusFilter, page, pageSize)}
                disabled={loading}
                title="Refresh database records"
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </form>

          {/* Search Metric and Active Filter Indicators */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                {loading ? (
                  <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Querying database...
                  </span>
                ) : (
                  <>
                    Showing <strong className="text-slate-800">{fromRecord}-{toRecord}</strong> of{' '}
                    <strong className="text-slate-800">{totalCount.toLocaleString()}</strong> registrations
                  </>
                )}
              </span>

              {activeSearch && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                  <span>Search: &ldquo;{activeSearch}&rdquo;</span>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="hover:text-blue-900 ml-0.5"
                    title="Remove search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                  <span>Status: {statusFilter}</span>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('ALL')}
                    className="hover:text-amber-900 ml-0.5"
                    title="Clear status filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white focus:outline-none font-medium"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Registrations Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Form / Receipt</th>
                  <th className="py-3 px-4">Reg No</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Gender</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Category / Zone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && registrations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-xs font-semibold text-slate-600">
                          Fetching registrations directly from database...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : registrations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="w-8 h-8 text-slate-300" />
                        <span className="text-sm font-bold text-slate-700">No registrations found</span>
                        <p className="text-xs text-slate-400 max-w-sm">
                          {activeSearch
                            ? `No records matched your search query "${activeSearch}". Try searching with a different name, form number, receipt number, or mobile.`
                            : 'No participant registration records have been entered yet.'}
                        </p>
                        {activeSearch && (
                          <button
                            type="button"
                            onClick={handleClearSearch}
                            className="mt-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold hover:bg-blue-100 transition"
                          >
                            Clear Search Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  registrations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50/75 transition">
                      <td className="py-3.5 px-4 font-mono text-amber-700 bg-amber-50/50">
                        <span className="font-bold">{reg.formNo}</span>
                        {reg.receiptNo && (
                          <span className="block text-[10px] text-slate-500 font-normal">
                            Rec: {reg.receiptNo}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                        {reg.regNo}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {reg.nameEn}
                        </div>
                        {reg.nameGu && reg.nameGu !== reg.nameEn && (
                          <div className="text-[11px] text-slate-500 font-medium">
                            {reg.nameGu}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            reg.gender === 'MALE'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-pink-50 text-pink-700'
                          }`}
                        >
                          {reg.gender}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 font-medium">
                        {reg.mobile}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{reg.zone}</td>
                      <td className="py-3.5 px-4">{getStatusBadge(reg.status)}</td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">{reg.date}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/registrations/${reg.id}`}
                          className="text-blue-600 font-semibold hover:underline"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Bar */}
        {totalCount > 0 && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500">
              Page <strong className="text-slate-800">{page}</strong> of{' '}
              <strong className="text-slate-800">{totalPages}</strong> (
              <strong className="text-slate-800">{totalCount.toLocaleString()}</strong> total records)
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePageChange(1)}
                disabled={page <= 1 || loading}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-semibold"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              <div className="px-3 py-1 font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
                {page} / {totalPages}
              </div>

              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-semibold"
                title="Next page"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(totalPages)}
                disabled={page >= totalPages || loading}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
