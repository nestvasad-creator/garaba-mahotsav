# Gujarati Language Support & Typography Engineering

---

## 1. Principles of Gujarati Unicode Support

The system treats **Gujarati** as a first-class language across all tiers of the application architecture. There must be zero character corruption, missing glyphs (tofu boxes), or ligature clipping.

---

## 2. Typography Standard: Noto Sans Gujarati

### 2.1 Font Selection
- **Primary Typeface**: `Noto Sans Gujarati` (Google Fonts / SIL Open Font License).
- **Secondary Latin Complement**: `Inter` / `Geist Sans` for English alphanumeric text and registration numbers.
- **Font Weights**:
  - Regular (400): Body text, addresses, terms & conditions.
  - Medium (500): Form labels, category names.
  - Semi-Bold (600): Cardholder names, header ribbons.
  - Bold (700): Event headings and card type badges.

### 2.2 Next.js Font Optimization Setup
```typescript
// src/app/layout.tsx
import { Noto_Sans_Gujarati, Inter } from 'next/font/google';

export const notoSansGujarati = Noto_Sans_Gujarati({
  subsets: ['gujarati'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-gujarati',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
```

---

## 3. Gujarati Input Methods

Operators must be able to input Gujarati effortlessly through two mechanisms:

1. **Native OS IME / Phonetic Keyboard**:
   - Windows Gujarati Inscript or Phonetic keyboard (`Ctrl + Shift` to toggle).
   - Chrome / Edge native text input handling UTF-8 directly.
2. **In-App Transliteration Assist (Optional Helper)**:
   - For operators without OS IME installed, an optional phonetic transliteration toggle (e.g., typing `rahul` automatically suggests `રાહુલ`).

---

## 4. Canvas & CR80 Card Rendering with Gujarati

When rendering cards to HTML5 Canvas or SVG for 300 DPI high-resolution output, browsers often fail to measure complex Gujarati ligatures (e.g., `ક્ષ`, `જ્ઞ`, `પ્ર`, `ટ્ટ`).

### Canvas Font Loading Safety Pattern:
```typescript
export async function ensureGujaratiFontLoaded(): Promise<void> {
  // Explicitly wait for the font face to be ready before drawing on canvas
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await document.fonts.load('600 24px "Noto Sans Gujarati"');
    await document.fonts.ready;
  }
}

export function drawCardFront(ctx: CanvasRenderingContext2D, data: CardData) {
  ctx.save();
  ctx.font = '600 22px "Noto Sans Gujarati", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(data.holderNameGu, 140, 90); // Gujarati name
  
  ctx.font = '500 16px "Inter", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(data.holderNameEn, 140, 115); // English name
  ctx.restore();
}
```

---

## 5. Excel & PDF Export Unicode Integrity

### 5.1 Excel / CSV Export
When exporting CSV files containing Gujarati, Microsoft Excel often displays scrambled characters unless a **Byte Order Mark (UTF-8 BOM)** is prefixed:
```typescript
export function exportToCsvWithBom(filename: string, csvContent: string) {
  // Prepend UTF-8 BOM (\uFEFF) so Excel recognises Gujarati encoding immediately
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
```

### 5.2 PDF Generation
Standard PDF engines (like default PDFKit / jsPDF standard fonts) only bundle Latin-1 fonts (Helvetica, Times). They will print question marks or square tofu boxes for Gujarati.
- The project bundles the static `NotoSansGujarati-Regular.ttf` and `NotoSansGujarati-Bold.ttf` inside `public/fonts/`.
- `@react-pdf/renderer` registers these fonts explicitly before generating document streams.
