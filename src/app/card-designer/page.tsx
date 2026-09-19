'use client';

import React, { useState, useEffect } from 'react';
import { CR80Card, CardRenderData } from '@/components/card-renderer/CR80Card';
import { ResolvedCardTheme } from '@/lib/card-theme/engine';
import {
  Sparkles,
  Palette,
  RotateCw,
  Printer,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { saveCardAsImage, printCardDirectly } from '@/lib/cards/exportCard';
import { RoleAccessGate } from '@/components/auth/RoleAccessGate';
import { getCurrentUserSession } from '@/lib/auth/actions';
import {
  getEventThemes,
  updateCardTheme,
  CardThemeItem,
} from '@/lib/card-theme/actions';

function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#FFFFFF';
  const cleanHex = hexColor.replace('#', '').trim();
  let r = 0,
    g = 0,
    b = 0;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length >= 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }
  // Standard relative perceptive luminance formula (WCAG)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // If bright background (> 0.55), contrast text is dark (#0F172A); otherwise bright (#FFFFFF)
  return luminance > 0.55 ? '#0F172A' : '#FFFFFF';
}

export default function CardDesignerPage() {
  const [currentRoleCode, setCurrentRoleCode] = useState<string | undefined>(undefined);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [themes, setThemes] = useState<CardThemeItem[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(true);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');

  const [side, setSide] = useState<'front' | 'back'>('front');
  const [scale, setScale] = useState<number>(1.0);

  // Active theme editing state
  const [activeColors, setActiveColors] = useState<ResolvedCardTheme & { watermarkUrl?: string | null }>({
    primaryColor: '#900B09',
    headerColor: '#700908',
    footerColor: '#700908',
    accentColor: '#F59E0B',
    textColor: '#FFFFFF',
    watermarkUrl: null,
  });

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const handlePrimaryColorChange = (newColor: string) => {
    const autoContrastText = getContrastColor(newColor);
    setActiveColors((prev) => ({
      ...prev,
      primaryColor: newColor,
      textColor: autoContrastText,
    }));
  };

  const fetchThemes = async () => {
    setLoadingThemes(true);
    try {
      const data = await getEventThemes();
      setThemes(data);
      if (data.length > 0) {
        const first = data[0];
        setSelectedThemeId(first.id);
        const contrastText = getContrastColor(first.primaryColor);
        setActiveColors({
          primaryColor: first.primaryColor,
          headerColor: first.headerColor,
          footerColor: first.footerColor,
          accentColor: first.accentColor,
          textColor: first.textColor || contrastText,
          watermarkUrl: first.watermarkUrl || null,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingThemes(false);
    }
  };

  useEffect(() => {
    async function init() {
      const session = await getCurrentUserSession();
      setCurrentRoleCode(session?.roleCode);
      setLoadingAuth(false);
      await fetchThemes();
    }
    init();
  }, []);

  const handleSelectTheme = (theme: CardThemeItem) => {
    setSelectedThemeId(theme.id);
    const contrastText = getContrastColor(theme.primaryColor);
    setActiveColors({
      primaryColor: theme.primaryColor,
      headerColor: theme.headerColor,
      footerColor: theme.footerColor,
      accentColor: theme.accentColor,
      textColor: theme.textColor || contrastText,
      watermarkUrl: theme.watermarkUrl || null,
    });
    setSaveMessage(null);
  };

  const handleSaveTheme = async () => {
    if (!selectedThemeId) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await updateCardTheme(selectedThemeId, {
        primaryColor: activeColors.primaryColor,
        headerColor: activeColors.headerColor,
        footerColor: activeColors.footerColor,
        accentColor: activeColors.accentColor,
        textColor: activeColors.textColor,
        watermarkUrl: activeColors.watermarkUrl || null,
      });

      if (!res.success) {
        setSaveMessage({ text: res.error || 'Failed to save theme.', error: true });
      } else {
        setSaveMessage({ text: 'Palette updated and saved to Supabase successfully!' });
        // Update local themes list
        setThemes((prev) =>
          prev.map((t) =>
            t.id === selectedThemeId
              ? {
                  ...t,
                  primaryColor: activeColors.primaryColor,
                  headerColor: activeColors.headerColor,
                  footerColor: activeColors.footerColor,
                  accentColor: activeColors.accentColor,
                  textColor: activeColors.textColor,
                  watermarkUrl: activeColors.watermarkUrl || null,
                }
              : t
          )
        );
        setTimeout(() => setSaveMessage(null), 4000);
      }
    } catch (err: any) {
      setSaveMessage({ text: err.message, error: true });
    } finally {
      setSaving(false);
    }
  };

  const selectedTheme = themes.find((t) => t.id === selectedThemeId);

  const isSponsor = selectedTheme?.cardTypeCode === 'SPONSOR';
  const isCrew = selectedTheme?.cardTypeCode === 'CREW';

  const sampleCardData: CardRenderData = {
    cardNumber: isSponsor ? 'NEST-SPON-2026' : isCrew ? 'NEST-CREW-1042' : 'NEST-CARD-107008',
    qrToken: isSponsor ? '' : 'tok_nest_preview_sample_2026',
    holderNameEn: isSponsor
      ? 'RELIANCE INDUSTRIES LTD.'
      : isCrew
      ? 'VIKRAM SHARMA (STAGE CREW)'
      : selectedTheme?.genderRule === 'FEMALE'
      ? 'Pooja Sanjaybhai Shah'
      : 'Rahul Maheshbhai Patel',
    categoryEn: selectedTheme?.cardTypeNameEn || 'Participant',
    categoryCode: selectedTheme?.cardTypeCode || 'REG_PARTICIPANT',
    gender: selectedTheme?.genderRule || 'MALE',
    validFrom: '01-Oct-2026',
    validTo: '12-Oct-2026',
    areaZone: isSponsor ? 'Sponsor Lounge' : isCrew ? 'Backstage / Production' : 'East Zone / Vasad',
    eventNameEn: 'NAVRATRI MAHOTSAV 2026',
    organizationEn: 'THE NEW ENGLISH SCHOOL TRUST, VASAD',
    physicalFormNumber: isSponsor ? null : '1042',
    receiptNumber: isSponsor ? null : '8593',
    backgroundTemplateUrl: activeColors.watermarkUrl || undefined,
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
          <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span>Verifying administrator permissions...</span>
        </div>
      </div>
    );
  }

  return (
    <RoleAccessGate
      currentRoleCode={currentRoleCode}
      allowedRoles={['SUPER_ADMIN', 'EVENT_ADMIN']}
      moduleNameEn="CR80 Card Theme Engine"
      moduleNameGu="CR80 Card Theme Engine"
    >
      <div className="min-h-screen bg-slate-100 flex flex-col">
        {/* Top Navbar */}
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
                <Sparkles className="w-5 h-5 text-amber-500" />
                CR80 Card Theme Engine & Visual Template Designer
              </h1>
              <p className="text-xs text-slate-500">
                CR80 card theme and color scheme configuration (ISO/IEC 7810 Standard)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={async () => {
                const el = document.getElementById('cr80-designer-preview');
                if (el) {
                  await saveCardAsImage(el, {
                    fileName: `Sample-CR80-Card-${selectedTheme?.cardTypeNameEn || 'Participant'}`,
                    format: 'png',
                  });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-300 bg-purple-50 text-xs font-bold text-purple-700 hover:bg-purple-100 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Save Card (PNG)
            </button>
            <button
              onClick={handleSaveTheme}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Theme Palette'}
            </button>
            <button
              onClick={async () => {
                const el = document.getElementById('cr80-designer-preview');
                if (el) await printCardDirectly(el);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm"
              title="Print physical CR80 card directly"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Card
            </button>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Controls: Categories and Palettes */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            {saveMessage && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  saveMessage.error
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {saveMessage.error ? (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{saveMessage.text}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-600" />
                  Card Categories & Themes
                </h2>
                <button
                  onClick={fetchThemes}
                  title="Reload from database"
                  className="text-slate-400 hover:text-slate-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Select an event role/gender theme to customize its color scheme:
              </p>

              {loadingThemes ? (
                <div className="py-8 flex items-center justify-center text-slate-400 text-xs gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                  <span>Loading themes from Supabase...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 mt-3 max-h-[260px] overflow-y-auto pr-1">
                  {themes.map((theme) => {
                    const isSelected = theme.id === selectedThemeId;
                    const label = `${theme.cardTypeNameEn} ${
                      theme.genderRule ? `(${theme.genderRule})` : ''
                    }`;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => handleSelectTheme(theme)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-100 bg-blue-50/50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-5 h-5 rounded-md shadow-xs border border-black/10 flex-shrink-0"
                            style={{ backgroundColor: theme.primaryColor }}
                          />
                          <div className="truncate">
                            <div className="font-semibold text-slate-800">{label}</div>
                          </div>
                        </div>

                        {theme.genderRule && (
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              theme.genderRule === 'FEMALE'
                                ? 'bg-pink-100 text-pink-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {theme.genderRule}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Color Customizer */}
            <div className="border-t border-slate-200 pt-5 space-y-3">
              <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Exact Hex Color Palette
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Primary Body
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeColors.primaryColor}
                      onChange={(e) => handlePrimaryColorChange(e.target.value)}
                      className="w-8 h-8 rounded border p-0.5 cursor-pointer bg-white"
                    />
                    <span className="font-mono text-xs text-slate-600 uppercase">
                      {activeColors.primaryColor}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Header Ribbon
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeColors.headerColor}
                      onChange={(e) =>
                        setActiveColors({ ...activeColors, headerColor: e.target.value })
                      }
                      className="w-8 h-8 rounded border p-0.5 cursor-pointer bg-white"
                    />
                    <span className="font-mono text-xs text-slate-600 uppercase">
                      {activeColors.headerColor}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Accent / Badge
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeColors.accentColor}
                      onChange={(e) =>
                        setActiveColors({ ...activeColors, accentColor: e.target.value })
                      }
                      className="w-8 h-8 rounded border p-0.5 cursor-pointer bg-white"
                    />
                    <span className="font-mono text-xs text-slate-600 uppercase">
                      {activeColors.accentColor}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Footer Ribbon
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeColors.footerColor}
                      onChange={(e) =>
                        setActiveColors({ ...activeColors, footerColor: e.target.value })
                      }
                      className="w-8 h-8 rounded border p-0.5 cursor-pointer bg-white"
                    />
                    <span className="font-mono text-xs text-slate-600 uppercase">
                      {activeColors.footerColor}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Text & Contrast Color
                    </label>
                    <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                      Auto-calculated from Primary
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeColors.textColor || '#FFFFFF'}
                      onChange={(e) =>
                        setActiveColors({ ...activeColors, textColor: e.target.value })
                      }
                      className="w-8 h-8 rounded border p-0.5 cursor-pointer bg-white"
                    />
                    <span className="font-mono text-xs text-slate-600 uppercase">
                      {activeColors.textColor || '#FFFFFF'}
                    </span>
                    <span className="text-[11px] text-slate-400 italic ml-2">
                      (Automatically adjusts to ensure maximum legibility against card background)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Card Design Artwork / Background Template */}
            <div className="border-t border-slate-200 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-purple-600" />
                  Custom Card Design Template
                </h3>
                {activeColors.watermarkUrl && (
                  <button
                    type="button"
                    onClick={() => setActiveColors((prev) => ({ ...prev, watermarkUrl: null }))}
                    className="text-[10px] text-rose-600 hover:underline font-semibold"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Upload custom background card design for {selectedTheme?.cardTypeNameEn || 'this category'} (e.g. Sponsor or Crew artwork).
              </p>

              <div className="flex items-center gap-2">
                <label className="flex-1 px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer flex items-center justify-center gap-2 transition shadow-xs">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>{activeColors.watermarkUrl ? 'Replace Card Artwork' : 'Upload Card Artwork (PNG/JPG)'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setActiveColors((prev) => ({ ...prev, watermarkUrl: reader.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
              <span className="text-xs text-slate-400">Autosaved to database on click</span>
              <button
                onClick={handleSaveTheme}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Theme Palette'}
              </button>
            </div>
          </div>

          {/* Right Preview Viewport */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  CR80 Physical Card Canvas Preview
                </h2>
                <p className="text-xs text-slate-500">
                  Dimensions: 53.98 mm × 85.60 mm (Standard CR80 PVC Portrait Badge)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Zoom:</span>
                <button
                  onClick={() => setScale(0.75)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    scale === 0.75 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  75%
                </button>
                <button
                  onClick={() => setScale(1.0)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    scale === 1.0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  100%
                </button>
                <button
                  onClick={() => setScale(1.25)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    scale === 1.25 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  125%
                </button>
              </div>
            </div>

            {/* Interactive Card Stage */}
            <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-8 flex items-center justify-center min-h-[380px]">
              <CR80Card
                id="cr80-designer-preview"
                data={sampleCardData}
                theme={activeColors}
                side={side}
                scale={scale}
              />
            </div>

            {/* Geometry Specs */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">STANDARD</span>
                <span className="font-semibold text-slate-800">ISO/IEC 7810 CR80</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">300 DPI RENDER</span>
                <span className="font-semibold text-slate-800">1011 × 638 pixels</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">SECURITY QR</span>
                <span className="font-semibold text-slate-800">Scannable 2D Token</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleAccessGate>
  );
}
