# Card Theme Engine & Template Specification

---

## 1. Design Overview

The ID Card Theme Engine separates **card identity** (category, gender, event branding) from **presentation logic** (colors, typography, layout coordinates). Colors and layouts must never be hard-coded into UI components.

---

## 2. Category & Gender Resolution Engine

A card holder's visual presentation is resolved deterministically via the following algorithm:

```typescript
export interface CardTheme {
  primaryColor: string;
  headerColor: string;
  footerColor: string;
  accentColor: string;
  textColor: string;
  logoUrl?: string;
  watermarkUrl?: string;
  badgeLabelEn: string;
  badgeLabelGu: string;
}

export function resolveCardTheme(
  cardTypeId: string,
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null,
  themes: CardThemeRecord[]
): CardTheme {
  // Step 1: Look for gender-specific override for this card type
  if (gender) {
    const genderMatch = themes.find(
      (t) => t.card_type_id === cardTypeId && t.gender_rule === gender
    );
    if (genderMatch) return mapToTheme(genderMatch);
  }

  // Step 2: Fall back to generic rule for this card type (gender_rule IS NULL)
  const defaultMatch = themes.find(
    (t) => t.card_type_id === cardTypeId && !t.gender_rule
  );
  if (defaultMatch) return mapToTheme(defaultMatch);

  // Step 3: Global fallback safe default
  return defaultSystemTheme;
}
```

### Default Theme Schemes:

| Category | Gender Rule | Primary Color | Header / Footer | Accent Color | Text Color |
|---|:---:|:---:|:---:|:---:|:---:|
| **Registered Participant** | `MALE` | `#1E40AF` (Royal Blue) | `#1E3A8A` | `#F59E0B` (Amber) | `#FFFFFF` |
| **Registered Participant** | `FEMALE` | `#BE185D` (Ruby Rose) | `#831843` | `#FDE047` (Gold) | `#FFFFFF` |
| **Guest** | Any | `#047857` (Emerald Green) | `#064E3B` | `#6EE7B7` | `#FFFFFF` |
| **Special Guest / VIP** | Any | `#B45309` (Imperial Gold) | `#78350F` | `#FBBF24` | `#FFFFFF` |
| **Security** | Any | `#B91C1C` (Crimson Red) | `#7F1D1D` | `#FCA5A5` | `#FFFFFF` |
| **Volunteer** | Any | `#C2410C` (Vibrant Orange) | `#7C2D12` | `#FDBA74` | `#FFFFFF` |
| **Staff / Committee** | Any | `#0F766E` (Deep Teal) | `#134E4A` | `#5EEAD4` | `#FFFFFF` |
| **Media / Press** | Any | `#374151` (Slate Gray) | `#1F2937` | `#9CA3AF` | `#FFFFFF` |

---

## 3. Physical Card Geometry (CR80 Standard)

Cards adhere to ISO/IEC 7810 ID-1 standard dimensions:

```text
Width:  85.60 mm (3.370 inches)
Height: 53.98 mm (2.125 inches)
Corner Radius: 3.18 mm (0.125 inches)
Aspect Ratio: 1.586
```

### Canvas & Print Resolution Mapping:
- **Screen Display (CSS)**: `324px × 204px` (Preview scaling) or `648px × 408px` (Retina 2x).
- **Physical Print (300 DPI)**: `1011px × 638px`.
- **Bleed Zone**: +2.0 mm on all edges for borderless dye-sublimation card printers.
- **Safe Zone**: 3.5 mm inside outer trim to prevent text clipping during punching.

---

## 4. Card Layout Architecture

### 4.1 Front Side
1. **Header Ribbon (Top 18% / 15.4 mm)**:
   - Left: Trust / Event Logo (SVG or 300 DPI PNG).
   - Center/Right: Event Title in Gujarati (`નવરાત્રી મહોત્સવ ૨૦૨૬`) and English (`NAVRATRI 2026`).
2. **Body Zone (Middle 68% / 36.7 mm)**:
   - Left Column (Width 32 mm):
     - Passport Photo (Aspect 4:5, 28 mm × 35 mm, with rounded border).
   - Right Column (Width 45 mm):
     - Full Name in Gujarati (Font size: 14pt, Semi-Bold, `Noto Sans Gujarati`).
     - Full Name in English (Font size: 10pt, Medium).
     - Card / Registration Number (Monospace bold, e.g., `NAV-2026-001245`).
     - Area / Zone Tag.
     - Category Ribbon Badge (e.g., `સ્વયંસેવક / VOLUNTEER` in inverted accent theme).
3. **Footer Ribbon (Bottom 14% / 7.5 mm)**:
   - Left: Validity Date (`Valid: 01-Oct-2026 to 12-Oct-2026`).
   - Right: Security watermark identifier.

### 4.2 Back Side
1. **Header Ribbon**: Trust Name & Emergency Helpline.
2. **Left Panel (Width 38 mm)**:
   - High-density QR code (25 mm × 25 mm, Level M error correction).
   - Instruction: "Scan for Verification".
3. **Right Panel (Width 40 mm)**:
   - Terms & Conditions in Gujarati (Font size: 6.5pt).
   - Cardholder instructions.
   - Authorized Signature box.
