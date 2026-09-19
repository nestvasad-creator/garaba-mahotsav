'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Settings,
  ArrowLeft,
  Shield,
  Users,
  Database,
  Calendar,
  CheckCircle2,
  Key,
  Lock,
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'ROLES' | 'EVENT' | 'DATABASE'>('ROLES');

  const roles = [
    {
      code: 'SUPER_ADMIN',
      name: 'Super Administrator',
      desc: 'Complete administrative authority across all events and global settings.',
      usersCount: 1,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    {
      code: 'EVENT_ADMIN',
      name: 'Event Administrator',
      desc: 'Manages event configuration, themes, categories, and verifiers.',
      usersCount: 2,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    {
      code: 'VERIFIER',
      name: 'Verifier (Maker-Checker)',
      desc: 'Inspects identity proofs, validates data, approves or rejects participants.',
      usersCount: 5,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      code: 'DATA_ENTRY_OPERATOR',
      name: 'Data Entry Operator',
      desc: 'Registers participants and uploads proofs. Cannot approve or print cards.',
      usersCount: 8,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      code: 'SPECIAL_ID_OPERATOR',
      name: 'Special ID Operator',
      desc: 'Issues and validates VIP, Guest, Security, and Staff access passes.',
      usersCount: 2,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    },
    {
      code: 'PRINTER_OPERATOR',
      name: 'Printer Operator',
      desc: 'Manages CR80 print queues and logs authorized reprints with justifications.',
      usersCount: 3,
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    },
    {
      code: 'SECURITY',
      name: 'Security Gatekeeper',
      desc: 'Scans QR codes on mobile portal to verify entry validity.',
      usersCount: 12,
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    },
  ];

  const permissionsList = [
    { cat: 'Registration', perms: ['CREATE_REGISTRATION', 'EDIT_REGISTRATION', 'VIEW_REGISTRATION', 'SEARCH_REGISTRATION'] },
    { cat: 'Document Management', perms: ['UPLOAD_DOCUMENT', 'VIEW_DOCUMENT', 'DOWNLOAD_DOCUMENT', 'VERIFY_DOCUMENT', 'REJECT_DOCUMENT'] },
    { cat: 'Approval & Verification', perms: ['APPROVE_REGISTRATION', 'REJECT_REGISTRATION', 'SEND_FOR_CORRECTION', 'OVERRIDE_MAKER_CHECKER'] },
    { cat: 'ID Card & Printing', perms: ['GENERATE_REGISTERED_CARD', 'PRINT_REGISTERED_CARD', 'REPRINT_CARD', 'CANCEL_CARD', 'ISSUE_NON_REGISTERED_CARD', 'PRINT_NON_REGISTERED_ID_CARD', 'MANAGE_CARD_THEMES'] },
    { cat: 'Access Control & QR', perms: ['SCAN_QR', 'VIEW_QR_STATUS', 'VIEW_SCAN_LOG'] },
    { cat: 'Reporting & Audits', perms: ['VIEW_REPORTS', 'EXPORT_REPORTS', 'VIEW_AUDIT_LOG', 'MANAGE_USERS', 'MANAGE_EVENTS'] },
  ];

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
              <Settings className="w-5 h-5 text-slate-700" />
              Settings, RBAC & Event Configuration
            </h1>
            <p className="text-xs text-slate-500">
              User privileges, access control policies, and system configuration
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('ROLES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'ROLES'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Roles & Permissions
          </button>
          <button
            onClick={() => setActiveTab('EVENT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'EVENT'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Event Parameters
          </button>
          <button
            onClick={() => setActiveTab('DATABASE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'DATABASE'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Database & Cloud
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1 space-y-6">
        {activeTab === 'ROLES' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Roles Catalog */}
            <div className="lg:col-span-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Configured System Roles ({roles.length})
              </h3>
              {roles.map((r) => (
                <div
                  key={r.code}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1.5 hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{r.name}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${r.badgeColor}`}>
                      {r.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{r.desc}</p>
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Active Users: {r.usersCount}</span>
                    <span className="text-blue-600 font-medium cursor-pointer hover:underline">
                      Manage Users →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Permissions Matrix Catalog */}
            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-600" />
                  Granular Permissions Catalog (30+ Rules)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Server-side enforced authorization rules
                </p>
              </div>

              <div className="space-y-4">
                {permissionsList.map((sec) => (
                  <div key={sec.cat} className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      {sec.cat}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {sec.perms.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] rounded border border-slate-200"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'EVENT' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Active Event Configuration
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase">Event Code</span>
                <span className="font-bold text-blue-600 font-mono text-sm">NEST</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase">Organization</span>
                <span className="font-semibold text-slate-800">The New English School Trust, Vasad</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase">Event Code / Alias</span>
                <span className="font-bold text-slate-900 font-mono">NAVRATRI-2026</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase">Duration</span>
                <span className="font-medium text-slate-800">01 Oct 2026 - 12 Oct 2026</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'DATABASE' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              Supabase Project Connection Status
            </h3>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Live Project Connected
              </div>
              <p className="font-mono text-[11px] text-emerald-700">
                URL: https://pvzepcjavmuckkkqxzvc.supabase.co
              </p>
              <p className="font-mono text-[11px] text-emerald-700">
                Event Code: nest
              </p>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 pt-2">
              <p className="font-semibold text-slate-800">SQL Schema Installation Reminder:</p>
              <p>
                Run <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">supabase/setup_seed.sql</span> in your Supabase SQL Editor to deploy tables, triggers, RPCs, and storage buckets.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
