# Software Requirements Specification (SRS)
## Event ID Card Management System

---

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for the **Event ID Card Management System**, an enterprise web application designed for Trusts and Non-Profit Organizations to manage end-to-end event registration, document verification, dynamic physical ID card generation, controlled special-access card issuance, QR-code validation, and comprehensive audit reporting.

### 1.2 Scope
The application is a **multi-tenant, multi-event system** with its initial target deployment for **Navratri 2026**. It provides:
- Dual-script support (Gujarati and English) across all inputs, reports, and generated cards.
- Strict Role-Based Access Control (RBAC) with maker-checker operational segregation.
- Dynamic theme resolution based on card categories and optional gender rules.
- High-fidelity CR80 ID card generation and print queue management.
- Controlled issuance of non-registered access cards (VIP, Guest, Security, Staff, etc.).
- Offline/Online mobile QR validation without exposing sensitive Personal Identifiable Information (PII).
- Immutable audit logging across all administrative, verification, and printing activities.

---

## 2. Overall Description

### 2.1 User Classes & Roles
1. **Super Admin**: Complete administrative control over organizations, events, RBAC schemas, system settings, and global audit logs.
2. **Event Admin**: Configures event parameters, card categories, theme color palettes, print queues, and user assignments for specific events.
3. **Verifier**: Reviews submitted participant registrations, inspects identity proofs, validates details against guidelines, approves or rejects registrations, and requests corrections.
4. **Data Entry Operator**: Registers participants, enters demographic details in English and Gujarati, uploads identity documents and photos. Cannot approve records or issue cards.
5. **Special ID Operator**: Authorized operator capable of creating, validating, and submitting non-registered special cards (Guests, VIPs, Staff, Media).
6. **Printer Operator**: Accesses the physical card print queue, triggers individual or batch card prints, and requests controlled reprints with documented justifications.
7. **Security / Gate Keeper**: Operates the mobile-friendly QR scanner portal to verify card legitimacy, validity period, and category access at event entry points.

### 2.2 Operating Environment
- **Client**: Modern web browsers (Chrome, Edge, Safari, Firefox) on desktop and mobile devices.
- **Server**: Next.js App Router (Node.js runtime) deployed on Vercel or containerized environments.
- **Database & Storage**: Supabase (PostgreSQL 15+ with UTF-8 encoding) and Supabase Storage for encrypted, private document management.
- **Printing**: CR80 standard thermal/retransfer plastic card printers (Zebra, Evolis, Magicard, Fargo) via browser print CSS and local print agents.

---

## 3. Functional Requirements

### 3.1 Multi-Event Architecture
- **FR-1.1**: The system shall support multiple independent events under one or more Organizations.
- **FR-1.2**: All participant registrations, cards, themes, and audit records must be strictly isolated by `event_id`.
- **FR-1.3**: Authorized users can switch active event contexts seamlessly via the application header.

### 3.2 Registration & Data Entry
- **FR-2.1**: Support entry of full names, addresses, father/husband names, and remarks in **Gujarati Unicode** alongside English.
- **FR-2.2**: Asynchronous duplicate detection checking mobile number and name+mobile combinations upon input blur.
- **FR-2.3**: Secure document upload for Physical Application Form, Government Identity Proof (e.g., Aadhaar, Voter ID), and Passport Photograph.
- **FR-2.4**: Auto-generation of structured registration numbers (e.g., `NAV-2026-000001`).
- **FR-2.5**: Status workflow management: `DRAFT` → `SUBMITTED` → `UNDER_VERIFICATION` → `APPROVED` / `REJECTED` / `CORRECTION_REQUIRED`.

### 3.3 Verification & Approval (Maker-Checker)
- **FR-3.1**: Verifiers shall access a dedicated queue filtered by status, category, and date range.
- **FR-3.2**: Secure document viewer providing zoom, pan, and side-by-side comparison using short-lived signed URLs (max 300s).
- **FR-3.3**: Maker-checker constraint: The user who created or edited a registration record cannot approve it.
- **FR-3.4**: Rejection and Correction workflows require mandatory textual remarks detailing deficiencies.

### 3.4 Card Themes & Dynamic Rendering
- **FR-4.1**: Card categories (Registered Participant, VIP, Guest, Security, Volunteer, Staff, Media, Committee) with customizable colors.
- **FR-4.2**: Theme resolution engine: Resolves `(Category + Gender Rule) => Card Theme`.
- **FR-4.3**: Pixel-perfect CR80 layout (85.60 mm × 53.98 mm) rendered via HTML5 Canvas/SVG at 300 DPI (1011 × 638 px).
- **FR-4.4**: Native embedding of `Noto Sans Gujarati` font across preview, print, and export engines.

### 3.5 Physical Card Printing & Queue
- **FR-5.1**: Approved registrations automatically generate an active `id_card` record and assign an encrypted QR token.
- **FR-5.2**: Print jobs tracked through state machine: `QUEUED` → `PRINTING` → `PRINTED` → `FAILED` / `CANCELLED`.
- **FR-5.3**: Controlled reprinting requiring explicit permission (`REPRINT_CARD`), mandatory reason selection, and audit logging.

### 3.6 Non-Registered & Special Access Cards
- **FR-6.1**: Direct issuance workflow for VIPs, Guests, Security, and Contractors without participant registration.
- **FR-6.2**: Strict server-side permission check (`PRINT_NON_REGISTERED_ID_CARD`). Unprivileged requests must return HTTP 403.
- **FR-6.3**: Two-step approval for high-privilege access cards prior to print eligibility.

### 3.7 QR Verification & Access Control
- **FR-7.1**: QR code payload contains solely a non-sensitive unique cryptographic token.
- **FR-7.2**: Scan endpoint returns: Validity status, holder photo, names (Gujarati & English), category, and valid date range.
- **FR-7.3**: Sensitive PII (Aadhaar number, complete home address) is strictly prohibited from the verification response.
- **FR-7.4**: Each verification attempt is recorded in the `qr_scans` table with timestamp and gate identifier.

### 3.8 Reporting & Export
- **FR-8.1**: Real-time analytics dashboard displaying registration, verification, card, and print job counts.
- **FR-8.2**: Excel export with UTF-8 BOM encoding ensuring accurate Gujarati script rendering in Microsoft Excel.
- **FR-8.3**: PDF report generation with embedded Gujarati Unicode typography.
- **FR-8.4**: Comprehensive security audit trail covering all entity modifications and sensitive document views.

---

## 4. Non-Functional Requirements

### 4.1 Security & Privacy
- Zero trust server-side authorization on all API routes and Server Actions.
- Ephemeral access tokens for sensitive identity documents stored in Supabase private buckets.
- Strict Aadhaar masking (only last 4 digits stored or displayed if collected).

### 4.2 Performance & Reliability
- Card preview rendering latency < 200ms.
- QR scan response latency < 500ms on 4G mobile networks.
- Automatic database transaction rollbacks upon partial failure in multi-step workflows.

### 4.3 Internationalization
- UTF-8 character encoding throughout database, backend services, API communication, and frontend presentation.
- Dual-script support with Gujarati as a primary, first-class citizen alongside English.
