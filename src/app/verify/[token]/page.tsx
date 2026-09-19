import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Calendar,
  CreditCard,
  ArrowLeft,
  User,
  Clock,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { verifyCardByToken } from '@/lib/verify/actions';

interface VerifyPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { token } = await params;
  const result = await verifyCardByToken(token);

  const card = result.card;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6">
      {/* Top Header */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between pb-4 border-b border-slate-800">
        <Link
          href="/scan"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scanner
        </Link>
        <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          {result.gateName}
        </span>
      </div>

      {/* Center Validation Card */}
      <div className="max-w-md mx-auto w-full my-auto py-6">
        {result.valid && card ? (
          <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-3xl p-6 shadow-2xl space-y-6 text-center">
            {/* Status Banner */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              {result.statusText}
            </div>

            {/* Photo */}
            <div className="w-28 h-36 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-md bg-slate-800 flex items-center justify-center">
              {card.photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={card.photoUrl}
                  alt={card.recipientNameEn}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500">
                  <User className="w-12 h-12" />
                  <span className="text-[10px] mt-1">No Photo</span>
                </div>
              )}
            </div>

            {/* Holder Identity */}
            <div>
              <h2 className="text-2xl font-bold text-white leading-tight">
                {card.recipientNameEn}
              </h2>

              <div
                className="mt-3 inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: card.theme?.primaryColor || '#900B09' }}
              >
                {card.categoryEn}
              </div>

              {card.isReprinted && (
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  <RefreshCw className="w-3 h-3" />
                  Reissued Card
                </div>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2 text-left bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Card Serial No
                </span>
                <span className="font-mono font-bold text-white">
                  {card.cardNumber}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Event
                </span>
                <span className="font-medium text-slate-200 truncate block">
                  {card.eventNameEn}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Valid Through
                </span>
                <span className="font-semibold text-emerald-400">
                  {card.validTo}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Scanned At
                </span>
                <span className="font-mono text-slate-300">
                  {new Date(result.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400">
              Valid credential for Navratri Mahotsav 2026.
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border-2 border-rose-500/80 rounded-3xl p-6 shadow-2xl space-y-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold uppercase tracking-wider">
              <XCircle className="w-4 h-4" />
              {result.statusText}
            </div>

            <div className="w-20 h-20 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <AlertCircle className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Access Denied</h2>
              <p className="text-xs text-rose-300 mt-2">
                {result.status === 'EXPIRED'
                  ? 'This credential has expired.'
                  : result.status === 'CANCELLED'
                  ? 'This credential was revoked by the Trust Administration.'
                  : 'QR code does not correspond to any active credential in the system.'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Security Alert: Do not grant access.
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl text-xs font-mono text-slate-400">
              Token: {token}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer */}
      <div className="max-w-md mx-auto w-full text-center text-[10px] text-slate-500 pb-2">
        Secured Verification Service • NEST Vasad • Turnstile Gate Scan
      </div>
    </div>
  );
}
