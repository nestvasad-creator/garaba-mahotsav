# CR80 Card Design & Printing Architecture

This document describes the physical CR80 badge design system, dynamic color theme engine, secure QR code generation, and the print queue management pipeline.

---

## 🪪 Physical CR80 Card Specifications

The system targets standard **CR80 PVC Plastic Cards** (credit card format) printed via industrial dye-sublimation / thermal transfer card printers (e.g. Evolis, Fargo, Zebra).

* **Physical Dimensions**: `85.6 mm × 54.0 mm` (3.375 in × 2.125 in)
* **Target DPI**: `300 DPI` (Standard card printer resolution)
* **Pixel Resolution**: `1012 px × 638 px` (includes 2mm bleed edge)
* **Corner Radius**: `3.18 mm` (CR80 standard rounded corners)
* **Aspect Ratio**: `1.585 : 1`

---

## 🎨 Dynamic Theme Engine

Instead of static card styles, badge palettes are resolved dynamically based on the participant's **Category** and **Gender**:

```
[ Registration Record ] ───> (category_id + gender) ───> [ card_themes ] ───> [ Rendered CR80 Card ]
```

### Color Palette Matrix

| Category Code | Category Name | Gender Rule | Primary Color | Header / Footer Color | Accent Color |
|---|---|---|---|---|---|
| `REG_PARTICIPANT` | Registered Participant | `MALE` | **Royal Blue (`#1E40AF`)** | `#1E3A8A` | `#F59E0B` (Gold) |
| `REG_PARTICIPANT` | Registered Participant | `FEMALE` | **Deep Pink (`#BE185D`)** | `#831843` | `#FDE047` (Yellow) |
| `GUEST` | Guest | Any | **Emerald Green (`#047857`)** | `#064E3B` | `#6EE7B7` |
| `VIP` | Special Guest / VIP | Any | **Warm Gold (`#B45309`)** | `#78350F` | `#FBBF24` |
| `SECURITY` | Security Personnel | Any | **Crimson Red (`#B91C1C`)** | `#7F1D1D` | `#FCA5A5` |
| `VOLUNTEER` | Volunteer | Any | **Vibrant Orange (`#C2410C`)** | `#7C2D12` | `#FDBA74` |
| `STAFF` | Staff / Committee | Any | **Teal Cyan (`#0F766E`)** | `#134E4A` | `#5EEAD4` |
| `MEDIA` | Media / Press | Any | **Slate Gray (`#374151`)** | `#1F2937` | `#9CA3AF` |

---

## 🔐 Secure QR Code Architecture

To prevent counterfeit badges, card duplication, and unauthorized entry, badges use a cryptographically signed QR code payload with **zero sensitive PII**:

### QR Payload Structure (JSON)
```json
{
  "c": "CRD-2026-104921",
  "e": "NEST-2026",
  "t": 1790901234,
  "h": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

* `c`: Card serial number.
* `e`: Event identifier code.
* `t`: Epoch timestamp of issuance.
* `h`: HMAC-SHA256 hash computed using the server's private cryptographic secret:
  $$\text{hash} = \text{HMAC-SHA256}(\text{CardNumber} + \text{EventCode} + \text{IssuedAt}, \text{SecretKey})$$

### Gate Turnstile Verification
When scanned by a security guard using [`/scan`](http://localhost:5500/scan):
1. The scanner parses the JSON payload.
2. It re-computes the HMAC-SHA256 signature on the server to verify authenticity.
3. It checks `qr_scans` to verify whether the badge has already entered the arena (prevents passing cards back through the fence).
4. Displays a large green **VALID PASS** or red **INVALID / DUPLICATE PASS** screen to the guard.

---

## 🖨️ Print Queue Station (`/print-queue`)

The print queue allows operators to batch-print badges on demand:

* **Single Card Print**: Renders the individual CR80 SVG badge to standard browser print dialogue formatted for thermal transfer printers.
* **Batch Print**: Bundles approved cards into a continuous multi-page print stream.
* **Reprint Tracking**: Reprints require logging one of the required reason codes in `reprint_reason_type`:
  * `LOST`: Badge lost by applicant.
  * `DAMAGED`: Damaged lamination or PVC card.
  * `WRONG_PRINT`: Ribbon misalignment or printer smudge.
  * `PRINTER_FAILURE`: Paper jam / thermal transfer error.
  * `PHOTO_REPLACEMENT`: Applicant requested photo update.
