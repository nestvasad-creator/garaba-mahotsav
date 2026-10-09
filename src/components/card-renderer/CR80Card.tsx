'use client';

import React, { useState, useEffect, forwardRef } from 'react';
import QRCode from 'qrcode';
import { ResolvedCardTheme } from '@/lib/card-theme/engine';
import { cn } from '@/lib/utils';
import { User, QrCode as QrIcon } from 'lucide-react';
import {
  CARD_TEMPLATE_DATA_URL,
  CARD_TEMPLATE_TRANSPARENT_DATA_URL,
  CARD_TEMPLATE_NO_LOGO_TRANSPARENT_DATA_URL,
  GUJARATI_BANNER_DATA_URL,
  NEST_LOGO_WHITE_DATA_URL,
} from './cardTemplate';

export interface CardRenderData {
  cardNumber: string;
  qrToken: string;
  holderNameEn: string;
  holderNameGu?: string;
  categoryEn: string;
  categoryGu?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  photoUrl?: string | null;
  validFrom: string;
  validTo: string;
  areaZone?: string | null;
  eventNameEn?: string;
  eventNameGu?: string;
  organizationEn?: string;
  organizationGu?: string;
  backgroundTemplateUrl?: string | null;
  receiptNumber?: string | null;
  physicalFormNumber?: string | null;
  categoryCode?: string;
  showQr?: boolean;
  showPhoto?: boolean;
  designation?: string | null;
}

export interface CR80CardProps {
  data: CardRenderData;
  theme?: ResolvedCardTheme;
  side?: 'front' | 'back'; // Kept for backward compatibility
  scale?: number; // scale factor for UI display (1.0 = native preview 260px x 412px)
  className?: string;
  id?: string;
  isPrintMode?: boolean;
}

/**
 * CR80Card - Custom Portrait Card Implementation matching Untitled 1.png
 *
 * Physical CR80 Dimensions: 53.98mm x 85.60mm (Portrait)
 * Aspect Ratio: 0.6310 (638 x 1011 pixels at 300 DPI)
 *
 * Constant Layout (from Template):
 * - Crimson / Custom Background (theme.primaryColor or #900B09)
 * - Top-Left: NEST Trust Emblem
 * - Left Side: Gujarati Event Banner ("આદ્યશક્તિ ગરબા મહોત્સવ, વાસદ")
 * - Bottom: "PARTICIPANT" and "2026"
 *
 * Dynamic Elements:
 * 1. Dynamic QR Code (top-center, generated from ID/qrToken)
 * 2. Dynamic Participant Photo (bottom-center, directly below QR)
 * 3. Dynamic Participant Name (vertical on right side, top-to-bottom, theme.textColor)
 * 4. Dynamic Theme Colors: primaryColor (background), textColor (high-contrast text), accentColor (borders)
 */
