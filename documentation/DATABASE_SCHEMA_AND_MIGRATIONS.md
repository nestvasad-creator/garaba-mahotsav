# Database Schema & Migrations Reference

This document provides a complete data dictionary, relational architecture overview, and migration management instructions for the PostgreSQL database hosted on Supabase.

---

## 🏛️ Schema Overview

The database is structured to support multi-event management, strict Maker-Checker verification, PVC card printing, and mobile gate access control.

```
 organizations (1) ──< events (N) ──< card_types (N) ──< card_themes (N)
                             │
                             ├──< user_roles (N) >── user_profiles (1)
                             │
                             └──< registrations (N) ──< documents (N)
                                        │
                                        └──< id_cards (1) ──< print_jobs (N)
                                                   │
                                                   └──< qr_scans (N)
```

---

## 📋 Core Tables Dictionary

### 1. `organizations`
Represents the trust or governing body that hosts events.
* `id` (UUID, PK): Unique organization identifier.
* `name_en` (TEXT, NOT NULL): Official English name (e.g. `The New English School Trust, Vasad`).
* `name_gu` (TEXT, NOT NULL): Organization name in Gujarati.
* `code` (VARCHAR(50), UNIQUE): Short code (e.g. `NEST`).
* `logo_url` (TEXT): Public asset URL for trust logo.

### 2. `events`
Represents individual festival or event instances.
* `id` (UUID, PK): Unique event identifier (`00000000-0000-0000-0000-000000000010`).
* `organization_id` (UUID, FK -> `organizations.id`): Parent organization.
* `name_en` (TEXT, NOT NULL): e.g. `Navratri Mahotsav 2026`.
* `name_gu` (TEXT, NOT NULL): Gujarati title.
* `code` (VARCHAR(50), NOT NULL): Unique per organization (e.g. `NEST`).
* `start_date` / `end_date` (DATE): Event operational window.
* `is_active` (BOOLEAN): Master toggle for event operations.

### 3. `registrations`
Primary table storing enrolled participants and paper application metadata.
* `id` (UUID, PK): Unique record identifier.
* `event_id` (UUID, FK -> `events.id`): Associated event.
* `registration_number` (VARCHAR(50), UNIQUE per event): System assigned badge number (e.g. `NEST-2026-104921`).
* **`physical_form_number`** (VARCHAR(100), NOT NULL): **Physical paper application form serial/token number**. Enforced with unique constraint `uq_registrations_event_physical_form UNIQUE(event_id, physical_form_number)` to prevent entering the same paper form twice.
* `full_name_en` (TEXT, NOT NULL): Full Name as printed on Aadhaar Card (English uppercase).
* `full_name_gu` (TEXT, NOT NULL): Auto-mirrored to prevent constraint errors.
* `gender` (VARCHAR(10), NOT NULL): `'MALE'` or `'FEMALE'` (determines dynamic CR80 color scheme).
* `mobile` (VARCHAR(15), NOT NULL): 10-digit applicant contact number.
* `category_id` (UUID, FK -> `card_types.id`): Assigned participant tier (Participant, VIP, Volunteer, etc.).
* `status` (ENUM `registration_status`):
  * `DRAFT`: Incomplete / saved by DEO.
  * `SUBMITTED`: Completed enrollment awaiting Checker verification.
  * `UNDER_VERIFICATION`: Opened by a verifier.
  * `CORRECTION_REQUIRED`: Marked for data or photo re-upload.
  * `REJECTED`: Permanently declined.
  * `APPROVED`: Verified and approved for card generation.
* `created_by` (UUID, FK -> `user_profiles.id`): The DEO who entered the form.
* `verified_by` (UUID, FK -> `user_profiles.id`): The Verifier who approved/rejected the record.
* `verified_at` (TIMESTAMPTZ): Audit timestamp of decision.
* `verification_remarks` (TEXT): Audit notes or reasons for correction/rejection.

### 4. `documents`
Uploaded file attachments associated with registrations.
* `id` (UUID, PK): Unique document ID.
* `registration_id` (UUID, FK -> `registrations.id`): Parent registration.
* `doc_type` (ENUM `document_type`):
  * `APPLICATION_FORM`: Scanned physical paper form copy.
  * `IDENTITY_PROOF`: Aadhaar Card scan or photo.
  * `PHOTOGRAPH`: Candidate portrait photo.
