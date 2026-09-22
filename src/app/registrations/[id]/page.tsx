'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  User,
  Phone,
  Calendar,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Download,
  Image as ImageIcon,
  Edit3,
  Save,
  X,
  Upload,
  Check,
  Receipt,
  Printer,
} from 'lucide-react';
import { getRegistrationById, updateRegistration, getCardTypes, checkUniqueField } from '@/lib/registrations/actions';
import { verifyRegistrationAction } from '@/lib/verification/actions';
import { getCurrentUserSession } from '@/lib/auth/actions';
import { CR80Card } from '@/components/card-renderer/CR80Card';
import { saveCardAsImage, printCardDirectly } from '@/lib/cards/exportCard';
import { CardType } from '@/types';

export default function RegistrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [categories, setCategories] = useState<CardType[]>([]);
  const [currentRole, setCurrentRole] = useState<string | undefined>(undefined);

  // Rejection & Approval State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejectModalError, setRejectModalError] = useState<string | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Editable Form Fields
  const [editFormNo, setEditFormNo] = useState('');
  const [editReceiptNo, setEditReceiptNo] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editGender, setEditGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [editMobile, setEditMobile] = useState('');
  const [editAltMobile, setEditAltMobile] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPincode, setEditPincode] = useState('');

  // Uniqueness Warning States in Edit Mode
  const [editFormNoWarning, setEditFormNoWarning] = useState<string | null>(null);
  const [checkingEditFormNo, setCheckingEditFormNo] = useState(false);
  const [editReceiptNoWarning, setEditReceiptNoWarning] = useState<string | null>(null);
  const [checkingEditReceiptNo, setCheckingEditReceiptNo] = useState(false);

  // Replaced Documents Base64
  const [newPhotoBase64, setNewPhotoBase64] = useState<string | null>(null);
  const [newPhotoMime, setNewPhotoMime] = useState<string | null>(null);
  const [newProofBase64, setNewProofBase64] = useState<string | null>(null);
  const [newProofMime, setNewProofMime] = useState<string | null>(null);
  const [newProofName, setNewProofName] = useState<string | null>(null);
  const [newFormBase64, setNewFormBase64] = useState<string | null>(null);
  const [newFormMime, setNewFormMime] = useState<string | null>(null);
  const [newFormName, setNewFormName] = useState<string | null>(null);

  const [savingCardImage, setSavingCardImage] = useState(false);
  const [printingCard, setPrintingCard] = useState(false);

  const handleSaveCardImage = async (format: 'png' | 'jpeg') => {
    if (currentRole === 'DATA_ENTRY_OPERATOR') {
      setEditError('Data Entry Operators are not authorized to export or print physical cards.');
      return;
    }
    if (!data) return;
    const el = document.getElementById(`cr80-card-detail-${data.id}`);
    if (!el) return;
    setSavingCardImage(true);
    try {
      const sanitizedName = (data.full_name_en || 'Participant').replace(/[^a-zA-Z0-9_-]/g, '_');
      await saveCardAsImage(el, {
        fileName: `Card-${data.registration_number}-${sanitizedName}`,
        format,
        pixelRatio: 3,
      });
      setSaveSuccess(`Card saved successfully as ${format.toUpperCase()} image!`);
    } catch (err: any) {
      setEditError('Failed to export card image: ' + err.message);
    } finally {
      setSavingCardImage(false);
    }
  };

  const handleDirectPrintCard = async () => {
    if (currentRole === 'DATA_ENTRY_OPERATOR') {
      setEditError('Data Entry Operators are not authorized to print physical cards. Printing is restricted to dedicated Printer Operators.');
      return;
    }
    if (!data) return;
    const el = document.getElementById(`cr80-card-detail-${data.id}`);
    if (!el) return;
    setPrintingCard(true);
    try {
      await printCardDirectly(el);
      setSaveSuccess('Card sent to physical card printer!');
    } catch (err: any) {
      setEditError('Failed to print card: ' + err.message);
    } finally {
      setPrintingCard(false);
    }
  };

  const handleOpenRejectModal = () => {
    if (currentRole === 'DATA_ENTRY_OPERATOR') {
      setEditError('Data Entry Operators are not permitted to reject registrations. Rejections must be performed by a Document Verifier or Admin.');
      return;
    }
    setRejectionRemarks('');
    setRejectModalError(null);
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (currentRole === 'DATA_ENTRY_OPERATOR') {
      setRejectModalError('Data Entry Operators are not permitted to reject registrations.');
      return;
    }
    if (!rejectionRemarks.trim()) {
      setRejectModalError('Rejection remarks are mandatory. Please provide a clear reason.');
      return;
    }
    setRejecting(true);
    setRejectModalError(null);
    try {
      const res = await verifyRegistrationAction({
        registrationId: data.id,
        action: 'REJECT',
        remarks: rejectionRemarks.trim(),
      });
      if (!res.success) {
        setRejectModalError(res.error || 'Failed to reject registration.');
        setRejecting(false);
        return;
      }
      setShowRejectModal(false);
      setSaveSuccess(`Registration ${data.registration_number} rejected successfully.`);
      setTimeout(() => setSaveSuccess(null), 5000);
      const fresh = await getRegistrationById(id);
      if (fresh.success && fresh.registration) {
        setData(fresh.registration);
        setDocuments(fresh.documents || []);
      }
    } catch (err: any) {
      setRejectModalError(err.message || 'An unexpected error occurred.');
    } finally {
      setRejecting(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setEditError(null);
    try {
      const res = await verifyRegistrationAction({
        registrationId: data.id,
        action: 'APPROVE',
        remarks: 'Approved by operator',
      });
      if (!res.success) {
        setEditError(res.error || 'Failed to approve registration.');
        setApproving(false);
        return;
      }
      setSaveSuccess(`Registration ${data.registration_number} verified and approved! Physical pass ready for printing.`);
      setTimeout(() => setSaveSuccess(null), 5000);
      const fresh = await getRegistrationById(id);
      if (fresh.success && fresh.registration) {
        setData(fresh.registration);
        setDocuments(fresh.documents || []);
      }
    } catch (err: any) {
      setEditError(err.message || 'An unexpected error occurred.');
    } finally {
      setApproving(false);
    }
  };

  const populateEditState = (reg: any) => {
    setEditFormNo(reg.physical_form_number || '');
    setEditReceiptNo(reg.receipt_number || '');
    setEditFullName(reg.full_name_en || '');
    setEditGender(reg.gender === 'FEMALE' ? 'FEMALE' : 'MALE');
    setEditMobile(reg.mobile || '');
    setEditAltMobile(reg.alternate_mobile || '');
    setEditCategoryId(reg.category_id || '');
    setEditDob(reg.dob ? reg.dob.split('T')[0] : '');
    setEditAddress(reg.address_en || '');
    setEditCity(reg.city || 'Vasad');
    setEditState(reg.state || 'Gujarat');
    setEditPincode(reg.pincode || '388306');
    setNewPhotoBase64(null);
    setNewProofBase64(null);
    setNewFormBase64(null);
    setEditError(null);
    setEditFormNoWarning(null);
    setEditReceiptNoWarning(null);
  };

  const handleCheckEditFormNo = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setEditFormNoWarning(null);
      return;
    }
    setCheckingEditFormNo(true);
    try {
      const res = await checkUniqueField({
        field: 'physical_form_number',
        value: trimmed,
        excludeId: id,
      });
      if (!res.isUnique) {
        setEditFormNoWarning(`Notice: Existing record found with Form #${trimmed} (${res.conflictingName} - ${res.conflictingRegNo})`);
      } else {
        setEditFormNoWarning(null);
      }
    } catch {
      setEditFormNoWarning(null);
    } finally {
      setCheckingEditFormNo(false);
    }
  };

  const handleEditGenderChange = (newGender: 'MALE' | 'FEMALE') => {
    setEditGender(newGender);
    if (editReceiptNo.trim()) {
      const oldPrefix = newGender === 'MALE' ? 'F' : 'M';
      const newPrefix = newGender === 'MALE' ? 'M' : 'F';
      let formatted = editReceiptNo.trim().toUpperCase();
      if (formatted.startsWith(oldPrefix)) {
        formatted = `${newPrefix}${formatted.slice(oldPrefix.length)}`;
      } else if (!formatted.startsWith(newPrefix)) {
        formatted = `${newPrefix}${formatted}`;
      }
      setEditReceiptNo(formatted);
      handleCheckEditReceiptNo(formatted, newGender);
    }
  };

  const handleEditReceiptChange = (val: string) => {
    const raw = val.toUpperCase();
    if (!raw.trim()) {
      setEditReceiptNo('');
      setEditReceiptNoWarning(null);
      return;
    }
    const prefix = editGender === 'FEMALE' ? 'F' : 'M';
    if (raw === 'M' || raw === 'F') {
      setEditReceiptNo(prefix);
      return;
    }
    let formatted = raw;
    if (formatted.startsWith('M') && editGender === 'FEMALE') {
      formatted = `F${formatted.slice(1)}`;
    } else if (formatted.startsWith('F') && editGender === 'MALE') {
      formatted = `M${formatted.slice(1)}`;
    } else if (!formatted.startsWith(prefix)) {
      formatted = `${prefix}${formatted}`;
    }
    setEditReceiptNo(formatted);
    if (editReceiptNoWarning) setEditReceiptNoWarning(null);
  };

  const handleCheckEditReceiptNo = async (val?: string, overrideGender?: 'MALE' | 'FEMALE') => {
    const g = overrideGender || editGender;
    const currentVal = (val !== undefined ? val : editReceiptNo).trim();
    if (!currentVal) {
      setEditReceiptNoWarning(null);
      return;
    }
    const prefix = g === 'FEMALE' ? 'F' : 'M';
    let formatted = currentVal.toUpperCase();
    if (!formatted.startsWith('M') && !formatted.startsWith('F')) {
      formatted = `${prefix}${formatted}`;
    } else if (formatted.startsWith('M') && g === 'FEMALE') {
      formatted = `F${formatted.slice(1)}`;
    } else if (formatted.startsWith('F') && g === 'MALE') {
      formatted = `M${formatted.slice(1)}`;
    }
    setEditReceiptNo(formatted);

    setCheckingEditReceiptNo(true);
    try {
      const res = await checkUniqueField({
        field: 'receipt_number',
        value: formatted,
        excludeId: id,
      });
      if (!res.isUnique) {
        setEditReceiptNoWarning(`⚠️ Receipt #${formatted} is already assigned to ${res.conflictingName} (${res.conflictingRegNo})`);
      } else {
        setEditReceiptNoWarning(null);
      }
    } catch {
      setEditReceiptNoWarning(null);
    } finally {
      setCheckingEditReceiptNo(false);
    }
  };

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const sess = await getCurrentUserSession();
        setCurrentRole(sess?.roleCode);

        const [res, cats] = await Promise.all([
          getRegistrationById(id),
          getCardTypes(),
        ]);

        setCategories(cats || []);

        if (!res.success || !res.registration) {
          setError(res.error || 'Registration record not found.');
        } else {
          setData(res.registration);
          setDocuments(res.documents || []);
          populateEditState(res.registration);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load registration details.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleStartEdit = () => {
    populateEditState(data);
    setIsEditing(true);
    setSaveSuccess(null);
  };

  const handleCancelEdit = () => {
    populateEditState(data);
    setIsEditing(false);
    setEditError(null);
  };

  const handleFileRead = (
    file: File,
    onSuccess: (base64: string, mime: string, name: string) => void
  ) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      onSuccess(reader.result as string, file.type, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editFormNo.trim()) {
      setEditError('Physical Paper Form Serial Number is mandatory.');
      return;
    }
    if (editReceiptNoWarning) {
      setEditError(editReceiptNoWarning);
      return;
    }
    if (!editFullName.trim()) {
      setEditError('Full Name as per Aadhaar Card is required.');
      return;
    }
    if (!editMobile || editMobile.length < 10) {
      setEditError('A valid 10-digit mobile number is required.');
      return;
    }

    setSaving(true);
    setEditError(null);

    try {
      let finalEditReceiptNo = editReceiptNo.trim() ? editReceiptNo.trim().toUpperCase() : null;
      if (finalEditReceiptNo) {
        const prefix = editGender === 'FEMALE' ? 'F' : 'M';
        if (!finalEditReceiptNo.startsWith('M') && !finalEditReceiptNo.startsWith('F')) {
          finalEditReceiptNo = `${prefix}${finalEditReceiptNo}`;
        } else if (finalEditReceiptNo.startsWith('M') && editGender === 'FEMALE') {
          finalEditReceiptNo = `F${finalEditReceiptNo.slice(1)}`;
        } else if (finalEditReceiptNo.startsWith('F') && editGender === 'MALE') {
          finalEditReceiptNo = `M${finalEditReceiptNo.slice(1)}`;
        }
      }

      const res = await updateRegistration(id, {
        physical_form_number: editFormNo.trim(),
        receipt_number: finalEditReceiptNo,
        full_name_en: editFullName.trim(),
        full_name_gu: editFullName.trim(),
        gender: editGender,
        mobile: editMobile.trim(),
        alternate_mobile: editAltMobile.trim() || null,
        category_id: editCategoryId,
        dob: editDob || null,
        address_en: editAddress.trim(),
        address_gu: editAddress.trim(),
        city: editCity.trim(),
        state: editState.trim(),
        pincode: editPincode.trim(),
        photoBase64: newPhotoBase64 || undefined,
        photoMime: newPhotoMime || undefined,
        proofBase64: newProofBase64 || undefined,
        proofMime: newProofMime || undefined,
        proofFileName: newProofName || undefined,
        formBase64: newFormBase64 || undefined,
        formMime: newFormMime || undefined,
        formFileName: newFormName || undefined,
      });

      if (!res.success) {
        setEditError(res.error || 'Failed to update registration.');
        setSaving(false);
        return;
      }

      // Reload fresh data and exit edit mode
      const fresh = await getRegistrationById(id);
      if (fresh.success && fresh.registration) {
        setData(fresh.registration);
        setDocuments(fresh.documents || []);
      }

      setIsEditing(false);
      setSaveSuccess('Registration updated successfully!');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setEditError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'UNDER_VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
            <Clock className="w-3.5 h-3.5" /> Under Review
          </span>
        );
      case 'CORRECTION_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" /> Correction Required
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
            <FileText className="w-3.5 h-3.5" /> Submitted
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-500 text-sm font-semibold">
          <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span>Loading registration details...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Record Not Found</h2>
          <p className="text-xs text-slate-500 mb-6">{error || 'Unable to find registration record.'}</p>
          <Link
            href="/registrations"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Registrations
          </Link>
        </div>
      </div>
    );
  }

  const photoDoc = documents.find((d) => d.doc_type === 'PHOTOGRAPH');
  const proofDoc = documents.find((d) => d.doc_type === 'IDENTITY_PROOF');
  const formDoc = documents.find((d) => d.doc_type === 'APPLICATION_FORM');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <Link
            href="/registrations"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{data.full_name_en}</h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  data.gender === 'MALE'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-pink-50 text-pink-700 border border-pink-200'
                }`}
              >
                {data.gender}
              </span>
              {getStatusBadge(data.status)}
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Reg No: <span className="font-bold text-blue-600">{data.registration_number}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!isEditing ? (
            <>
              {/* Approval Button if not already approved */}
              {data.status !== 'APPROVED' && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
                  title="Approve registration and generate ID pass"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {approving ? 'Approving...' : data.status === 'REJECTED' ? 'Re-Approve (ફરી મંજૂર)' : 'Approve Pass (મંજૂર કરો)'}
                </button>
              )}

              {/* Rejection Button if not rejected - Strictly Verifier & Admins only, DEO cannot reject */}
              {data.status !== 'REJECTED' && currentRole !== 'DATA_ENTRY_OPERATOR' && ['VERIFIER', 'EVENT_ADMIN', 'SUPER_ADMIN'].includes(currentRole || '') && (
                <button
                  onClick={handleOpenRejectModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition shadow-xs"
                  title="Reject registration with mandatory remarks"
                >
                  <XCircle className="w-4 h-4 text-rose-600" />
                  Reject (અસ્વીકાર)
                </button>
              )}

              {/* Dedicated Print Queue Link for approved passes - DEO is NOT allowed to print */}
              {(data.status === 'APPROVED' || data.status === 'PRINTED') && currentRole !== 'DATA_ENTRY_OPERATOR' && (
                <Link
                  href="/print-queue"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-purple-300 bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 transition shadow-xs"
                  title="Open Dedicated Print Queue"
                >
                  <Printer className="w-4 h-4 text-purple-600" />
                  Print Queue
                </Link>
              )}

              <button
                onClick={handleStartEdit}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-sm"
              >
                <Edit3 className="w-4 h-4" />
                Edit Record
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full p-6 space-y-6 flex-1">
        {saveSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {editError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>{editError}</span>
          </div>
        )}

        {/* Rejection Alert Banner */}
        {data.status === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-200 text-rose-800 flex items-center justify-center shrink-0 mt-0.5">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                  Registration Rejected (અસ્વીકાર થયેલ)
                </h3>
                <p className="text-xs text-rose-800 mt-1">
                  Rejection Reason: <span className="font-semibold">{data.verification_remarks || 'No remarks provided.'}</span>
                </p>
                {data.verifier?.full_name_en && (
                  <p className="text-[11px] text-rose-600 mt-0.5">
                    Processed by: {data.verifier.full_name_en} {data.verified_at ? `(${new Date(data.verified_at).toLocaleString()})` : ''}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition disabled:opacity-50 shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              {approving ? 'Approving...' : 'Re-Approve Registration'}
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW MODE */}
        {/* ========================================================================= */}
        {!isEditing ? (
          <>
            {/* Physical Paper Form Serial & Receipt Number Highlight */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
                    #
                  </div>
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-amber-800 uppercase block">
                      Physical Form Serial
                    </span>
                    <p className="text-xl font-mono font-extrabold text-amber-950">
                      {data.physical_form_number || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="h-8 w-px bg-amber-200 hidden sm:block" />

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center font-bold">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-slate-700 uppercase block">
                      Receipt Number
                    </span>
                    <p className="text-xl font-mono font-extrabold text-slate-900">
                      {data.receipt_number || '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-right text-xs text-amber-800">
                <span className="text-[10px] text-amber-600 uppercase font-bold block">Assigned Category</span>
                <span className="font-bold">{data.card_types?.name_en || 'Participant'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Column 1: Participant Identity Info */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                    <User className="w-4 h-4 text-blue-600" />
                    Participant Information
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Full Name</span>
                      <span className="font-bold text-slate-900 text-sm">{data.full_name_en}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Contact Number</span>
                      <span className="font-mono font-bold text-slate-900 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {data.mobile}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Alternate Mobile</span>
                      <span className="font-mono text-slate-600">
                        {data.alternate_mobile || 'None provided'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Gender</span>
                      <span className="font-bold text-slate-800">{data.gender}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Date of Birth</span>
                      <span className="text-slate-800 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {data.dob || 'Not recorded'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Address & Venue Details */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Residential & Zone Details
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block mb-0.5">Address</span>
                      <p className="text-slate-800 leading-relaxed">{data.address_en}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Area / Zone</span>
                      <span className="font-semibold text-slate-800">{data.area_zone || 'Vasad'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">City / Village</span>
                      <span className="text-slate-800">{data.city || 'Vasad'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">State</span>
                      <span className="text-slate-800">{data.state || 'Gujarat'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Pincode</span>
                      <span className="font-mono text-slate-800">{data.pincode || '388306'}</span>
                    </div>
                  </div>
                </div>

                {/* Verification Audit Details */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    Audit & Verification Trail
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Enrolled By</span>
                      <span className="font-semibold text-slate-800">
                        {data.creator?.full_name_en || 'Data Entry Operator'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Enrolled Timestamp</span>
                      <span className="text-slate-600 font-mono">
                        {new Date(data.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Verified By</span>
                      <span className="font-semibold text-slate-800">
                        {data.verifier?.full_name_en || 'Pending Verification'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Verified At</span>
                      <span className="text-slate-600 font-mono">
                        {data.verified_at ? new Date(data.verified_at).toLocaleString() : '—'}
                      </span>
                    </div>

                    {data.verification_remarks && (
                      <div className="sm:col-span-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                        <span className="font-bold block mb-1">Verification Remarks / Feedback:</span>
                        <p>{data.verification_remarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Column 2: Uploaded Documents Panel & Card Section */}
              <div className="space-y-6">
                {/* Physical CR80 ID Card Preview & Export */}
                {(data.status === 'APPROVED' || data.status === 'PRINTED') && (
                  <div className="bg-white rounded-2xl border border-purple-200 p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Printer className="w-3.5 h-3.5 text-purple-600" />
                          Physical CR80 ID Card
                        </h3>
                        <p className="text-[11px] text-slate-500">Single-sided event pass</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {data.status === 'PRINTED' ? 'Printed' : 'Ready to Print'}
                      </span>
                    </div>

                    <div className="flex justify-center p-2 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
                      <CR80Card
                        key={`cr80-detail-${data.id}-${photoDoc?.signedUrl || 'none'}`}
                        id={`cr80-card-detail-${data.id}`}
                        data={{
                          cardNumber: data.registration_number.replace('NEST-2026-', 'NEST-CARD-'),
                          qrToken: `tok_${data.registration_number}`,
                          holderNameEn: data.full_name_en,
                          categoryEn: data.card_types?.name_en || 'Participant',
                          categoryCode: data.card_types?.code,
                          gender: data.gender,
                          photoUrl: photoDoc?.signedUrl || null,
                          validFrom: '01-Oct-2026',
                          validTo: '12-Oct-2026',
                          receiptNumber: data.receipt_number || null,
                          physicalFormNumber: data.physical_form_number || null,
                          areaZone: data.area_zone || 'East Zone / Vasad',
                          eventNameEn: 'NAVRATRI MAHOTSAV 2026',
                          organizationEn: 'THE NEW ENGLISH SCHOOL TRUST, VASAD',
                        }}
                        theme={
                          data.id_card?.card_themes
                            ? {
                                primaryColor: data.id_card.card_themes.primary_color || '#900B09',
                                headerColor: data.id_card.card_themes.header_color || '#700908',
                                footerColor: data.id_card.card_themes.footer_color || '#700908',
                                accentColor: data.id_card.card_themes.accent_color || '#F59E0B',
                                textColor: data.id_card.card_themes.text_color || '#FFFFFF',
                              }
                            : {
                                primaryColor: '#900B09',
                                headerColor: '#700908',
                                footerColor: '#700908',
                                accentColor: '#F59E0B',
                                textColor: '#FFFFFF',
                              }
                        }
                        scale={0.92}
                      />
                    </div>

                    {currentRole === 'DATA_ENTRY_OPERATOR' ? (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-1">
                        <span className="font-bold text-xs text-amber-900 flex items-center justify-center gap-1.5">
                          <Printer className="w-4 h-4 text-amber-700" />
                          Physical Card Printing Station
                        </span>
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          Data Entry Operators cannot print cards. Physical CR80 passes must be printed by a dedicated Physical Card Printer Operator.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          onClick={() => handleSaveCardImage('png')}
                          disabled={savingCardImage}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-300 bg-purple-50 text-xs font-bold text-purple-700 hover:bg-purple-100 transition shadow-xs disabled:opacity-50"
                          title="Save card as PNG file to print later"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {savingCardImage ? 'Saving...' : 'Save PNG'}
                        </button>

                        <button
                          onClick={() => handleSaveCardImage('jpeg')}
                          disabled={savingCardImage}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
                          title="Save card as JPEG file to print later"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Save JPEG
                        </button>

                        <button
                          onClick={handleDirectPrintCard}
                          disabled={printingCard || savingCardImage}
                          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-purple-600 bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition shadow-xs disabled:opacity-50"
                          title="Send physical CR80 card directly to printer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          {printingCard ? 'Printing...' : 'Print Card'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Candidate Portrait Photo */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
                    Candidate Portrait
                  </h3>

                  {photoDoc?.signedUrl ? (
                    <div className="space-y-3">
                      <div className="w-40 h-48 mx-auto rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm bg-slate-50">
                        <img
                          src={photoDoc.signedUrl}
                          alt="Candidate Portrait"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <a
                        href={photoDoc.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Full Image
                      </a>
                    </div>
                  ) : (
                    <div className="w-40 h-48 mx-auto rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs">
                      <ImageIcon className="w-8 h-8 mb-2" />
                      <span>No Photo Uploaded</span>
                    </div>
                  )}
                </div>

                {/* Identity Proof (Aadhaar Card) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Identity Proof</span>
                    <span className="text-[10px] text-blue-600 lowercase">Aadhaar Card</span>
                  </h3>

                  {proofDoc?.signedUrl ? (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                          {proofDoc.original_filename || 'Aadhaar Card'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {proofDoc.file_size_bytes
                            ? `${(proofDoc.file_size_bytes / 1024).toFixed(0)} KB`
                            : ''}
                        </span>
                      </div>
                      <a
                        href={proofDoc.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        View / Download Proof
                      </a>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                      No Identity Proof Attached
                    </div>
                  )}
                </div>

                {/* Scanned Physical Form */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Physical Application Form</span>
                    <span className="text-[10px] text-amber-600 font-mono">
                      #{data.physical_form_number}
                    </span>
                  </h3>

                  {formDoc?.signedUrl ? (
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                          {formDoc.original_filename || 'Physical Form Scan'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formDoc.file_size_bytes
                            ? `${(formDoc.file_size_bytes / 1024).toFixed(0)} KB`
                            : ''}
                        </span>
                      </div>
                      <a
                        href={formDoc.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-900 hover:bg-amber-200 rounded-lg text-xs font-semibold transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        View / Download Form Scan
                      </a>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                      No Physical Form Scan Attached
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ========================================================================= */
          /* EDIT MODE */
          /* ========================================================================= */
          <form onSubmit={handleSaveEdit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Core Details Edit */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <User className="w-4 h-4 text-blue-600" />
                    Edit Participant Information
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Full Name as per Aadhaar Card <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Primary Contact Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={editMobile}
                        onChange={(e) => setEditMobile(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Alternate Mobile
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={editAltMobile}
                        onChange={(e) => setEditAltMobile(e.target.value.replace(/\D/g, ''))}
                        placeholder="Optional"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Gender <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditGenderChange('MALE')}
                          className={`py-2 rounded-xl text-xs font-bold transition border ${
                            editGender === 'MALE'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Male (M)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditGenderChange('FEMALE')}
                          className={`py-2 rounded-xl text-xs font-bold transition border ${
                            editGender === 'FEMALE'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Female (F)
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Receipt prefix: {editGender === 'FEMALE' ? 'F' : 'M'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={editDob}
                        onChange={(e) => setEditDob(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Physical Form Serial & Receipt Number (Below Gender Option) */}
                    <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-900 mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-blue-700">
                              <FileText className="w-4 h-4 text-blue-600" />
                              Physical Form Serial <span className="text-rose-500">*</span>
                            </span>
                            <span className="text-[10px] text-blue-700 font-semibold bg-blue-100/70 px-2 py-0.5 rounded">
                              Mandatory
                            </span>
                          </label>
                          <input
                            type="text"
                            required
                            value={editFormNo}
                            onChange={(e) => {
                              setEditFormNo(e.target.value.toUpperCase());
                              if (editFormNoWarning) setEditFormNoWarning(null);
                            }}
                            onBlur={() => handleCheckEditFormNo(editFormNo)}
                            placeholder="e.g. FORM-2026-001"
                            className={`w-full text-xs rounded-xl border p-2.5 font-mono font-bold uppercase tracking-wider bg-white focus:outline-none focus:ring-2 ${
                              editFormNoWarning
                                ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/20'
                                : 'border-slate-300 focus:ring-blue-500'
                            }`}
                          />
                          {checkingEditFormNo && (
                            <span className="text-[10px] text-blue-600 mt-1 flex items-center gap-1 font-medium">
                              <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                              Checking database for existing form number...
                            </span>
                          )}
                          {editFormNoWarning && (
                            <span className="text-[11px] text-amber-800 font-semibold mt-1.5 block bg-amber-50 border border-amber-200 p-2 rounded-lg">
                              ⚠️ {editFormNoWarning} (Submission still allowed)
                            </span>
                          )}
                          <p className="text-[10px] text-slate-500 mt-1">
                            Physical paper application form serial number (duplicate entries permitted with notice).
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-900 mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-700">
                              <Receipt className="w-4 h-4 text-slate-600" />
                              Receipt Number
                            </span>
                            <span className="text-[10px] text-slate-600 font-semibold bg-slate-200/70 px-2 py-0.5 rounded">
                              Optional
                            </span>
                          </label>
                          <div className="flex rounded-xl border border-slate-300 overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500">
                            <span
                              className={`px-3 py-2 text-xs font-mono font-bold flex items-center border-r transition select-none ${
                                editGender === 'FEMALE'
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : 'bg-blue-100 text-blue-800 border-blue-200'
                              }`}
                            >
                              {editGender === 'FEMALE' ? 'F' : 'M'}
                            </span>
                            <input
                              type="text"
                              value={editReceiptNo}
                              onChange={(e) => handleEditReceiptChange(e.target.value)}
                              onBlur={() => handleCheckEditReceiptNo()}
                              placeholder={editGender === 'FEMALE' ? 'e.g. F2041 or 2041' : 'e.g. M2041 or 2041'}
                              className={`w-full text-xs p-2.5 font-mono font-bold uppercase tracking-wider bg-transparent focus:outline-none ${
                                editReceiptNoWarning ? 'bg-rose-50/20' : ''
                              }`}
                            />
                          </div>
                          {checkingEditReceiptNo && (
                            <span className="text-[10px] text-blue-600 mt-1 flex items-center gap-1 font-medium">
                              <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                              Checking receipt number uniqueness...
                            </span>
                          )}
                          {editReceiptNoWarning && (
                            <span className="text-[11px] text-rose-600 font-semibold mt-1.5 block bg-rose-50 border border-rose-200 p-2 rounded-lg">
                              {editReceiptNoWarning}
                            </span>
                          )}
                          <p className="text-[10px] text-slate-500 mt-1">
                            Auto-prefixed with <strong className="font-semibold text-slate-700">{editGender === 'FEMALE' ? 'F' : 'M'}</strong> based on gender (saved to DB with prefix).
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Category / Pass Type
                      </label>
                      <select
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name_en}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Residential Address Edit */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Edit Residential Address
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Address
                      </label>
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        City / Village
                      </label>
                      <input
                        type="text"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pincode
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={editPincode}
                        onChange={(e) => setEditPincode(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Replacement Panel */}
              <div className="space-y-6">
                {/* Replace Photo */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Candidate Photo</span>
                    {newPhotoBase64 && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Selected
                      </span>
                    )}
                  </h3>

                  <div className="w-32 h-36 mx-auto rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                    {newPhotoBase64 || photoDoc?.signedUrl ? (
                      <img
                        src={newPhotoBase64 || photoDoc?.signedUrl}
                        alt="Photo Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                    )}
                  </div>

                  <label className="cursor-pointer w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{photoDoc ? 'Replace Photo' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileRead(f, (b, m) => { setNewPhotoBase64(b); setNewPhotoMime(m); });
                      }}
                    />
                  </label>
                </div>

                {/* Replace Aadhaar Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Identity Proof</span>
                    {newProofName && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Selected
                      </span>
                    )}
                  </h3>

                  <p className="text-xs text-slate-500">
                    Current: <span className="font-semibold">{newProofName || proofDoc?.original_filename || 'None'}</span>
                  </p>

                  <label className="cursor-pointer w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{proofDoc ? 'Replace Aadhaar Scan' : 'Upload Aadhaar Scan'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileRead(f, (b, m, n) => {
                          setNewProofBase64(b);
                          setNewProofMime(m);
                          setNewProofName(n);
                        });
                      }}
                    />
                  </label>
                </div>

                {/* Replace Physical Form Scan */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Physical Form Scan</span>
                    {newFormName && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Selected
                      </span>
                    )}
                  </h3>

                  <p className="text-xs text-slate-500">
                    Current: <span className="font-semibold">{newFormName || formDoc?.original_filename || 'None'}</span>
                  </p>

                  <label className="cursor-pointer w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{formDoc ? 'Replace Form Scan' : 'Upload Form Scan'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileRead(f, (b, m, n) => {
                          setNewFormBase64(b);
                          setNewFormMime(m);
                          setNewFormName(n);
                        });
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Bottom Floating Action Bar in Edit Mode */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-md flex items-center justify-between sticky bottom-4 z-20">
              <span className="text-xs text-slate-500 font-semibold">
                Editing Participant Record: <strong className="text-slate-800">{data.registration_number}</strong>
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Rejection Remarks Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Reject Registration (અસ્વીકાર)</h3>
                    <p className="text-[11px] text-slate-500 font-mono">{data.full_name_en} • {data.registration_number}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {rejectModalError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                    {rejectModalError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reason for Rejection * (ફરજિયાત કારણ / ઓડિટ નોંધ)
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionRemarks}
                    onChange={(e) => setRejectionRemarks(e.target.value)}
                    placeholder="Specify why this registration is being rejected (e.g. duplicate form serial, photo unclear, Aadhaar mismatch)..."
                    className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 block mb-1.5 uppercase">Quick Reason Suggestions:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Duplicate Physical Form Number',
                      'Receipt number mismatch',
                      'Photograph unclear or invalid format',
                      'Aadhaar details mismatch',
                      'Applicant requested cancellation',
                      'Incorrect category selected',
                    ].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setRejectionRemarks(reason)}
                        className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  disabled={rejecting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={rejecting || !rejectionRemarks.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {rejecting ? 'Rejecting...' : 'Confirm Rejection (અસ્વીકાર કરો)'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
