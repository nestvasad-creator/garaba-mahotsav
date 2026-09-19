'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Award,
  ArrowLeft,
  ShieldAlert,
  Plus,
  Lock,
  Printer,
  User,
  CheckCircle2,
  RefreshCw,
  Upload,
  AlertCircle,
  Phone,
  Briefcase,
} from 'lucide-react';
import { RoleAccessGate } from '@/components/auth/RoleAccessGate';
import { getCurrentUserSession } from '@/lib/auth/actions';
import {
  getSpecialCardCategories,
  getSpecialCardsList,
  issueSpecialCard,
  SpecialCardItem,
} from '@/lib/cards/special-actions';
import { CardType } from '@/types';

export default function SpecialCardsPage() {
  const [currentRoleCode, setCurrentRoleCode] = useState<string | undefined>(undefined);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Live Data State
  const [specialCards, setSpecialCards] = useState<SpecialCardItem[]>([]);
  const [categories, setCategories] = useState<CardType[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [showIssueModal, setShowIssueModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [issuing, setIssuing] = useState(false);

  // Form State
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [recipientNameEn, setRecipientNameEn] = useState('');
  const [recipientMobile, setRecipientMobile] = useState('');
  const [designation, setDesignation] = useState('');
  const [organization, setOrganization] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [validDays, setValidDays] = useState('ALL_EVENT');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [cats, cards] = await Promise.all([
        getSpecialCardCategories(),
        getSpecialCardsList(),
      ]);
      setCategories(cats);
      setSpecialCards(cards);
      if (cats.length > 0 && !selectedCategoryId) {
        // Prefer CREW or SPONSOR if available
        const defaultCat = cats.find((c) => c.code === 'CREW') || cats.find((c) => c.code === 'SPONSOR') || cats[0];
        setSelectedCategoryId(defaultCat.id);
      }
    } catch (err) {
      console.error('Failed to load special cards:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    async function init() {
      const sess = await getCurrentUserSession();
      setCurrentRoleCode(sess?.roleCode);
      setLoadingAuth(false);
      await loadData();
    }
    init();
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoBase64(reader.result as string);
      setPhotoMime(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleIssueCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId || !recipientNameEn.trim()) {
      setFeedback({ type: 'error', message: 'Please select a category and provide the recipient name.' });
      return;
    }

    setIssuing(true);
    setFeedback(null);

    try {
      const res = await issueSpecialCard({
        cardTypeId: selectedCategoryId,
        recipientNameEn: recipientNameEn.trim(),
        recipientNameGu: recipientNameEn.trim(),
        recipientMobile: recipientMobile.trim() || undefined,
        designation: designation.trim() || undefined,
        organization: organization.trim() || undefined,
        gender,
        validTo: validDays === 'SINGLE_DAY' ? '2026-10-02T00:00:00Z' : '2026-10-13T00:00:00Z',
        photoBase64: photoBase64 || undefined,
        photoMime: photoMime || undefined,
      });

      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Failed to issue special card.' });
        setIssuing(false);
        return;
      }

      setFeedback({ type: 'success', message: res.message || 'Special pass issued successfully!' });
      setShowIssueModal(false);
      // Reset form
      setRecipientNameEn('');
      setRecipientMobile('');
      setDesignation('');
      setOrganization('');
      setPhotoBase64(null);
      await loadData();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'An unexpected error occurred.' });
    } finally {
      setIssuing(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
          <div className="w-4 h-4 rounded-full border-2 border-rose-600 border-t-transparent animate-spin" />
          <span>Verifying special authorization permissions...</span>
        </div>
      </div>
    );
  }

  return (
    <RoleAccessGate
      currentRoleCode={currentRoleCode}
      allowedRoles={['SPECIAL_ID_OPERATOR', 'EVENT_ADMIN', 'SUPER_ADMIN']}
      moduleNameEn="Special / Non-Registered ID Passes"
      moduleNameGu="Special Passes Authorization"
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
                <Award className="w-5 h-5 text-rose-600" />
                Controlled Special & Non-Registered ID Cards
              </h1>
              <p className="text-xs text-slate-500">
                Sponsor, Crew, Security, and Volunteer Passes Desk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loadingData}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title="Refresh Pass List"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowIssueModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Issue Special Access Card
            </button>
          </div>
        </header>

        {/* Main Container */}
        <main className="max-w-7xl mx-auto w-full p-6 flex-1 space-y-6">
          {feedback && (
            <div
              className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              {feedback.message}
            </div>
          )}

          {/* Security Rule Warning Banner */}
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Server-Side Authorization Ledger (GENERATE_SPECIAL_CARD)
              </h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Special cards bypass regular participant registration. Every pass issued here is stamped with operator ID, automatically queued for the printing desk, and validated in real time by the Turnstile QR Scanners.
              </p>
            </div>
          </div>

          {/* Special Cards Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Active Special Cards Ledger</h3>
                <p className="text-xs text-slate-500">Live passes enrolled via Special ID Operator desk</p>
              </div>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg border border-slate-200">
                Total Passes: {specialCards.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Card No / QR</th>
                    <th className="py-3 px-4">Recipient Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Issued By</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingData ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                          <span>Loading issued special passes...</span>
                        </div>
                      </td>
                    </tr>
                  ) : specialCards.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="max-w-xs mx-auto text-center space-y-2">
                          <Award className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="font-semibold text-slate-700">No Special Passes Issued Yet</p>
                          <p className="text-[11px] text-slate-500">
                            Click &quot;Issue Special Access Pass&quot; above to create Sponsor, Crew, or Security badges.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    specialCards.map((card) => (
                      <tr key={card.id} className="hover:bg-slate-50/75 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-rose-600">
                          {card.cardNumber}
                          <span className="block text-[10px] text-slate-400 font-normal font-mono truncate max-w-[120px]">
                            {card.qrToken}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            {card.recipientPhotoUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={card.recipientPhotoUrl}
                                alt={card.recipientNameEn}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
                                <User className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900">{card.recipientNameEn}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                            {card.categoryNameEn}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono">
                          {card.recipientMobile || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {card.issuerName}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> {card.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href="/print-queue"
                            className="text-purple-600 font-semibold hover:underline inline-flex items-center gap-1 text-xs"
                          >
                            <Printer className="w-3.5 h-3.5" /> Print Queue
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Issue Special Card Modal */}
        {showIssueModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-rose-600" />
                  Issue Special Access Pass
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold">
                  AUDITED ACTION
                </span>
              </div>

              <form onSubmit={handleIssueCard} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Card Category
                  </label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name_en} ({cat.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Dignitary / Recipient Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shri Narendra Patel"
                    value={recipientNameEn}
                    onChange={(e) => setRecipientNameEn(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="9876543210"
                      value={recipientMobile}
                      onChange={(e) => setRecipientMobile(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Gender Theme Rule
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'MALE' | 'FEMALE')}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="MALE">Male (Standard Theme)</option>
                      <option value="FEMALE">Female (Pink Accent Theme)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Designation / Role
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chief Trustee / MLA"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Validity Period
                    </label>
                    <select
                      value={validDays}
                      onChange={(e) => setValidDays(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="ALL_EVENT">All 10 Days (1-Oct to 12-Oct)</option>
                      <option value="SINGLE_DAY">Single Day Access</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Attach Photo (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-rose-500 hover:bg-rose-50/50 text-xs text-slate-600 transition">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span>{photoBase64 ? 'Photo Attached (Click to change)' : 'Upload Passport Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    {photoBase64 && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={photoBase64}
                        alt="Preview"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-300 shadow-sm"
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    disabled={issuing}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={issuing}
                    className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {issuing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Issuing Pass...</span>
                      </>
                    ) : (
                      <span>Authorize & Issue Card</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RoleAccessGate>
  );
}