export const CR80Card = forwardRef<HTMLDivElement, CR80CardProps>(
  ({ data, theme, scale = 1.0, className, id, isPrintMode = false }, ref) => {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    const qrValue = data.qrToken || data.cardNumber || 'NEST-2026';

    useEffect(() => {
      if (qrValue) {
        QRCode.toDataURL(qrValue, {
          width: 300,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        })
          .then((url) => setQrDataUrl(url))
          .catch((err) => console.error('QR generation error:', err));
      }
    }, [qrValue]);

    // Format safe photo URL through local CORS proxy if it is a remote Supabase or HTTP URL
    const getSafePhotoUrl = (url?: string | null) => {
      if (!url) return null;
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
      }
      if (url.startsWith('/api/proxy-image')) {
        return url;
      }
      const cardKey = encodeURIComponent(data.cardNumber || data.qrToken || 'card');
      return `/api/proxy-image?cardId=${cardKey}&url=${encodeURIComponent(url)}`;
    };

    const safePhotoUrl = getSafePhotoUrl(data.photoUrl);

    // CR80 Portrait Aspect Ratio is 53.98mm x 85.60mm = 0.6306
    // Base display dimensions: 260px x 412px (exact 638 x 1011 ratio)
    const baseWidth = 260;
    const baseHeight = 412;

    const width = baseWidth * scale;
    const height = baseHeight * scale;

    const primaryColor = theme?.primaryColor || '#900B09';
    const textColor = theme?.textColor || '#ffffff';
    const accentColor = theme?.accentColor || '#F59E0B';

    const catUpper = (data.categoryCode || data.categoryEn || '').toUpperCase();
    const isDonor = catUpper.includes('DONOR') || catUpper.includes('SPONSOR');
    const isSponsor = isDonor;
    const isTrustee = catUpper.includes('TRUSTEE');
    const isGuest = catUpper.includes('GUEST');
    const isStaff = catUpper.includes('STAFF') || catUpper.includes('CREW');
    const isVolunteer = catUpper.includes('VOLUNTEER');

    const themeConfig = (theme as any)?.templateConfig || {};

    const defaultShowQr = !isSponsor && !isTrustee && !isGuest && !isStaff && !isVolunteer;
    const defaultShowPhoto = !isSponsor && !isTrustee && !isGuest && !isStaff && !isVolunteer;

    const shouldShowQr =
      data.showQr !== undefined
        ? Boolean(data.showQr)
        : themeConfig.showQr !== undefined
        ? Boolean(themeConfig.showQr)
        : defaultShowQr;

    const shouldShowPhoto =
      data.showPhoto !== undefined
        ? Boolean(data.showPhoto)
        : themeConfig.showPhoto !== undefined
        ? Boolean(themeConfig.showPhoto)
        : defaultShowPhoto;

    // Sponsor, Trustee, Staff, or any card configured without both QR and Photo share the centered logo & title layout
    const isSpecialCenterLayout = isSponsor || isTrustee || isStaff || (!shouldShowQr && !shouldShowPhoto);
    // Categories with a prominent center logo (Trustee, Guest, Sponsor, Staff, or layout without QR & Photo) should not display the top-left logo
    const hasCenterLogo = isTrustee || isGuest || isSponsor || isStaff || (!shouldShowQr && !shouldShowPhoto);

    // For designs featuring a center logo (Trustee, Guest, Sponsor, Staff, or layout without QR & Photo), default to the
    // clean transparent template without the top-left logo to avoid visual redundancy
    const defaultTransparentTemplate = hasCenterLogo
      ? CARD_TEMPLATE_NO_LOGO_TRANSPARENT_DATA_URL
      : CARD_TEMPLATE_TRANSPARENT_DATA_URL;

    // When a custom background image is supplied, use it; otherwise check theme watermark/logo,
    // or fallback to the transparent template allowing theme.primaryColor to dynamically render
    const bgUrl =
      data.backgroundTemplateUrl ||
      (theme as any)?.watermarkUrl ||
      (theme as any)?.watermark_url ||
      (theme as any)?.logoUrl ||
      (theme as any)?.logo_url ||
      defaultTransparentTemplate;

    // Dynamic Name calculation & responsive font sizing
    const name = (data.holderNameEn || (isVolunteer ? 'VOLUNTEER NAME' : 'PARTICIPANT NAME')).trim();
    let nameFontSize = 16.5;
    if (name.length > 27) {
      nameFontSize = 10.2;
    } else if (name.length > 22) {
      nameFontSize = 11.8;
    } else if (name.length > 17) {
      nameFontSize = 13.5;
    } else if (name.length > 12) {
      nameFontSize = 15.0;
    } else {
      nameFontSize = 16.5;
    }
    const scaledFontSize = Math.max(9, Math.round(nameFontSize * scale * 10) / 10);

    const isTrustOrgName = (val?: string | null) => {
      if (!val) return false;
      const u = val.toUpperCase();
      return u.includes('ENGLISH SCHOOL') || u.includes('NEST') || u.includes('TRUST');
    };

    // Dynamic Role / Department calculation for Staff (e.g. POLICE, GEB, FIRE, etc.)
    const rawStaffDept = (
      data.designation && !isTrustOrgName(data.designation)
        ? data.designation
        : (isStaff && data.areaZone && !isTrustOrgName(data.areaZone) && !data.areaZone.startsWith('Form #') && !data.areaZone.toLowerCase().includes('east zone')
          ? data.areaZone
          : '')
    ).trim();
    const staffDept = rawStaffDept.toUpperCase();

    // Candidate Personal Name for Staff (excluding trust/organization text)
    const candidateNameStr = (data.holderNameEn || data.holderNameGu || '').trim();
    const rawCandidateName = !isTrustOrgName(candidateNameStr) ? candidateNameStr : '';
    const staffCandidateName = rawCandidateName.toUpperCase();

    // Check if distinct candidate name is present for Staff
    const hasStaffDept = isStaff && staffDept.length > 0;
    const hasDistinctCandidateName =
      isStaff &&
      staffCandidateName.length > 0 &&
      staffCandidateName !== staffDept &&
      staffCandidateName !== 'STAFF' &&
      staffCandidateName !== 'PARTICIPANT';

    // Show both department and candidate name if both are present and distinct
    const showBothStaffFields = isStaff && hasStaffDept && hasDistinctCandidateName;

    // Single Center Title fallback calculation (Sponsor, Trustee, or single-title Staff)
    const singleStaffTitle = hasStaffDept
      ? staffDept
      : staffCandidateName.length > 0
      ? staffCandidateName
      : (data.categoryEn || 'STAFF').trim().toUpperCase();

    const centerTitle = isStaff ? singleStaffTitle : name;

    // Responsive font size for Sponsor / Trustee / Staff Title in the center (single title)
    let centerTitleFontSize = 16.5;
    if (centerTitle.length > 32) {
      centerTitleFontSize = 10;
    } else if (centerTitle.length > 24) {
      centerTitleFontSize = 11.5;
    } else if (centerTitle.length > 18) {
      centerTitleFontSize = 13;
    } else if (centerTitle.length > 12) {
      centerTitleFontSize = 14.5;
    }
    const scaledCenterTitleFontSize = Math.max(9, Math.round(centerTitleFontSize * scale * 10) / 10);

    // Responsive font sizes when both Department and Candidate Name are shown
    let staffDeptFontSize = 15.0;
    if (staffDept.length > 25) {
      staffDeptFontSize = 10.0;
    } else if (staffDept.length > 18) {
      staffDeptFontSize = 11.5;
    } else if (staffDept.length > 12) {
      staffDeptFontSize = 13.0;
    }
    const scaledStaffDeptFontSize = Math.max(9, Math.round(staffDeptFontSize * scale * 10) / 10);

    let staffNameFontSize = 12.8;
    if (staffCandidateName.length > 26) {
      staffNameFontSize = 9.2;
    } else if (staffCandidateName.length > 18) {
      staffNameFontSize = 10.5;
    } else if (staffCandidateName.length > 12) {
      staffNameFontSize = 11.8;
    }
    const scaledStaffNameFontSize = Math.max(8.5, Math.round(staffNameFontSize * scale * 10) / 10);

    // Dynamic Name calculation for Guest (display name below logo if provided)
    const rawGuestName = (data.holderNameEn || '').trim();
    const isGuestGeneric =
      rawGuestName.length === 0 ||
      rawGuestName.toUpperCase() === 'GUEST' ||
      rawGuestName.toUpperCase() === 'GUEST PASS' ||
      isTrustOrgName(rawGuestName);
    const hasGuestName = isGuest && !isGuestGeneric;
    const guestName = rawGuestName.toUpperCase();

    let guestNameFontSize = 15.5;
    if (guestName.length > 32) {
      guestNameFontSize = 10.0;
    } else if (guestName.length > 24) {
      guestNameFontSize = 11.5;
    } else if (guestName.length > 18) {
      guestNameFontSize = 13.0;
    } else if (guestName.length > 12) {
      guestNameFontSize = 14.5;
    }
    const scaledGuestNameFontSize = Math.max(9.0, Math.round(guestNameFontSize * scale * 10) / 10);

    // Normalize category: if it says "Registered Participant" (or anything containing participant), shorten to "PARTICIPANT"
    const rawCategory = (data.categoryEn || 'PARTICIPANT').trim();
    const isParticipantVariant =
      /^(registered\s+)?participants?$/i.test(rawCategory) ||
      rawCategory.toLowerCase() === 'registered participant';
    const normalizedCategory = isParticipantVariant ? 'PARTICIPANT' : rawCategory;

    const isCustomCategory =
      normalizedCategory.toUpperCase() !== 'PARTICIPANT' &&
      normalizedCategory.toUpperCase() !== 'PARTICIPANTS';

    // Calculate font size for custom category overlay ensuring single-line fit without wrapping
    let categoryFontSize = 13.5;
    if (normalizedCategory.length > 24) {
      categoryFontSize = 9.0;
    } else if (normalizedCategory.length > 18) {
      categoryFontSize = 10.0;
    } else if (normalizedCategory.length > 13) {
      categoryFontSize = 11.2;
    } else if (normalizedCategory.length > 8) {
      categoryFontSize = 12.2;
    } else {
      categoryFontSize = 13.5;
    }
    const scaledCategoryFontSize = Math.max(8, Math.round(categoryFontSize * scale * 10) / 10);

    // Receipt Number calculation (positioned above QR code, without labels)
    const cleanReceiptNo = (data.receiptNumber || '')
      .trim()
      .replace(/^(rec(eipt)?\s*(no\.?|#)?:?|#)\s*/i, '')
      .trim();

    const displayReceiptNo = cleanReceiptNo;

    // Responsive font sizing based on length to ensure it fits neatly, boldly, prominently, and completely above the QR code without truncation or clipping
    let numFontSize = 16.0;
    if (displayReceiptNo.length > 24) {
      numFontSize = 8.8;
    } else if (displayReceiptNo.length > 19) {
      numFontSize = 9.8;
    } else if (displayReceiptNo.length > 15) {
      numFontSize = 10.8;
    } else if (displayReceiptNo.length > 12) {
      numFontSize = 12.0;
    } else if (displayReceiptNo.length > 9) {
      numFontSize = 13.2;
    } else if (displayReceiptNo.length > 6) {
      numFontSize = 14.5;
    } else {
      numFontSize = 16.0;
    }
    const scaledNumFontSize = Math.max(8.0, Math.round(numFontSize * scale * 10) / 10);

    const isDarkText =
      textColor.toLowerCase() === '#0f172a' ||
      textColor.toLowerCase() === '#000000' ||
      textColor.toLowerCase() === '#1e293b';

    return (
      <div
        ref={ref}
        id={id || `cr80-card-${data.cardNumber}`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: primaryColor,
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          color: textColor,
          borderColor: isPrintMode ? 'transparent' : accentColor ? `${accentColor}50` : 'rgba(0,0,0,0.15)',
          borderWidth: isPrintMode ? 0 : undefined,
          borderRadius: isPrintMode ? 0 : undefined,
          boxShadow: isPrintMode ? 'none' : undefined,
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
        className={cn(
          'relative overflow-hidden select-none cr80-card-sheet font-sans transition-colors duration-200',
          isPrintMode
            ? 'rounded-none shadow-none border-0'
            : 'rounded-xl shadow-md border print:rounded-none print:shadow-none print:border-none',
          className
        )}
      >
        {/* Top-Left Logo Mask: Removes/masks top-left logo for designs that feature a center logo (Trustee, Guest, Sponsor) */}
        {hasCenterLogo && (
          <div
            style={{
              position: 'absolute',
              left: '4.8%',
              top: '5.8%',
              width: '26%',
              height: '17%',
              backgroundColor: primaryColor,
              zIndex: 10,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Receipt Number (Shown above QR code if available and QR is enabled) */}
        {displayReceiptNo && shouldShowQr && !isSpecialCenterLayout && (
          <div
            style={{
              position: 'absolute',
              left: '10%',
              width: '80%',
              maxWidth: '80%',
              top: '19.8%',
              height: '5.4%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              zIndex: 15,
              overflow: 'visible',
            }}
          >
            <span
              style={{
                color: textColor,
                fontSize: `${scaledNumFontSize}px`,
                lineHeight: 1.1,
                letterSpacing: displayReceiptNo.length > 14 ? '0.01em' : '0.03em',
                fontWeight: 900,
                textShadow: isDarkText
                  ? '0 1px 2px rgba(255, 255, 255, 0.7)'
                  : '0 1px 2px rgba(0, 0, 0, 0.7)',
                whiteSpace: 'nowrap',
                overflow: 'visible',
                wordBreak: 'keep-all',
                textOverflow: 'clip',
              }}
              className="uppercase select-none font-extrabold"
              title={`Receipt: ${displayReceiptNo}`}
            >
              {displayReceiptNo}
            </span>
          </div>
        )}

        {/* 1. Dynamic QR Code Box (Hidden for Sponsor or if shouldShowQr is false) */}
        {shouldShowQr && (
          <div
            style={{
              position: 'absolute',
              left: '30.41%',
              top: '25.52%',
              width: '39.18%',
              height: '24.73%',
              borderColor: accentColor ? `${accentColor}80` : 'rgba(0,0,0,0.15)',
            }}
            className="bg-white rounded-md p-1 shadow-xs flex items-center justify-center overflow-hidden border-2"
          >
            {qrDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrDataUrl}
                alt="Participant QR Code"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                <QrIcon className="w-6 h-6 animate-pulse" />
                <span className="text-[6.5px] font-mono font-bold mt-0.5">GENERATING</span>
              </div>
            )}
          </div>
        )}

        {/* 2. Dynamic Photo Box (Hidden for Sponsor & Crew or if shouldShowPhoto is false) */}
        {shouldShowPhoto && (
          <div
            style={{
              position: 'absolute',
              left: '30.41%',
              top: '51.24%',
              width: '39.18%',
              height: '25.32%',
              borderColor: accentColor ? `${accentColor}80` : 'rgba(255,255,255,0.4)',
            }}
            className="rounded-md overflow-hidden bg-slate-100 border-2 shadow-xs flex items-center justify-center relative"
          >
            {safePhotoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={`photo-${data.cardNumber || data.qrToken || 'card'}`}
                src={safePhotoUrl}
                crossOrigin="anonymous"
                alt={data.holderNameEn}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 text-slate-400">
                <User className="w-8 h-8 text-slate-400" />
                <span className="text-[7px] font-bold uppercase text-slate-500 tracking-wider mt-0.5">
                  No Photo
                </span>
              </div>
            )}
          </div>
        )}

        {/* SPONSOR, TRUSTEE & STAFF SPECIFIC CENTER LAYOUT (Logo & Name/Role in Center) */}
        {isSpecialCenterLayout && (
          <div
            style={{
              position: 'absolute',
              left: '20%',
              width: '60%',
              top: '24%',
              height: '51%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: `${Math.round((showBothStaffFields ? 6 : 8) * scale)}px`,
              zIndex: 15,
            }}
          >
            {/* Center Logo */}
            <div
              style={{
                width: `${Math.round((showBothStaffFields ? 82 : 92) * scale)}px`,
                height: `${Math.round((showBothStaffFields ? 82 : 92) * scale)}px`,
                maxHeight: showBothStaffFields ? '46%' : '52%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Center Logo Emblem: for Sponsor, Trustee, Volunteer, or whenever photo is disabled, render NEST Logo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  !shouldShowPhoto || isSponsor || isTrustee || isVolunteer
                    ? NEST_LOGO_WHITE_DATA_URL
                    : safePhotoUrl || NEST_LOGO_WHITE_DATA_URL
                }
                alt={
                  isTrustee
                    ? 'Trustee Logo'
                    : isStaff
                    ? 'Staff Logo'
                    : isDonor
                    ? 'Donor Logo'
                    : isVolunteer
                    ? 'Volunteer Logo'
                    : 'Nest Logo'
                }
                className="w-full h-full object-contain select-none"
                style={{
                  filter:
                    (!safePhotoUrl || !shouldShowPhoto || isSponsor || isTrustee || isVolunteer) && isDarkText
                      ? 'invert(1)'
                      : 'none',
                }}
              />
            </div>

            {/* If Staff with Both Department and Candidate Name */}
            {showBothStaffFields ? (
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: `${Math.round(2 * scale)}px`,
                }}
              >
                {/* Department / Category Title (e.g. POLICE, GEB) */}
                <div
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    color: textColor,
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    fontSize: `${scaledStaffDeptFontSize}px`,
                    lineHeight: 1.18,
                    textTransform: 'uppercase',
                    textShadow: isDarkText
                      ? '0 1px 2px rgba(255, 255, 255, 0.7)'
                      : '0 1px 2px rgba(0, 0, 0, 0.65)',
                    wordBreak: 'normal',
                    overflowWrap: 'break-word',
                  }}
                  title={`Department: ${staffDept}`}
                >
                  {staffDept}
                </div>

                {/* Candidate Personal Name */}
                <div
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    color: textColor,
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    fontSize: `${scaledStaffNameFontSize}px`,
                    lineHeight: 1.15,
                    textTransform: 'uppercase',
                    opacity: 0.95,
                    textShadow: isDarkText
                      ? '0 1px 2px rgba(255, 255, 255, 0.7)'
                      : '0 1px 2px rgba(0, 0, 0, 0.65)',
                    wordBreak: 'normal',
                    overflowWrap: 'break-word',
                  }}
                  title={`Candidate: ${staffCandidateName}`}
                >
                  {staffCandidateName}
                </div>
              </div>
            ) : (
              /* Single Center Title (Sponsor, Trustee, or Staff with single title) */
              <div
                style={{
                  width: '100%',
                  textAlign: 'center',
                  color: textColor,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  fontSize: `${scaledCenterTitleFontSize}px`,
                  lineHeight: 1.22,
                  textTransform: 'uppercase',
                  textShadow: isDarkText
                    ? '0 1px 2px rgba(255, 255, 255, 0.7)'
                    : '0 1px 2px rgba(0, 0, 0, 0.65)',
                  wordBreak: 'normal',
                  overflowWrap: 'break-word',
                }}
                title={centerTitle}
              >
                {centerTitle}
              </div>
            )}
          </div>
        )}

        {/* GUEST SPECIFIC CENTER LAYOUT (Emblem, and Name below if given) */}
        {isGuest && (
          <div
            style={{
              position: 'absolute',
              left: '20%',
              width: '60%',
              top: '24%',
              height: '51%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: hasGuestName ? `${Math.round(8 * scale)}px` : 0,
              zIndex: 15,
            }}
          >
            <div
              style={{
                width: `${Math.round((hasGuestName ? 92 : 112) * scale)}px`,
                height: `${Math.round((hasGuestName ? 92 : 112) * scale)}px`,
                maxHeight: hasGuestName ? '52%' : '85%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={safePhotoUrl || NEST_LOGO_WHITE_DATA_URL}
                alt="Guest Pass Emblem"
                className="w-full h-full object-contain select-none"
                style={{
                  filter: !safePhotoUrl && isDarkText ? 'invert(1)' : 'none',
                }}
              />
            </div>

            {/* Guest Name below Logo, above bottom GUEST badge (if given) */}
            {hasGuestName && (
              <div
                style={{
                  width: '100%',
                  textAlign: 'center',
                  color: textColor,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  fontSize: `${scaledGuestNameFontSize}px`,
                  lineHeight: 1.22,
                  textTransform: 'uppercase',
                  textShadow: isDarkText
                    ? '0 1px 2px rgba(255, 255, 255, 0.7)'
                    : '0 1px 2px rgba(0, 0, 0, 0.65)',
                  wordBreak: 'normal',
                  overflowWrap: 'break-word',
                }}
                title={guestName}
              >
                {guestName}
              </div>
            )}
          </div>
        )}

        {/* 3. Left Side: Gujarati Banner for all cards (dynamically tinted with textColor) */}
        <div
          style={{
            position: 'absolute',
            left: '6.0%',
            top: '25.2%',
            width: '14.5%',
            height: '68.5%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: textColor,
              WebkitMaskImage: `url(${GUJARATI_BANNER_DATA_URL})`,
              maskImage: `url(${GUJARATI_BANNER_DATA_URL})`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }}
          />
        </div>

        {/* 4. Right Side: Gujarati Banner for Sponsor/Trustee/Guest/Staff, or Dynamic Name for Participant */}
        {isSpecialCenterLayout || isGuest ? (
          <div
            style={{
              position: 'absolute',
              left: '79.5%',
              top: '25.2%',
              width: '14.5%',
              height: '68.5%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: textColor,
                WebkitMaskImage: `url(${GUJARATI_BANNER_DATA_URL})`,
                maskImage: `url(${GUJARATI_BANNER_DATA_URL})`,
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
              }}
            />
          </div>
        ) : (
          <div
            style={{
              position: 'absolute',
              left: '76%',
              top: '21%',
              width: '20%',
              height: '68%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              zIndex: 20,
            }}
          >
            <div
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                WebkitWritingMode: 'vertical-rl',
                whiteSpace: 'nowrap',
                color: textColor,
                fontWeight: 900,
                letterSpacing: name.length > 20 ? '0.02em' : '0.04em',
                fontSize: `${scaledFontSize}px`,
                textTransform: 'uppercase',
                textShadow: isDarkText
                  ? '0 1px 2px rgba(255, 255, 255, 0.7)'
                  : '0 1px 2px rgba(0, 0, 0, 0.65)',
                maxHeight: '100%',
                display: 'inline-block',
                textAlign: 'center',
              }}
              title={data.holderNameEn || name}
            >
              {name}
            </div>
          </div>
        )}

        {/* 5. Category Badge Overlay */}
        <div
          style={{
            position: 'absolute',
            left: '21%',
            top: '76.0%',
            width: '58%',
            maxWidth: '58%',
            height: '8.8%',
            backgroundColor: primaryColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          className="overflow-hidden"
        >
          <span
            style={{
              width: '100%',
              maxWidth: '100%',
              fontSize: `${scaledCategoryFontSize}px`,
              lineHeight: 1.15,
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'clip',
              wordBreak: 'keep-all',
              color: textColor,
              textShadow: isDarkText
                ? '0 1px 2px rgba(255, 255, 255, 0.7)'
                : '0 1px 2px rgba(0, 0, 0, 0.65)',
            }}
            className="font-extrabold uppercase text-center drop-shadow-sm select-none"
          >
            {normalizedCategory}
          </span>
        </div>

        {/* 6. Dynamic Bottom Year Text inheriting textColor */}
        <div
          style={{
            position: 'absolute',
            left: '20%',
            top: '84.8%',
            width: '60%',
            height: '10.5%',
            backgroundColor: primaryColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          className="overflow-hidden"
        >
          <span
            style={{
              fontSize: `${Math.round(18.5 * scale)}px`,
              fontWeight: 900,
              letterSpacing: '0.14em',
              lineHeight: 1,
              color: textColor,
              textShadow: isDarkText
                ? '0 1px 2px rgba(255, 255, 255, 0.7)'
                : '0 1px 2px rgba(0, 0, 0, 0.65)',
            }}
            className="font-black font-sans uppercase tracking-widest select-none text-center"
          >
            {data.validTo ? (new Date(data.validTo).getFullYear() || '2026') : '2026'}
          </span>
        </div>
      </div>
    );
  }
);

CR80Card.displayName = 'CR80Card';
