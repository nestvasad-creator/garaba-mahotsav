# Registration & Verification Workflow Reference

This document outlines the Maker-Checker workflow connecting the **Data Entry Enrollment Desk** (`/registrations/new`) with the **Document Verification Station** (`/verification`).

---

## 🔄 Maker-Checker Pipeline Flow

```
[ Candidate submits paper form ]
               │
               ▼
[ 1. Data Entry Operator (Maker) ] ──> Submits form data & 3 attachments (`/registrations/new`)
               │
               ▼ (Status: SUBMITTED)
[ 2. Document Verifier (Checker) ] ──> Inspects side-by-side viewports (`/verification`)
               │
      ┌────────┴────────┐
      ▼                 ▼
 [ APPROVE ]       [ CORRECTION / REJECT ]
      │                 │
      ▼                 ▼
 [ Generates ID ]  [ Notification / Notes saved in audit log ]
      │
      ▼
 [ CR80 Print Queue ]
```

---

## 📝 1. Enrollment Desk (`/registrations/new`)

Designed for maximum speed and minimal typing errors for operators during large physical queues.

### Form Fields Hierarchy

1. **Physical Paper Form Serial Number (TOP & MANDATORY)**:
   * **Field Key**: `physical_form_number`
   * **Input**: Uppercase alphanumeric (e.g. `FORM-0842`, `B-104`, `00125`).
   * **Validation**: Required before draft save or final submission.
   * **Database Guarantee**: Enforced by `uq_registrations_event_physical_form` to prevent duplicate paper form entry.

2. **Full Name (as per Aadhaar Card)**:
   * **Field Key**: `full_name_en`
   * **Input**: Uppercase English (e.g. `PATEL RAHULKUMAR MAHESHBHAI`).
   * **Database Mapping**: Mirrored to `full_name_gu` in PostgreSQL to satisfy legacy `NOT NULL` schema requirements without forcing operators to dual-type in Gujarati.

3. **Mobile / Contact Number**:
   * **Field Key**: `mobile`
   * **Validation**: 10 digits numeric only.
   * **Real-time De-duplication**: On input blur, triggers `checkDuplicateRegistration()`. If a record with this mobile already exists, displays a visible amber alert banner showing the existing applicant name, registration number, and approval status.

4. **Participant Category / Pass Type**:
   * **Field Key**: `category_id`
   * **Options**: Dynamic dropdown populated from `card_types` (`Registered Participant`, `Special Guest / VIP`, `Guest`, `Volunteer`, `Staff / Committee`, `Security Personnel`, `Media / Press`).
   * **Pure English**: Renders clean English text (`name_en`) to prevent UTF-8 encoding corruption.

5. **Gender**:
   * **Field Key**: `gender` (`MALE` or `FEMALE`).
   * **Dynamic Card Binding**: Gender is captured cleanly without showing hardcoded hex codes on the form. Behind the scenes, the card designer pairs `gender` + `category_id` to select the CR80 card palette (e.g. Male = Royal Blue `#1E40AF`, Female = Deep Pink `#BE185D`).

### Triple Document Attachments Pipeline
Operators attach 3 files using standard file input or camera capture:

| # | Attachment | Destination Bucket | Doc Type ENUM | Accepted Formats |
|---|---|---|---|---|
| **1** | **Physical Filled-Up Form Scan / Copy** | `event-identity-documents` | `APPLICATION_FORM` | Image (`.jpg`, `.png`), PDF (up to 10MB) |
| **2** | **Aadhaar Card Scan / Copy** | `event-identity-documents` | `IDENTITY_PROOF` | Image (`.jpg`, `.png`), PDF (up to 10MB) |
| **3** | **Candidate Portrait Photograph** | `event-photos` | `PHOTOGRAPH` | Image (`.jpg`, `.png`, `.webp` up to 5MB) |

---

## 🔍 2. Verification Desk (`/verification`)

Built for document verifiers (Checkers) to audit applicant details against uploaded identity proofs before badges are sent to print.

### Key Features
1. **Side-by-Side 3-Viewport Inspector**:
   * **Viewport 1 (Left)**: Candidate Portrait Photograph (checks clarity and headshot ratio).
   * **Viewport 2 (Center)**: Aadhaar Card Copy (checks name and identity).
   * **Viewport 3 (Right)**: Physical Application Form Scan (checks applicant signature and serial number).
2. **Ephemeral Signed URLs**:
   * Documents stored in private Supabase Storage buckets are fetched via 300-second ephemeral signed URLs generated on the server, ensuring files are never publicly exposed.
3. **Inspector Header Badges**:
   * Displays the **Assigned Category** badge (e.g. `Registered Participant`, `VIP`).
   * Displays the **Paper Form Serial** badge (e.g. `Form #FORM-0842`).
   * Displays the **Gender** indicator.
4. **Verification Actions**:
   * **Approve (`APPROVE`)**: Sets status to `APPROVED` and generates a print-ready CR80 card in `id_cards`.
   * **Correction Required (`CORRECTION`)**: Attaches reviewer feedback remarks and sends the record back to the DEO queue.
   * **Reject (`REJECT`)**: Flags registration as declined with audit notes.
