'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ZoomIn,
  Eye,
  Lock,
  FileText,
  Receipt,
  MapPin,
  Printer,
} from 'lucide-react';
import { RoleAccessGate } from '@/components/auth/RoleAccessGate';
import { getCurrentUserSession } from '@/lib/auth/actions';
import {
  getPendingVerificationQueue,
  verifyRegistrationAction,
  VerificationItem,
} from '@/lib/verification/actions';

export default function VerificationQueuePage() {
  const [currentRoleCode, setCurrentRoleCode] = useState<string | undefined>(undefined);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Live Queue State
  const [queue, setQueue] = useState<VerificationItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [selectedReg, setSelectedReg] = useState<VerificationItem | null>(null);
  const [feedbackRemarks, setFeedbackRemarks] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchQueue = async () => {
    setLoadingQueue(true);
    setActionError(null);
    try {
      const data = await getPendingVerificationQueue();
      setQueue(data);
      if (data.length > 0) {
        setSelectedReg((prev) => {
          if (!prev) return data[0];
          const found = data.find((d) => d.id === prev.id);
          return found || data[0];
        });
      } else {
        setSelectedReg(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    async function init() {
      const sess = await getCurrentUserSession();
      setCurrentRoleCode(sess?.roleCode);
      setLoadingAuth(false);
      await fetchQueue();
    }
    init();
  }, []);

  const handleAction = async (action: 'APPROVE' | 'REJECT' | 'CORRECTION') => {
    if (!selectedReg) return;

    if (action === 'REJECT' && !feedbackRemarks.trim()) {
      setActionError('Rejection remarks are mandatory. Please specify a reason for rejecting this registration.');
      return;
    }

    if (action === 'CORRECTION' && !feedbackRemarks.trim()) {
      setActionError('Remarks are mandatory when requesting correction. Please specify what needs to be corrected.');
      return;
    }

    setSubmittingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await verifyRegistrationAction({
        registrationId: selectedReg.id,
        action,
        remarks: feedbackRemarks.trim(),
      });

      if (!res.success) {
        setActionError(res.error || 'Failed to complete verification action.');
        setSubmittingAction(false);
        return;
      }

      setActionSuccess(res.message || 'Verification updated successfully!');
      setFeedbackRemarks('');
      await fetchQueue();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'An unexpected error occurred during verification.');
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
          <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span>Verifying operator permissions...</span>
        </div>
      </div>
    );
  }

  return (
    <RoleAccessGate
      currentRoleCode={currentRoleCode}
      allowedRoles={[
        'VERIFIER',
        'EVENT_ADMIN',
        'SUPER_ADMIN',
      ]}
      moduleNameEn="Document Verification Station"
      moduleNameGu="દસ્તાવેજ ચકાસણી કેન્દ્ર"
    >
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
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Document Verification & Approval Station
            </h1>
            <p className="text-xs text-slate-500">
              Identity document review, approval, and rejection workflow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/print-queue"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-300 bg-purple-50 text-xs font-bold text-purple-700 hover:bg-purple-100 transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Queue
          </Link>

          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Verification Active
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Verification Queue */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-1">
              Pending Queue
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              {queue.length} records awaiting verifier review
            </p>

            {loadingQueue ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                <span className="text-xs">Loading pending queue...</span>
              </div>
            ) : queue.length === 0 ? (
              <div className="py-12 px-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-700">All Caught Up!</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  No applications pending review.
                </div>
                <button
                  onClick={fetchQueue}
                  className="mt-3 text-xs text-emerald-600 font-semibold hover:underline"
                >
                  Refresh Queue
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedReg(item)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedReg?.id === item.id
                        ? 'border-emerald-600 ring-2 ring-emerald-100 bg-emerald-50/40'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-600">
                        {item.regNo}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        item.status === 'CORRECTION_REQUIRED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="mt-1.5">
                      <div className="text-sm font-bold text-slate-900">
                        {item.nameEn}
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Mobile: {item.mobile}</span>
                      <span className="font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[10px]">
                        {item.categoryName || 'Participant'}
                      </span>
                    </div>

                    {(item.physicalFormNumber || item.receiptNumber) && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {item.physicalFormNumber && (
                          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            Form #{item.physicalFormNumber}
                          </span>
                        )}
                        {item.receiptNumber && (
                          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                            Rec #{item.receiptNumber}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Inspection Inspector */}
        <div className="lg:col-span-8 space-y-6">
          {actionError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold shadow-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{actionSuccess}</span>
              </div>
              <Link
                href="/print-queue"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 transition shadow-xs text-xs whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save Card Now →
              </Link>
            </div>
          )}

          {selectedReg ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              {/* Top Banner */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {selectedReg.regNo}
                    </span>
                    {selectedReg.physicalFormNumber && (
                      <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded flex items-center gap-1">
                        <FileText className="w-3 h-3 text-amber-600" />
                        Form #{selectedReg.physicalFormNumber}
                      </span>
                    )}
                    {selectedReg.receiptNumber && (
                      <span className="text-xs font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-1 rounded flex items-center gap-1">
                        <Receipt className="w-3 h-3 text-blue-600" />
                        Receipt #{selectedReg.receiptNumber}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {selectedReg.nameEn}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enrolled by: <span className="font-medium text-slate-700">{selectedReg.operatorName || 'Data Entry Operator'}</span>
                  </p>
                </div>

                <div className="text-right flex flex-col items-end gap-1.5">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    {selectedReg.categoryName || 'Participant'}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Gender: <span className="font-bold text-slate-700">{selectedReg.gender}</span>
                  </span>
                </div>
              </div>

              {/* Visual Inspection Viewports: Photo, Aadhaar Proof, and Physical Form */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Candidate Photo Viewport */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Eye className="w-3.5 h-3.5" />
                      1. Candidate Photo
                    </span>
                    <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
                      CR80 Badge
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative aspect-[4/5] flex items-center justify-center group">
                    {selectedReg.photoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={selectedReg.photoUrl}
                        alt="Candidate Photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-xs text-slate-400">No Photo Uploaded</div>
                    )}
                  </div>
                </div>

                {/* 2. Aadhaar Card Copy */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1 text-blue-700">
                      <Eye className="w-3.5 h-3.5" />
                      2. Aadhaar Proof
                    </span>
                    <span className="text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                      Signed Doc
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative aspect-[4/5] flex items-center justify-center group">
                    {selectedReg.proofUrl ? (
                      selectedReg.proofUrl.includes('.pdf') ? (
                        <div className="text-center p-3">
                          <p className="text-xs font-bold text-slate-700 mb-2">Aadhaar PDF</p>
                          <a
                            href={selectedReg.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                          >
                            <ZoomIn className="w-3.5 h-3.5" /> Open PDF
                          </a>
                        </div>
                      ) : (
                        <a
                          href={selectedReg.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full h-full relative block cursor-zoom-in"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedReg.proofUrl}
                            alt="Aadhaar Card"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-semibold gap-1">
                            <ZoomIn className="w-4 h-4" /> Full Size
                          </div>
                        </a>
                      )
                    ) : (
                      <div className="text-xs text-slate-400">No Aadhaar Uploaded</div>
                    )}
                  </div>
                </div>

                {/* 3. Physical Form Copy */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1 text-purple-700">
                      <Eye className="w-3.5 h-3.5" />
                      3. Physical Form
                    </span>
                    <span className="text-[9px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-mono">
                      Signed Form
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative aspect-[4/5] flex items-center justify-center group">
                    {selectedReg.formUrl ? (
                      selectedReg.formUrl.includes('.pdf') ? (
                        <div className="text-center p-3">
                          <p className="text-xs font-bold text-slate-700 mb-2">Form PDF</p>
                          <a
                            href={selectedReg.formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700"
                          >
                            <ZoomIn className="w-3.5 h-3.5" /> Open PDF
                          </a>
                        </div>
                      ) : (
                        <a
                          href={selectedReg.formUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full h-full relative block cursor-zoom-in"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedReg.formUrl}
                            alt="Physical Form"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-semibold gap-1">
                            <ZoomIn className="w-4 h-4" /> Full Size
                          </div>
                        </a>
                      )
                    ) : (
                      <div className="text-xs text-slate-400">No Physical Form</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Demographic Details Check */}
              <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Application Form Data Check
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">FULL NAME</span>
                    <span className="font-bold text-slate-900 text-sm">{selectedReg.nameEn}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">FATHER / HUSBAND NAME</span>
                    <span className="text-slate-800 font-medium">{selectedReg.fatherHusbandEn || '-'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px]">MOBILE</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {selectedReg.mobile}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">DOB</span>
                      <span className="text-slate-800">{selectedReg.dob || '-'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">ZONE / AREA</span>
                    <span className="text-slate-800 font-semibold">{selectedReg.zone}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">CITY / PINCODE</span>
                    <span className="text-slate-800 font-semibold">
                      {[selectedReg.city, selectedReg.pincode].filter(Boolean).join(' - ') || '-'}
                    </span>
                  </div>

                  {selectedReg.addressEn && (
                    <div className="md:col-span-2">
                      <span className="text-slate-400 block text-[10px]">RESIDENTIAL ADDRESS</span>
                      <span className="text-slate-800 leading-relaxed font-medium">
                        {selectedReg.addressEn}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Remarks Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verification Remarks & Audit Notes (ઓડિટ નોંધ)
                </label>
                <textarea
                  rows={2}
                  value={feedbackRemarks}
                  onChange={(e) => setFeedbackRemarks(e.target.value)}
                  placeholder="Enter remarks for approval, or explain reasons if returning for correction or rejecting..."
                  className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction('CORRECTION')}
                    disabled={submittingAction}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition disabled:opacity-50"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Request Correction (સુધારો જરૂરી)
                  </button>

                  <button
                    onClick={() => handleAction('REJECT')}
                    disabled={submittingAction}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs font-semibold hover:bg-rose-100 transition disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Reject (અસ્વીકાર)
                  </button>
                </div>

                <button
                  onClick={() => handleAction('APPROVE')}
                  disabled={submittingAction}
                  className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow transition disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {submittingAction ? 'Processing...' : 'Approve Registration (મંજૂર કરો)'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">No Record Selected</p>
              <p className="text-xs text-slate-400 mt-1">Select an applicant from the left queue to begin verification.</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </RoleAccessGate>
  );
}
