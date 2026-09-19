# Upcoming Development Phases & Roadmap

This document serves as the implementation guide for developers continuing work on the remaining system phases.

---

## 🗺️ Development Roadmap

```
[ Phase 1-5: Core & Enrollment ] ──> [ Phase 6: Special IDs ] ──> [ Phase 7: Gate Scanner ] ──> [ Phase 8: Reports ]
            (Complete)                        (Next)                         (Next)                     (Next)
```

---

## 🎟️ Phase 6: Special ID Cards Desk (`/special-cards`)

### Objectives
Provide a fast-track issuance interface for event personnel and VIPs who do not submit paper application forms through the general public registration line.

### Target Pass Categories
1. **VIP Dignitaries & Trustees** (Gold Theme `#B45309`)
2. **Special Guests** (Green Theme `#047857`)
3. **Staff & Organizing Committee Members** (Teal Theme `#0F766E`)
4. **Volunteers** (Orange Theme `#C2410C`)
5. **Press & Media Representatives** (Slate Gray Theme `#374151`)
6. **Security Officers** (Crimson Red Theme `#B91C1C`)

### Technical Implementation Steps
1. **Route**: Create page at `src/app/special-cards/page.tsx`.
2. **Access Control**: Gate access to `['SPECIAL_ID_OPERATOR', 'EVENT_ADMIN', 'SUPER_ADMIN']`.
3. **Inputs Needed**:
   * Recipient Full Name (English)
   * Recipient Contact Number
   * Pass Category (`card_types` where `is_registered = false`)
   * Designations / Department / Gate Access Tier
   * Direct Photo Upload (or default placeholder icon)
4. **Database Logic**: Directly writes to `id_cards` with `status = 'APPROVED'` and automatically queues a print job into `print_jobs`.

---

## 📱 Phase 7: Mobile QR Gate Scanner (`/scan`)

### Objectives
Turn any smartphone or tablet into a turnstile verification device with instant green/red entry feedback and zero attendee PII exposure.

### Technical Implementation Steps
1. **Route**: Create page at `src/app/scan/page.tsx`.
2. **Access Control**: Gate access to `['SECURITY', 'SPECIAL_ID_OPERATOR', 'EVENT_ADMIN', 'SUPER_ADMIN']`.
3. **Camera Pipeline**:
   * Use HTML5 Camera API (`navigator.mediaDevices.getUserMedia`) or `@zxing/browser` for continuous video stream QR code decoding.
   * Audio/Haptic Feedback: Positive chime on valid pass; buzzer tone on duplicate or invalid pass.
4. **Server Verification Action**:
   * Re-computes HMAC-SHA256 hash to confirm badge authenticity.
   * Queries `qr_scans` table to verify if the pass was already scanned at another gate within the same evening session (Anti-Passback rule).
   * Inserts scan event into `qr_scans`.

---

## 📊 Phase 8: Reports & Exports (`/reports`)

### Objectives
Deliver real-time attendee statistics, gate throughput analytics, and one-click data exports for trustees and administration.

### Technical Implementation Steps
1. **Route**: Enhance `src/app/reports/page.tsx`.
2. **Access Control**: Gate access to `['VERIFIER', 'EVENT_ADMIN', 'SUPER_ADMIN']`.
3. **Analytics Metrics**:
   * Total Enrolled vs Approved vs Printed vs Scanned.
   * Category Breakdown: Participants, VIPs, Guests, Staff, Volunteers.
   * Hourly Entry Throughput: Gate traffic heatmaps.
4. **Export Engines**:
   * **Excel / CSV Export**: Must include UTF-8 BOM (`\uFEFF`) to ensure Gujarati and special characters render cleanly in Microsoft Excel.
   * **Printable PDF Roster**: Printable batch rosters sorted by physical form number or village area.

---

## ⚠️ Key Developer Guidelines & Constraints

1. **Port Enforcement**: The Next.js dev server must always be run on **Port 5500** (`npm run dev -- -p 5500`).
2. **English-Only Data Entry**: Do not re-introduce complex Gujarati transliteration inputs to `/registrations/new`. The system auto-mirrors `full_name_en` to `full_name_gu` in PostgreSQL.
3. **Physical Form Serial Mandatory**: Any modifications to the registration action must preserve the mandatory requirement for `physical_form_number`.
4. **Zero Dummy Data in Production**: All seed scripts and tests must use test user accounts with test names (e.g. `Test Super Admin`, `Test DEO`) and never insert fake participants or fake card records.
5. **Webpack Chunk Safety**: Never execute `npm run build` while `next dev` is actively running in the background, as it will overwrite `.next/server/webpack-runtime.js` and cause 500 runtime errors.
