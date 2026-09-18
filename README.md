# Event ID Card Management System (નવરાત્રી ૨૦૨૬)

A modern, multi-event ID card management, document verification, physical CR80 card printing, and QR access validation web application built with **Next.js 15 (App Router)** and **Supabase (PostgreSQL 15+ & Storage)**.

---

## 🌟 Key Capabilities & Architectural Highlights

1. **Multi-Event & Multi-Tenant Architecture**:
   - Reusable for Trusts and Non-Profit Organizations (initial deployment: **Navratri 2026 / નવરાત્રી મહોત્સવ ૨૦૨૬**).
   - Strict data isolation by `event_id` and `organization_id`.

2. **First-Class Gujarati Unicode Integration**:
   - Built-in `Noto Sans Gujarati` (Google Fonts) with zero character clipping or missing glyphs.
   - Dual-language input fields (Gujarati & English) for names, relations, and addresses.
   - Excel export with **UTF-8 Byte Order Mark (BOM)** to ensure Gujarati scripts open without corruption in Microsoft Excel.

3. **Strict Maker-Checker RBAC Security**:
   - Granular catalog with 30+ permissions.
   - Server-side authorization (`hasPermission` / `check_user_permission` database function).
   - Operators cannot approve registrations they authored.

4. **Dynamic Card Theme & CR80 Print Engine**:
   - Deterministic theme resolution: `(Category + Gender Rule) => Card Theme`.
   - Preset schemes: Male Registered (Royal Blue), Female Registered (Ruby Pink), VIP (Imperial Gold), Guest (Emerald Green), Security (Crimson Red), Volunteer (Vibrant Orange), Staff (Teal).
   - ISO/IEC 7810 CR80 standard physical dimensions (85.60 mm × 53.98 mm) with web-to-print CSS `@page` media rules.

5. **Controlled Non-Registered / Special Cards**:
   - VIP, Guest, Security, Staff, and Media card issuance guarded by the `PRINT_NON_REGISTERED_ID_CARD` permission.
   - Complete audit trail of issuance, approval, and printing.

6. **Anti-Counterfeit QR Verification**:
   - QR contains solely an unguessable cryptographic token (`tok_...`).
   - Mobile-optimized camera scanner (`/scan`) and public verification endpoint (`/verify/[token]`).
   - **Zero PII Exposure**: Never leaks Aadhaar numbers or private addresses.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js v18.18+ or v20+ / v22+
- Supabase account (Cloud or local Supabase CLI)

### 2. Environment Setup
Copy `.env.example` to `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_EVENT_CODE=NAV-2026
```

### 3. Database Migrations
Execute the migration scripts located in `supabase/migrations/` in order:
1. `20260912000001_initial_schema.sql` (Schema, tables, enums, indexes)
2. `20260912000002_rbac_and_permissions.sql` (Roles, permissions, RPC)
3. `20260912000003_storage_buckets.sql` (Private storage buckets & RLS)
4. `20260912000004_seed_data.sql` (Navratri 2026 Trust, categories, themes)

### 4. Running Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```text
event_v1/
├── docs/                        # Architecture & design specifications (Phase 0)
│   ├── SRS.md
│   ├── ROLES_PERMISSIONS.md
│   ├── WORKFLOWS.md
│   ├── DATABASE_DESIGN.md
│   ├── CARD_THEME_DESIGN.md
│   ├── PRINTING_ARCHITECTURE.md
│   ├── QR_DESIGN.md
│   ├── SECURITY.md
│   └── GUJARATI_SUPPORT.md
├── supabase/
│   └── migrations/              # Version-controlled PostgreSQL migrations
├── src/
│   ├── app/
│   │   ├── page.tsx             # Dashboard portal
│   │   ├── registrations/       # Participant registrations & duplicate check
│   │   ├── verification/        # Verifier maker-checker review queue
│   │   ├── card-designer/       # Dynamic CR80 card theme customizer
│   │   ├── print-queue/         # Physical card print jobs & reprint control
│   │   ├── special-cards/       # Controlled VIP/Guest/Staff cards
│   │   ├── scan/                # Mobile camera QR scanner for security
│   │   ├── verify/[token]/      # Public cardholder verification response
│   │   └── reports/             # Analytics & UTF-8 BOM Excel export
│   ├── components/
│   │   ├── card-renderer/       # CR80Card front & back visual component
│   │   └── forms/               # GujaratiInput dual-script text input
│   ├── lib/
│   │   ├── auth/                # Server-side permission guards
│   │   ├── card-theme/          # Category & gender theme resolution engine
│   │   ├── gujarati/            # Transliteration, masking & export utilities
│   │   └── supabase/            # Browser, server & admin Supabase clients
│   └── types/                   # TypeScript domain models & DDL interfaces
```

# garaba-mahotsav
