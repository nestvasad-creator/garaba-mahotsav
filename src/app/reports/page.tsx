'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  ArrowLeft,
  Download,
  Printer,
  Calendar,
  Filter,
  BarChart3,
  CheckCircle,
} from 'lucide-react';
import { exportToCsvWithBom } from '@/lib/gujarati/export';

export default function ReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [feedback, setFeedback] = useState<string | null>(null);

  const reportData = [
    {
      regNo: 'NAV-2026-000101',
      nameGu: 'રાહુલ શાંતિલાલ પટેલ',
      nameEn: 'Rahul Patel',
      category: 'Participant (Male)',
      mobile: '9876543210',
      zone: 'Zone A',
      status: 'APPROVED',
      printStatus: 'PRINTED',
      reprintCount: 0,
    },
    {
      regNo: 'NAV-2026-000102',
      nameGu: 'પૂજા શાહ',
      nameEn: 'Pooja Shah',
      category: 'Participant (Female)',
      mobile: '9825123456',
      zone: 'Zone B',
      status: 'APPROVED',
      printStatus: 'PRINTED',
      reprintCount: 0,
    },
    {
      regNo: 'NAV-2026-000103',
      nameGu: 'અમિત જોશી',
      nameEn: 'Amit Joshi',
      category: 'Participant (Male)',
      mobile: '9426789012',
      zone: 'Zone C',
      status: 'UNDER_VERIFICATION',
      printStatus: 'PENDING',
      reprintCount: 0,
    },
    {
      regNo: 'NAV-VIP-0001',
      nameGu: 'શ્રી નરેન્દ્રભાઈ શાહ (ધારાસભ્ય)',
      nameEn: 'Shri Narendrabhai Shah',
      category: 'VIP (Special Card)',
      mobile: '9824011223',
      zone: 'VIP Lounge',
      status: 'APPROVED',
      printStatus: 'PRINTED',
      reprintCount: 0,
    },
    {
      regNo: 'NAV-SEC-0012',
      nameGu: 'વિજયસિંહ ચાવડા',
      nameEn: 'Vijaysinh Chavda',
      category: 'Security Personnel',
      mobile: '9712345678',
      zone: 'Main Gate 1',
      status: 'APPROVED',
      printStatus: 'PRINTED',
      reprintCount: 1,
    },
  ];

  const handleExportCsv = () => {
    // Generate CSV string
    const headers = [
      'Registration/Card No',
      'Full Name',
      'Category',
      'Mobile',
      'Zone',
      'Verification Status',
      'Print Status',
      'Reprint Count',
    ].join(',');

    const rows = reportData.map((row) =>
      [
        `"${row.regNo}"`,
        `"${row.nameEn}"`,
        `"${row.category}"`,
        `"${row.mobile}"`,
        `"${row.zone}"`,
        `"${row.status}"`,
        `"${row.printStatus}"`,
        row.reprintCount,
      ].join(',')
    );

    const csvContent = `${headers}\n${rows.join('\n')}`;
    exportToCsvWithBom('navratri_2026_id_card_report', csvContent);

    setFeedback('Exported CSV file successfully.');
    setTimeout(() => setFeedback(null), 4000);
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
              <FileSpreadsheet className="w-5 h-5 text-teal-600" />
              Reports & Audit Trails
            </h1>
            <p className="text-xs text-slate-500">
              Comprehensive ledger reports, audit logs, and export station
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1 space-y-6">
        {feedback && (
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold flex items-center gap-2 shadow-sm">
            <CheckCircle className="w-4 h-4 text-teal-600" />
            {feedback}
          </div>
        )}

        {/* Aggregate KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">
              Total Registrations
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">1,248</div>
            <span className="text-[10px] text-emerald-600 font-semibold">
              1,248 Registrations
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">
              Approved & Printed
            </span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">1,180</div>
            <span className="text-[10px] text-slate-400">94.5% Success</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">
              Special / VIP Cards
            </span>
            <div className="text-2xl font-bold text-rose-600 mt-1">142</div>
            <span className="text-[10px] text-slate-400">
              VIP & Guest Passes
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">
              Reprint Audits
            </span>
            <div className="text-2xl font-bold text-amber-600 mt-1">14</div>
            <span className="text-[10px] text-amber-700 font-semibold">
              Controlled & Logged
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Event ID Cards Ledger Summary
            </h3>
            <span className="text-xs text-slate-400">Event: NAV-2026</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Card / Reg No</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Zone</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Print Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((row) => (
                  <tr key={row.regNo} className="hover:bg-slate-50/75 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      {row.regNo}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                      {row.nameEn}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{row.category}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{row.mobile}</td>
                    <td className="py-3 px-4 text-slate-600">{row.zone}</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          row.printStatus === 'PRINTED'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.printStatus}
                      </span>
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