* `file_path` (TEXT): Storage bucket relative path.
* `original_filename` (TEXT): Name of uploaded file.
* `mime_type` (VARCHAR(100)): File MIME format.
* `file_size_bytes` (INTEGER): Attachment size.
* `status` (ENUM `verification_status`): `PENDING`, `VERIFIED`, `REJECTED`, `CORRECTION_REQUIRED`.

### 5. `card_types`
Tiers and categories of attendees (pure English labels to prevent encoding corruption).
* `id` (UUID, PK): Category UUID.
* `code` (VARCHAR(50)): `REG_PARTICIPANT`, `VIP`, `GUEST`, `VOLUNTEER`, `STAFF`, `SECURITY`, `MEDIA`.
* `name_en` (TEXT): English display name.
* `is_registered` (BOOLEAN): `true` for public applicants; `false` for special non-registered passes.
* `requires_approval` (BOOLEAN): Whether issuance requires admin/checker sign-off.

### 6. `card_themes`
Dynamic color palette engine for physical CR80 badge rendering.
* `id` (UUID, PK): Theme UUID.
* `card_type_id` (UUID, FK -> `card_types.id`): Category.
* `gender_rule` (VARCHAR(10)): `'MALE'`, `'FEMALE'`, or `NULL` (any gender).
* `primary_color` (VARCHAR(20)): Card primary theme color (e.g. `#1E40AF` for Male Blue, `#BE185D` for Female Pink).
* `header_color` / `footer_color` (VARCHAR(20)): Gradient header and footer colors.
* `accent_color` (VARCHAR(20)): Highlight accents (e.g. gold `#F59E0B`).
* `text_color` (VARCHAR(20)): Text contrast color (`#FFFFFF`).

### 7. `id_cards`
Physical printed or approved cards.
* `card_number` (VARCHAR(50), UNIQUE): Printed badge serial number.
* `qr_code_hash` (TEXT): Cryptographically signed QR payload (HMAC-SHA256).
* `status` (ENUM `card_status`): `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PRINT_QUEUED`, `PRINTED`, `REPRINTED`, `CANCELLED`, `EXPIRED`.

### 8. `print_jobs`
Batch print queue tracking.
* `job_number` (VARCHAR(50), UNIQUE): Queue reference ID.
* `status` (ENUM `print_job_status`): `QUEUED`, `PRINTING`, `PRINTED`, `FAILED`, `CANCELLED`.
* `is_reprint` (BOOLEAN): Flag for replacement cards.
* `reprint_reason` (ENUM `reprint_reason_type`): `LOST`, `DAMAGED`, `WRONG_PRINT`, `PRINTER_FAILURE`, `PHOTO_REPLACEMENT`, `OTHER`.

### 9. `qr_scans`
Gate entry verification event logs.
* `card_id` (UUID, FK -> `id_cards.id`): Scanned card.
* `scanner_user_id` (UUID, FK -> `user_profiles.id`): Security guard who scanned.
* `scan_result` (VARCHAR(20)): `'VALID'`, `'EXPIRED'`, `'INVALID'`, `'ALREADY_ENTERED'`.
* `gate_name` (VARCHAR(50)): e.g. `Main Gate - Turnstile 1`.

---

## 🗄️ Supabase Storage Buckets

| Bucket Name | Public Access | Max File Size | Allowed MIME Types | Usage |
|---|---|---|---|---|
| `event-identity-documents` | **Private** | 10 MB | `image/jpeg`, `image/png`, `application/pdf` | Physical form scans & Aadhaar copies (read via ephemeral 300s signed URLs) |
| `event-photos` | **Private** | 5 MB | `image/jpeg`, `image/png`, `image/webp` | Candidate portrait photographs |
| `event-public-assets` | **Public** | 5 MB | `image/jpeg`, `image/png`, `image/svg+xml` | Logos, watermarks, background patterns |

---

## 🚀 Running Migrations

### Complete Database Reset / New Environment
Execute the master script in the Supabase SQL Editor:
* [`supabase/setup_seed.sql`](file:///C:/Users/gpuuser/Documents/event_v1/supabase/setup_seed.sql) *(Primary setup & seed script)*
* [`supabase_complete_setup.sql`](file:///C:/Users/gpuuser/Documents/event_v1/supabase_complete_setup.sql) *(Root-level mirror)*

### Incremental Migration (Existing Database)
If your database is already running and you only need to apply the mandatory `physical_form_number` column:
* [`supabase/migrations/20260916000001_add_physical_form_number.sql`](file:///C:/Users/gpuuser/Documents/event_v1/supabase/migrations/20260916000001_add_physical_form_number.sql)
