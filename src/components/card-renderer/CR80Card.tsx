'use client';

import React, { useState, useEffect, forwardRef } from 'react';
import QRCode from 'qrcode';
import { ResolvedCardTheme } from '@/lib/card-theme/engine';
import { cn } from '@/lib/utils';
import { User, QrCode as QrIcon } from 'lucide-react';
import {
  CARD_TEMPLATE_DATA_URL,
  CARD_TEMPLATE_TRANSPARENT_DATA_URL,
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
}

export interface CR80CardProps {
  data: CardRenderData;
  theme?: ResolvedCardTheme;
  side?: 'front' | 'back'; // Kept for backward compatibility
  scale?: number; // scale factor for UI display (1.0 = native preview 260px x 412px)
  className?: string;
  id?: string;
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
  ({ data, theme, scale = 1.0, className, id }, ref) => {
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

    // When a custom background image is supplied, use it; otherwise check theme watermark/logo,
    // or fallback to the transparent template allowing theme.primaryColor to dynamically render
    const bgUrl =
      data.backgroundTemplateUrl ||
      (theme as any)?.watermarkUrl ||
      (theme as any)?.watermark_url ||
      (theme as any)?.logoUrl ||
      (theme as any)?.logo_url ||
      CARD_TEMPLATE_TRANSPARENT_DATA_URL;

    const catUpper = (data.categoryCode || data.categoryEn || '').toUpperCase();
    const isSponsor = catUpper.includes('SPONSOR');
    const isCrew = catUpper.includes('CREW');

    const shouldShowQr = data.showQr !== undefined ? data.showQr : !isSponsor;
    const shouldShowPhoto = data.showPhoto !== undefined ? data.showPhoto : (!isSponsor && !isCrew);

    // Dynamic Name calculation & responsive font sizing
    const name = (data.holderNameEn || 'PARTICIPANT NAME').trim();
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

    // Responsive font size for Sponsor Name in the center
    let sponsorNameFontSize = 16.5;
    if (name.length > 32) {
      sponsorNameFontSize = 10;
    } else if (name.length > 24) {
      sponsorNameFontSize = 11.5;
    } else if (name.length > 18) {
      sponsorNameFontSize = 13;
    } else if (name.length > 12) {
      sponsorNameFontSize = 14.5;
    }
    const scaledSponsorFontSize = Math.max(9, Math.round(sponsorNameFontSize * scale));

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

    // Responsive font sizing based on length to ensure it fits neatly, boldly, and completely above the QR code without truncation or clipping
    let numFontSize = 11.5;
    if (displayReceiptNo.length > 22) {
      numFontSize = 7.5;
    } else if (displayReceiptNo.length > 16) {
      numFontSize = 8.5;
    } else if (displayReceiptNo.length > 11) {
      numFontSize = 9.5;
    } else if (displayReceiptNo.length > 6) {
      numFontSize = 10.5;
    } else {
      numFontSize = 11.5;
    }
    const scaledNumFontSize = Math.max(7.0, Math.round(numFontSize * scale * 10) / 10);

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
          borderColor: accentColor ? `${accentColor}50` : 'rgba(0,0,0,0.15)',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
        className={cn(
          'relative rounded-xl overflow-hidden shadow-md select-none print:shadow-none cr80-card-sheet font-sans border transition-colors duration-200',
          className
        )}
      >
        {/* Receipt Number (Shown above QR code if available and QR is enabled) */}
        {displayReceiptNo && shouldShowQr && (
          <div
            style={{
              position: 'absolute',
              left: '18%',
              width: '64%',
              maxWidth: '64%',
              top: '20.4%',
              height: '4.8%',
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
                lineHeight: 1,
                letterSpacing: '0.03em',
                fontWeight: 800,
                textShadow: isDarkText
                  ? '0 1px 2px rgba(255, 255, 255, 0.7)'
                  : '0 1px 2px rgba(0, 0, 0, 0.7)',
                whiteSpace: 'nowrap',
                overflow: 'visible',
                wordBreak: 'keep-all',
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

        {/* SPONSOR SPECIFIC CENTER LAYOUT (Instead of QR Code & Photo) */}
        {isSponsor && (
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
              gap: `${Math.round(8 * scale)}px`,
              zIndex: 15,
            }}
          >
            {/* Center Logo */}
            <div
              style={{
                width: `${Math.round(92 * scale)}px`,
                height: `${Math.round(92 * scale)}px`,
                maxHeight: '52%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={safePhotoUrl || NEST_LOGO_WHITE_DATA_URL}
                alt="Sponsor Logo"
                className="w-full h-full object-contain select-none"
                style={{
                  filter: !safePhotoUrl && isDarkText ? 'invert(1)' : 'none',
                }}
              />
            </div>

            {/* Sponsor Name below Logo (Auto-adjusted font size to fit neatly) */}
            <div
              style={{
                width: '100%',
                textAlign: 'center',
                color: textColor,
                fontWeight: 900,
                letterSpacing: '0.04em',
                fontSize: `${scaledSponsorFontSize}px`,
                lineHeight: 1.22,
                textTransform: 'uppercase',
                textShadow: isDarkText
                  ? '0 1px 2px rgba(255, 255, 255, 0.7)'
                  : '0 1px 2px rgba(0, 0, 0, 0.65)',
                wordBreak: 'normal',
                overflowWrap: 'break-word',
              }}
              title={name}
            >
              {name}
            </div>
          </div>
        )}

        {/* 3. Right Side: Gujarati Banner for Sponsor, or Dynamic Participant Name for others */}
        {isSponsor ? (
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={GUJARATI_BANNER_DATA_URL}
              alt="આદ્યાશક્તિ ગરબા મહોત્સવ, વાસદ"
              className="w-full h-full object-contain select-none"
              style={{
                filter: isDarkText ? 'invert(1)' : 'none',
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
              title={data.holderNameEn}
            >
              {name}
            </div>
          </div>
        )}

        {/* 4. Optional Custom Category Overlay (Only shown if category is custom, e.g. GUEST, VIP, SPONSOR, etc.) */}
        {isCustomCategory && (
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
        )}
      </div>
    );
  }
);

CR80Card.displayName = 'CR80Card';
