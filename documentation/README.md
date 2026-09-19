# Event ID Card Management System — Developer Documentation

Welcome to the technical documentation for the **Event ID Card Management System** built for **The New English School Trust, Vasad (NEST)**. This documentation provides a comprehensive guide for architects, developers, and operators continuing development, debugging, and deployment.

---

## 📑 Documentation Index

| Document | Description |
|---|---|
| [**1. Database Schema & Migrations**](file:///C:/Users/gpuuser/Documents/event_v1/documentation/DATABASE_SCHEMA_AND_MIGRATIONS.md) | Relational database schema, `physical_form_number` constraints, dynamic card themes, and SQL setup. |
| [**2. Storage & Document Management**](file:///C:/Users/gpuuser/Documents/event_v1/documentation/STORAGE_AND_DOCUMENTS.md) | Supabase Storage buckets, upload policies, master document view, and audit queries. |
| [**3. Auth & RBAC Architecture**](file:///C:/Users/gpuuser/Documents/event_v1/documentation/AUTH_AND_RBAC.md) | User authentication, 7-role RBAC matrix, permission gates, middleware protection, and test accounts. |
| [**4. Registration & Verification Pipeline**](file:///C:/Users/gpuuser/Documents/event_v1/documentation/REGISTRATION_AND_VERIFICATION_WORKFLOW.md) | Streamlined DEO enrollment, 3-document upload, de-duplication, and Maker-Checker verification stage. |
| [**5. Card Design & Print Architecture**](file:///C:/Users/gpuuser/Documents/event_v1/documentation/CARD_DESIGN_AND_PRINTING.md) | CR80 card dimensions, dynamic color engine, secure QR payload hashing, and print queue management. |
| [**6. Upcoming Development Phases**](file:///C:/Users/gpuuser/Documents/event_v1/documentation/UPCOMING_DEVELOPMENT_PHASES.md) | Blueprint for Special ID Cards (`/special-cards`), Mobile Gate Scanner (`/scan`), and Reporting (`/reports`). |

---

## 🚀 Quick Start for Developers

### Prerequisites
* **Node.js**: v18.17+ or v20+
* **Next.js**: 15.1.7 (App Router with React 19)
* **Supabase**: PostgreSQL database with Auth and Storage
* **Ollama (Optional AI Sidecar)**: Bound to `0.0.0.0:11434`

### Running the Application Locally
```bash
# Install dependencies
npm install

# Start development server on port 5500
npm run dev -- -p 5500
```

The application will be accessible at: **`http://localhost:5500`**

### Key Environment Variables (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:5500
NEXT_PUBLIC_DEFAULT_EVENT_CODE=nest
OLLAMA_HOST=0.0.0.0:11434
```

---

## 👥 Seeded Test Accounts (Test Names Only)

All 7 system roles are seeded with standardized test accounts. **Zero personal names** are used in the codebase or database.

* **Shared Default Password**: `TestUser@2026`

| Role Code | Test User Name | Email Address | Permitted Modules |
|---|---|---|---|
| `SUPER_ADMIN` | **Test Super Admin** | `superadmin@test.com` | All 9 Modules + Admin Settings |
| `EVENT_ADMIN` | **Test Event Admin** | `admin@test.com` | Registration, Verification, Card Designer, Print Queue, Special IDs, Scanner, Reports |
| `VERIFIER` | **Test Verifier** | `verifier@test.com` | Verification Desk (`/verification`) & Reports (`/reports`) |
| `DATA_ENTRY_OPERATOR` | **Test Data Entry Operator** | `deo@test.com` | Participant Enrollment Desk (`/registrations/new`) only |
| `SPECIAL_ID_OPERATOR` | **Test Special ID Operator** | `specialid@test.com` | Special Passes (`/special-cards`) & Scanner (`/scan`) |
| `PRINTER_OPERATOR` | **Test Printer Operator** | `printer@test.com` | CR80 Card Print Queue (`/print-queue`) |
| `SECURITY` | **Test Security Officer** | `security@test.com` | Mobile QR Gate Scanner (`/scan`) only |

---

## 🏗️ High-Level System Architecture

```
                                  [ Users & Operators ]
                                            │
                                            ▼
                        ┌──────────────────────────────────────┐
                        │   Next.js 15 Web Application (5500) │
                        │  (Tailwind CSS, App Router, React 19)│
                        └───────────────────┬──────────────────┘
                                            │
                ┌───────────────────────────┼──────────────────────────┐
                ▼                           ▼                          ▼
     [ Supabase Auth (GoTrue) ]     [ PostgreSQL 15 ]          [ Supabase Storage ]
     - Session JWTs                 - Row Level Security (RLS) - event-photos
     - Role claims                  - 15 Core Tables           - event-identity-documents
     - Secure password hashing      - Dynamic Color Themes     - event-public-assets
```

---

## 🎯 Current Phase Status

* ✅ **Phase 1: Project Setup & Environment**: Port 5500, Tailwind CSS, Supabase SSR client.
* ✅ **Phase 2: Database Schema & Storage**: 15 relational tables, mandatory `physical_form_number`, RLS policies.
* ✅ **Phase 3: RBAC & Dynamic Dashboard**: 7 roles, strict module filtering, unauthenticated guest callouts.
* ✅ **Phase 4: Streamlined Enrollment Desk**: English Aadhaar name, mandatory paper form serial # on top, category selector, 3 document attachments.
* ✅ **Phase 5: Verification Station**: Side-by-side 3-viewport inspector (Photo, Aadhaar, Form Scan), approval actions.
* ⏳ **Phase 6: Special ID Cards Desk** (`/special-cards`): Non-registered VIP, trustee, staff, and volunteer passes.
* ⏳ **Phase 7: Mobile QR Gate Scanner** (`/scan`): Camera-based gate turnstile verification with offline caching.
* ⏳ **Phase 8: Reports & Exports** (`/reports`): Real-time analytics, Excel (UTF-8 BOM), and PDF exports.
