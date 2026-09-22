'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { checkDuplicateRegistration, checkUniqueField, createRegistration, getCardTypes } from '@/lib/registrations/actions';
import { RoleAccessGate } from '@/components/auth/RoleAccessGate';
import { getCurrentUserSession } from '@/lib/auth/actions';
import { CardType } from '@/types';
import {
  ArrowLeft,
  Upload,
  User,
  AlertCircle,
  Save,
  Send,
  FileCheck,
  FileText,
  CheckCircle,
  Image as ImageIcon,
  Check,
  Hash,
  Layers,
  Receipt,
  MapPin,
} from 'lucide-react';

export default function NewRegistrationPage() {
  const router = useRouter();
  const [currentRoleCode, setCurrentRoleCode] = useState<string | undefined>(undefined);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Categories / Card Types
  const [categories, setCategories] = useState<CardType[]>([]);
  const [categoryId, setCategoryId] = useState<string>('10000000-0000-0000-0000-000000000001');

  useEffect(() => {
    async function loadData() {
      const sess = await getCurrentUserSession();
      setCurrentRoleCode(sess?.roleCode);
      const cats = await getCardTypes();
      if (cats && cats.length > 0) {
        setCategories(cats);
        const defaultCat = cats.find((c) => c.code === 'REG_PARTICIPANT') || cats[0];
        setCategoryId(defaultCat.id);
      }
      setLoadingAuth(false);
    }
    loadData();
  }, []);

  // Form Inputs (Aadhaar Name, Mobile, Category, Gender, Physical Form Serial No., Receipt No, Address)
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [mobile, setMobile] = useState('');
  const [formSerialNo, setFormSerialNo] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Vasad');
  const [pincode, setPincode] = useState('388306');

  // Duplicate Warning State
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // 1. Candidate Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);

  // 2. Aadhaar Card Copy
  const [idProofFilename, setIdProofFilename] = useState<string | null>(null);
  const [idProofBase64, setIdProofBase64] = useState<string | null>(null);
  const [idProofMime, setIdProofMime] = useState<string | null>(null);
  const [idProofSize, setIdProofSize] = useState<string | null>(null);

  // 3. Physical Filled-Up Form Copy / Scan
  const [formFilename, setFormFilename] = useState<string | null>(null);
  const [formBase64, setFormBase64] = useState<string | null>(null);
  const [formMime, setFormMime] = useState<string | null>(null);
  const [formSize, setFormSize] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Uniqueness Warning States
  const [formNoWarning, setFormNoWarning] = useState<string | null>(null);
  const [checkingFormNo, setCheckingFormNo] = useState(false);
  const [receiptNoWarning, setReceiptNoWarning] = useState<string | null>(null);
  const [checkingReceiptNo, setCheckingReceiptNo] = useState(false);

  const handleCheckFormNo = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setFormNoWarning(null);
      return;
    }
    setCheckingFormNo(true);
    try {
      const res = await checkUniqueField({
        field: 'physical_form_number',
        value: trimmed,
      });
      if (!res.isUnique) {
        setFormNoWarning(`Notice: Existing record found with Form #${trimmed} (${res.conflictingName} - ${res.conflictingRegNo})`);
      } else {
        setFormNoWarning(null);
      }
    } catch {
      setFormNoWarning(null);
    } finally {
      setCheckingFormNo(false);
    }
  };

  const handleGenderChange = (newGender: 'MALE' | 'FEMALE') => {
    setGender(newGender);
    if (receiptNo.trim()) {
      const oldPrefix = newGender === 'MALE' ? 'F' : 'M';
      const newPrefix = newGender === 'MALE' ? 'M' : 'F';
      let formatted = receiptNo.trim().toUpperCase();
      if (formatted.startsWith(oldPrefix)) {
        formatted = `${newPrefix}${formatted.slice(oldPrefix.length)}`;
      } else if (!formatted.startsWith(newPrefix)) {
        formatted = `${newPrefix}${formatted}`;
      }
      setReceiptNo(formatted);
      handleCheckReceiptNo(formatted, newGender);
    }
  };

  const handleReceiptChange = (val: string) => {
    const raw = val.toUpperCase();
    if (!raw.trim()) {
      setReceiptNo('');
      setReceiptNoWarning(null);
      return;
    }
    const prefix = gender === 'FEMALE' ? 'F' : 'M';
    if (raw === 'M' || raw === 'F') {
      setReceiptNo(prefix);
      return;
    }
    let formatted = raw;
    if (formatted.startsWith('M') && gender === 'FEMALE') {
      formatted = `F${formatted.slice(1)}`;
    } else if (formatted.startsWith('F') && gender === 'MALE') {
      formatted = `M${formatted.slice(1)}`;
    } else if (!formatted.startsWith(prefix)) {
      formatted = `${prefix}${formatted}`;
    }
    setReceiptNo(formatted);
    if (receiptNoWarning) setReceiptNoWarning(null);
  };

  const handleCheckReceiptNo = async (val?: string, overrideGender?: 'MALE' | 'FEMALE') => {
    const g = overrideGender || gender;
    const currentVal = (val !== undefined ? val : receiptNo).trim();
    if (!currentVal) {
      setReceiptNoWarning(null);
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
    setReceiptNo(formatted);

    setCheckingReceiptNo(true);
    try {
      const res = await checkUniqueField({
        field: 'receipt_number',
        value: formatted,
      });
      if (!res.isUnique) {
        setReceiptNoWarning(`⚠️ Receipt #${formatted} already registered with ${res.conflictingName} (${res.conflictingRegNo})`);
      } else {
        setReceiptNoWarning(null);
      }
    } catch {
      setReceiptNoWarning(null);
    } finally {
      setCheckingReceiptNo(false);
    }
  };

  // Real-time duplicate check when mobile leaves focus
  const handleMobileBlur = async () => {
    if (mobile.length === 10) {
      setIsCheckingDuplicate(true);
      try {
        const result = await checkDuplicateRegistration(mobile);
        if (result.isDuplicate && result.matchedRecord) {
          setDuplicateWarning(
            `Notice: Existing record found (${result.matchedRecord.registrationNumber} - ${result.matchedRecord.fullNameEn}, Status: ${result.matchedRecord.status})`
          );
        } else {
          setDuplicateWarning(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsCheckingDuplicate(false);
      }
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoMime(file.type);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIdProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdProofFilename(file.name);
      setIdProofMime(file.type);
      setIdProofSize(`${(file.size / 1024).toFixed(1)} KB`);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdProofBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFormUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormFilename(file.name);
      setFormMime(file.type);
      setFormSize(`${(file.size / 1024).toFixed(1)} KB`);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const selectedCat = categories.find((c) => c.id === categoryId);
  const isSponsor =
    selectedCat?.code === 'SPONSOR' ||
    selectedCat?.name_en?.toUpperCase().includes('SPONSOR');
  const isCrew =
    selectedCat?.code === 'CREW' ||
    selectedCat?.name_en?.toUpperCase().includes('CREW');

  const requiresForm = !isSponsor;
  const requiresPhoto = !isSponsor && !isCrew;

  const handleSubmit = async (e: React.FormEvent, status: 'DRAFT' | 'SUBMITTED') => {
    e.preventDefault();

    if (requiresForm && !formSerialNo.trim()) {
      setErrorMessage('Physical Paper Form Serial Number is mandatory.');
      return;
    }

    if (receiptNoWarning) {
      setErrorMessage(receiptNoWarning);
      return;
    }

    if (!fullName.trim()) {
      setErrorMessage('Full Name as per Aadhaar Card is required.');
      return;
    }

    if (!mobile || mobile.length < 10) {
      setErrorMessage('A valid 10-digit mobile number is required.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const pMime = photoPreview ? photoMime || photoPreview.substring(5, photoPreview.indexOf(';')) : undefined;

      let finalReceiptNo = receiptNo.trim() ? receiptNo.trim().toUpperCase() : undefined;
      if (finalReceiptNo) {
        const prefix = gender === 'FEMALE' ? 'F' : 'M';
        if (!finalReceiptNo.startsWith('M') && !finalReceiptNo.startsWith('F')) {
          finalReceiptNo = `${prefix}${finalReceiptNo}`;
        } else if (finalReceiptNo.startsWith('M') && gender === 'FEMALE') {
          finalReceiptNo = `F${finalReceiptNo.slice(1)}`;
        } else if (finalReceiptNo.startsWith('F') && gender === 'MALE') {
          finalReceiptNo = `M${finalReceiptNo.slice(1)}`;
        }
      }

      const res = await createRegistration({
        category_id: categoryId,
        physical_form_number: formSerialNo.trim(),
        receipt_number: finalReceiptNo,
        full_name_en: fullName.trim(),
        full_name_gu: fullName.trim(),
        gender,
        mobile: mobile.trim(),
        area_zone: `Form #${formSerialNo.trim()}`,
        address_en: address.trim() || 'As per physical application form / Vasad',
        address_gu: address.trim() || 'As per physical application form / Vasad',
        city: city.trim() || 'Vasad',
        pincode: pincode.trim() || '388306',
        status,
        photoBase64: photoPreview || undefined,
        photoMime: pMime,
        proofBase64: idProofBase64 || undefined,
        proofMime: idProofMime || undefined,
        proofFileName: idProofFilename || undefined,
        formBase64: formBase64 || undefined,
        formMime: formMime || undefined,
        formFileName: formFilename || undefined,
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.error || 'Failed to create registration');
        setSubmitting(false);
        return;
      }

      setSuccessMessage(
        status === 'SUBMITTED'
          ? `Registration submitted successfully! Assigned Reg No: ${res.data.registration_number}`
          : 'Registration draft saved successfully.'
      );

      setTimeout(() => {
        router.push('/registrations');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
          <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span>Checking operator authorization...</span>
        </div>
      </div>
    );
  }

  return (
    <RoleAccessGate
      currentRoleCode={currentRoleCode}
      allowedRoles={['DATA_ENTRY_OPERATOR', 'EVENT_ADMIN']}
      moduleNameEn="Participant Registration Desk"
      moduleNameGu="Participant Registration Desk"
    >
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
              <h1 className="text-lg font-bold text-slate-900">
                Participant Enrollment Desk
              </h1>
              <p className="text-xs text-slate-500">
                Aadhaar name, contact number, category, gender, and document attachments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              DEO Fast Entry
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto w-full p-6 flex-1">
          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              {errorMessage}
            </div>
          )}

          {duplicateWarning && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Duplicate Mobile Warning</p>
                <p className="mt-1 leading-relaxed">{duplicateWarning}</p>
                <p className="mt-1 text-[11px] text-amber-700">
                  Please verify the applicant identity before proceeding to avoid issuing double ID cards.
                </p>
              </div>
            </div>
          )}

          {formNoWarning && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Duplicate Physical Form Notice</p>
                <p className="mt-1 leading-relaxed">{formNoWarning}</p>
                <p className="mt-1 text-[11px] text-amber-700">
                  Multiple registrations may share the same physical form number (e.g. family members or group forms). Submission is permitted.
                </p>
              </div>
            </div>
          )}

          <form className="space-y-6">
            {/* Section 1: Member Primary Data */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    1. Physical Paper Form & Member Information
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Physical form serial number is mandatory for cross-referencing physical paper records
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                  Mandatory Fields
                </span>
              </div>

              {/* Full Name Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name (as per Aadhaar Card) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PATEL RAHULKUMAR MAHESHBHAI"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value.toUpperCase())}
                  className="w-full text-xs rounded-xl border border-slate-300 p-3 font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Name will be printed on the front of the CR80 physical ID badge
                </span>
              </div>

              {/* Row 2: Mobile Number & Category Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                {/* Mobile */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile / Contact Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      maxLength={10}
                      required
                      placeholder="10-digit mobile (e.g. 9876543210)"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                      onBlur={handleMobileBlur}
                      className="w-full text-xs rounded-xl border border-slate-300 p-3 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {isCheckingDuplicate && (
                      <div className="absolute right-3 top-3">
                        <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Checked automatically for duplicate entry
                  </span>
                </div>

                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      Participant Category / Pass Type <span className="text-rose-500">*</span>
                    </span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name_en}
                        </option>
                      ))
                    ) : (
                      <option value="10000000-0000-0000-0000-000000000001">
                        Participant
                      </option>
                    )}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Assigns participant tier and venue access permissions
                  </span>
                </div>
              </div>

              {/* Row 3: Gender Selection */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleGenderChange('MALE')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-2 ${
                      gender === 'MALE'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {gender === 'MALE' && <Check className="w-3.5 h-3.5 text-white" />}
                    <span>Male (M)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGenderChange('FEMALE')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-2 ${
                      gender === 'FEMALE'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {gender === 'FEMALE' && <Check className="w-3.5 h-3.5 text-white" />}
                    <span>Female (F)</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Receipt number is auto-prefixed with M for Male and F for Female
                </span>
              </div>

              {/* Row 4: Physical Paper Form Serial Number & Receipt Number (Below Gender Option) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Field 1: Physical Paper Form Serial Number (Mandatory except Sponsor) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-blue-700">
                        <Hash className="w-4 h-4 text-blue-600" />
                        Physical Form Serial Number {requiresForm && <span className="text-rose-500">*</span>}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        requiresForm ? 'text-blue-700 bg-blue-100/70' : 'text-slate-600 bg-slate-100'
                      }`}>
                        {requiresForm ? 'Mandatory' : 'Optional (Sponsor)'}
                      </span>
                    </label>
                    <input
                      type="text"
                      required={requiresForm}
                      placeholder={requiresForm ? "e.g. FORM-0842, B-104, or 00125" : "Optional for Sponsor"}
                      value={formSerialNo}
                      onChange={(e) => {
                        setFormSerialNo(e.target.value.toUpperCase());
                        if (formNoWarning) setFormNoWarning(null);
                      }}
                      onBlur={() => handleCheckFormNo(formSerialNo)}
                      className={`w-full text-xs rounded-xl border p-3 font-mono font-bold uppercase tracking-wider bg-white focus:outline-none focus:ring-2 ${
                        formNoWarning
                          ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/20'
                          : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    />
                    {checkingFormNo && (
                      <span className="text-[10px] text-blue-600 mt-1 flex items-center gap-1 font-medium">
                        <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                        Checking database for existing form number...
                      </span>
                    )}
                    {formNoWarning && (
                      <span className="text-[11px] text-amber-800 font-semibold mt-1.5 block bg-amber-50 border border-amber-200 p-2 rounded-lg">
                        ⚠️ {formNoWarning} (Submission still allowed)
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Physical paper application form serial number (duplicate entries permitted with notice)
                    </span>
                  </div>

                  {/* Field 2: Receipt Number (Auto-prefixed with M for Male, F for Female) */}
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
                        className={`px-3 py-2.5 text-xs font-mono font-bold flex items-center border-r transition select-none ${
                          gender === 'FEMALE'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}
                      >
                        {gender === 'FEMALE' ? 'F' : 'M'}
                      </span>
                      <input
                        type="text"
                        placeholder={gender === 'FEMALE' ? 'e.g. F2041 or 2041' : 'e.g. M2041 or 2041'}
                        value={receiptNo}
                        onChange={(e) => handleReceiptChange(e.target.value)}
                        onBlur={() => handleCheckReceiptNo()}
                        className={`w-full text-xs p-3 font-mono font-bold uppercase tracking-wider bg-transparent focus:outline-none ${
                          receiptNoWarning ? 'bg-rose-50/20' : ''
                        }`}
                      />
                    </div>
                    {checkingReceiptNo && (
                      <span className="text-[10px] text-blue-600 mt-1 flex items-center gap-1 font-medium">
                        <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                        Verifying uniqueness of receipt number...
                      </span>
                    )}
                    {receiptNoWarning && (
                      <span className="text-[11px] text-rose-600 font-semibold mt-1.5 block bg-rose-50 border border-rose-200 p-2 rounded-lg">
                        {receiptNoWarning}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Auto-prefixed with <strong className="font-semibold text-slate-700">{gender === 'FEMALE' ? 'F' : 'M'}</strong> based on gender (saved to DB with prefix)
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 4: Residential Address (Below Gender) */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    Residential Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Society / Flat / Street, House No., Vasad"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Permanent or current residential address of the applicant
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City / Village
                    </label>
                    <input
                      type="text"
                      placeholder="Vasad"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pincode
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="388306"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Document & Photo Uploads */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900">
                  2. Document Attachments
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Attach the physical application form, Aadhaar card copy, and candidate portrait
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Physical Form Upload (Optional) */}
                <div className="border border-slate-200 rounded-2xl p-4 flex flex-col justify-between bg-slate-50/50 hover:border-purple-300 transition">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-purple-600" />
                        Physical Form Copy
                      </span>
                      <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-semibold border border-slate-200">
                        Optional
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Optional: Photo or PDF scan of the filled-up paper registration form
                    </p>
                  </div>

                  <div>
                    {formFilename ? (
                      <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs">
                        <div className="font-semibold text-purple-900 truncate">{formFilename}</div>
                        <div className="text-[10px] text-purple-700 mt-0.5">{formSize} • Attached</div>
                        <label className="mt-2 text-[11px] text-purple-700 font-bold underline cursor-pointer block">
                          Replace File
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleFormUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100/80 transition text-center min-h-[110px]">
                        <Upload className="w-6 h-6 text-purple-500 mb-1" />
                        <span className="text-xs font-semibold text-slate-700">Upload Form Scan (Optional)</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">PDF or Image up to 10MB</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleFormUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* 2. Aadhaar Card Upload */}
                <div className="border border-slate-200 rounded-2xl p-4 flex flex-col justify-between bg-slate-50/50 hover:border-blue-300 transition">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-blue-600" />
                        Aadhaar Card Copy
                      </span>
                      <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold">
                        Aadhaar Proof
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Aadhaar card copy for verifier identity matching
                    </p>
                  </div>

                  <div>
                    {idProofFilename ? (
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                        <div className="font-semibold text-blue-900 truncate">{idProofFilename}</div>
                        <div className="text-[10px] text-blue-700 mt-0.5">{idProofSize} • Attached</div>
                        <label className="mt-2 text-[11px] text-blue-700 font-bold underline cursor-pointer block">
                          Replace File
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleIdProofUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100/80 transition text-center min-h-[110px]">
                        <Upload className="w-6 h-6 text-blue-500 mb-1" />
                        <span className="text-xs font-semibold text-slate-700">Upload Aadhaar Copy</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">PDF or Image up to 10MB</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleIdProofUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* 3. Candidate Photograph */}
                <div className="border border-slate-200 rounded-2xl p-4 flex flex-col justify-between bg-slate-50/50 hover:border-emerald-300 transition">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-emerald-600" />
                        Candidate Photo {requiresPhoto && <span className="text-rose-500">*</span>}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        requiresPhoto ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 bg-slate-100'
                      }`}>
                        {requiresPhoto ? 'CR80 Badge' : 'Not Required'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      {requiresPhoto
                        ? 'Clear portrait photo to print on physical PVC card'
                        : isSponsor
                        ? 'Photo is not required for Sponsor cards'
                        : 'Photo is not required for Crew cards'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-16 h-20 rounded-xl bg-slate-200 overflow-hidden border border-slate-300 flex-shrink-0 flex items-center justify-center shadow-inner">
                      {photoPreview ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={photoPreview}
                          alt="Candidate Portrait"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-8 h-8 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1">
                      <label className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>{photoPreview ? 'Change Photo' : 'Select Photo'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[10px] text-slate-400 mt-1 block">JPG, PNG, WebP</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <Link
                href="/registrations"
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </Link>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, 'DRAFT')}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, 'SUBMITTED')}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Submitting...' : 'Submit Registration'}
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </RoleAccessGate>
  );
}
