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
} from 'lucide-react';
import { getRegistrations } from '@/lib/registrations/actions';
import { getCurrentUserSession } from '@/lib/auth/actions';

export default function RegistrationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(undefined);

  const [registrations, setRegistrations] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const sess = await getCurrentUserSession();
        setCurrentUserRole(sess?.roleCode);

        const data = await getRegistrations();
        if (data && data.length > 0) {
          const mapped = data.map((r: any) => ({
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
            date: new Date(r.created_at).toISOString().split('T')[0],
          }));
          setRegistrations(mapped);
        } else {
          setRegistrations([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filtered = registrations.filter((r) => {
    const matchesSearch =
      r.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.nameGu.includes(searchTerm) ||
      r.mobile.includes(searchTerm) ||
      r.regNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.formNo && r.formNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.receiptNo && r.receiptNo.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
      <main className="max-w-7xl mx-auto w-full p-6 flex-1 space-y-6">
        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Name (Gujarati/English) or Mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_VERIFICATION">Under Review</option>
              <option value="CORRECTION_REQUIRED">Correction Required</option>
              <option value="REJECTED">Rejected</option>
            </select>
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
                {filtered.map((reg) => (
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
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {reg.mobile}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{reg.zone}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(reg.status)}</td>
                    <td className="py-3.5 px-4 text-slate-500">{reg.date}</td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/registrations/${reg.id}`}
                        className="text-blue-600 font-semibold hover:underline"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
