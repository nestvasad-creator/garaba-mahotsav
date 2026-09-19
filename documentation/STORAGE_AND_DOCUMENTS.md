# Storage Architecture & Document Management

This document provides a guide to the Supabase Storage architecture, bucket policies, document relationship models, and SQL queries used to inspect and audit uploaded participant files.

---

## 🗄️ Storage Buckets Overview

The platform uses three dedicated Supabase Storage buckets to isolate sensitive identity documents from public assets:

| Bucket Name | Access Level | Max File Size | Allowed MIME Types | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| **`event-identity-documents`** | **Private** | 10 MB | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` | Aadhaar Card copies (`IDENTITY_PROOF`) & Scanned physical forms (`APPLICATION_FORM`) |
| **`event-photos`** | **Private** | 5 MB | `image/jpeg`, `image/png`, `image/webp` | Candidate portrait photos (`PHOTOGRAPH`) for CR80 ID cards |
| **`event-public-assets`** | **Public** | 5 MB | `image/jpeg`, `image/png`, `image/svg+xml`, `image/webp` | Organization & Trust logos, card header banners, watermarks |

---

## 📂 File Storage Hierarchy & Naming Conventions

Files are saved deterministically using the participant's `registration_id`:

```
event-identity-documents/
└── registrations/
    └── {registration_id}/
        ├── id_proof.pdf (or .png/.jpg)     <-- Aadhaar Card
        └── physical_form.pdf (or .png/.jpg) <-- Physical Form Scan

event-photos/
└── registrations/
    └── {registration_id}/
        └── photo.jpg                        <-- Passport Photo
```

---

## 🔗 Relational Mapping (`documents` Table)

Every file stored in Supabase Storage has a tracking record in `public.documents`:

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique record identifier |
| `registration_id` | UUID | Foreign Key to `registrations.id` |
| `event_id` | UUID | Associated Event |
| `doc_type` | `document_type` | `'APPLICATION_FORM'`, `'IDENTITY_PROOF'`, `'PHOTOGRAPH'` |
| `file_path` | TEXT | Relative storage path (e.g. `registrations/{id}/photo.jpg`) |
| `original_filename`| TEXT | Client original filename |
| `mime_type` | VARCHAR(100) | MIME type (e.g. `image/jpeg`, `application/pdf`) |
| `file_size_bytes` | INTEGER | Exact byte count |
| `status` | `verification_status`| `'PENDING'`, `'VERIFIED'`, `'REJECTED'`, `'CORRECTION_REQUIRED'` |
| `uploaded_by` | UUID | DEO user profile ID |
| `verified_by` | UUID | Verifier user profile ID |

---

## 🔍 Master View: `view_uploaded_documents`

To easily join registrations, categories, and documents, deploy the view from [supabase_storage_queries.sql](file:///C:/Users/gpuuser/Documents/event_v1/supabase_storage_queries.sql):

```sql
SELECT * FROM view_uploaded_documents;
```

### View Schema:
- `document_id`
- `registration_id`
- `physical_form_number` (Physical Paper Form Serial Number)
- `registration_number`
- `full_name_en`
- `mobile`
- `gender`
- `category_name`
- `doc_type` (`PHOTOGRAPH`, `IDENTITY_PROOF`, `APPLICATION_FORM`)
- `original_filename`
- `file_size_kb` / `file_size_mb`
- `bucket_name`
- `file_path`
- `document_status`
- `uploaded_by_name`
- `verified_by_name`
- `uploaded_at`

---

## 🛠️ Ready-to-Run SQL Queries (Supabase SQL Editor)

### 1. View All Documents with Form & Participant Details
```sql
SELECT 
  physical_form_number,
  registration_number,
  full_name_en,
  doc_type,
  file_size_kb,
  bucket_name,
  document_status,
  uploaded_at
FROM view_uploaded_documents
ORDER BY uploaded_at DESC;
```

### 2. Storage Space & Document Count by Type
```sql
SELECT
  doc_type,
  COUNT(*) AS total_files,
  ROUND(SUM(file_size_bytes)::numeric / 1024 / 1024, 2) AS total_size_mb,
  COUNT(CASE WHEN status = 'VERIFIED' THEN 1 END) AS verified,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending
FROM documents
GROUP BY doc_type;
```

### 3. Identify Incomplete Registrations (Missing Any of the 3 Documents)
```sql
SELECT
  r.physical_form_number,
  r.registration_number,
  r.full_name_en,
  CASE WHEN bool_or(d.doc_type = 'PHOTOGRAPH') THEN 'OK' ELSE 'MISSING' END AS photo,
  CASE WHEN bool_or(d.doc_type = 'IDENTITY_PROOF') THEN 'OK' ELSE 'MISSING' END AS aadhaar,
  CASE WHEN bool_or(d.doc_type = 'APPLICATION_FORM') THEN 'OK' ELSE 'MISSING' END AS form_scan
FROM registrations r
LEFT JOIN documents d ON r.id = d.registration_id
GROUP BY r.id, r.physical_form_number, r.registration_number, r.full_name_en
HAVING NOT (
  bool_or(d.doc_type = 'PHOTOGRAPH') AND 
  bool_or(d.doc_type = 'IDENTITY_PROOF') AND 
  bool_or(d.doc_type = 'APPLICATION_FORM')
);
```

### 4. Find Documents for a Given Paper Form Number
```sql
SELECT * FROM view_uploaded_documents 
WHERE physical_form_number = 'FORM-1001';
```

---

## 🔐 Storage Security Policies (RLS)

Storage security is enforced on `storage.objects`:
1. **Insert (DEO & Admins)**: Authenticated users can insert into `event-identity-documents` and `event-photos`.
2. **Read (Verifier & Admins)**: Authenticated users can generate signed URLs or read files from private buckets.
3. **Public Assets**: The `event-public-assets` bucket allows public anonymous read access so browser clients can render trust logos and card backgrounds without token expiration.
