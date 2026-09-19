'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, ArrowRight, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { ROLE_DEFINITIONS, SystemRoleCode } from '@/lib/auth/permissions';
import { signOutAction } from '@/lib/auth/actions';

interface RoleAccessGateProps {
  currentRoleCode?: string;
  allowedRoles: SystemRoleCode[];
  moduleNameEn: string;
  moduleNameGu: string;
  children: React.ReactNode;
}

export function RoleAccessGate({
  currentRoleCode,
  allowedRoles,
  moduleNameEn,
  moduleNameGu,
  children,
}: RoleAccessGateProps) {
  // If user has one of the allowed roles, render the content!
  if (currentRoleCode && (allowedRoles.includes(currentRoleCode as SystemRoleCode) || currentRoleCode === 'SUPER_ADMIN')) {
    return <>{children}</>;
  }

  const currentRoleMeta = currentRoleCode
    ? ROLE_DEFINITIONS[currentRoleCode as SystemRoleCode]
    : null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div>
          <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            Role Permission Required
          </span>
          <h2 className="text-xl font-black text-slate-900 mt-2.5">
            Access Restricted: {moduleNameEn}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            You do not have the required role privileges to access this module.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-200 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Your Current Role:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded-md border text-[11px] ${
                currentRoleMeta?.badgeColor || 'bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              {currentRoleMeta ? currentRoleMeta.nameEn : currentRoleCode || 'Guest / Not Logged In'}
            </span>
          </div>

          <div className="border-t border-slate-200 pt-2 text-[11px] text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-1">Required Role(s):</p>
            <div className="flex flex-wrap gap-1.5">
              {allowedRoles.map((role) => (
                <span
                  key={role}
                  className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[10px]"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic pt-1">
            Under role segregation of duties, Data Entry Operators are restricted from rejecting registrations or printing physical cards.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {currentRoleMeta?.primaryPath && (
            <Link
              href={currentRoleMeta.primaryPath}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Go to Your Workspace ({currentRoleMeta.nameEn})</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex-1 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>

            <form action={signOutAction} className="flex-1">
              <button
                type="submit"
                className="w-full py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch User</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
