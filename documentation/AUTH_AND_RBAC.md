# Authentication & Role-Based Access Control (RBAC)

This document explains the authentication lifecycle, 7-role permission matrix, route protection mechanisms, and test accounts used throughout the system.

---

## 🔐 Authentication Architecture

The system uses **Supabase Auth (GoTrue)** with secure HttpOnly cookie session management:

1. **Client Interaction**: Operators submit credentials via [`/login`](http://localhost:5500/login).
2. **Server Action Validation**: Handled by `signInAction` in [`src/lib/auth/actions.ts`](file:///C:/Users/gpuuser/Documents/event_v1/src/lib/auth/actions.ts).
3. **Session Cookies**: `@supabase/ssr` writes encrypted cookies storing the user session and JWT access token.
4. **Role Retrieval**: `getCurrentUserSession()` queries `user_roles` joined with `roles` using the Service Role admin client to prevent client tampering.

---

## 👥 The 7 System User Roles

| Role Code | Display Name | Workspace Route | Key Responsibilities |
|---|---|---|---|
| `SUPER_ADMIN` | **Super Administrator** | [`/`](http://localhost:5500) *(All)* | Unrestricted platform access across all modules, user creation, role assignment, and audit logs. |
| `EVENT_ADMIN` | **Event Administrator** | [`/`](http://localhost:5500) | Oversees all event day-to-day operations: registration, verifications, printer queues, special passes, and reports. |
| `VERIFIER` | **Verification Officer (Checker)** | [`/verification`](http://localhost:5500/verification) | Reviews uploaded Aadhaar proofs, candidate portrait photos, and scanned paper forms. Approves or rejects registrations. |
| `DATA_ENTRY_OPERATOR` | **Data Entry Operator (Maker)** | [`/registrations/new`](http://localhost:5500/registrations/new) | Enrolls participants by entering physical paper form serials, Aadhaar names, contact numbers, and uploading files. |
| `SPECIAL_ID_OPERATOR` | **Special ID Operator** | [`/special-cards`](http://localhost:5500/special-cards) | Fast-tracks non-registered passes for VIP dignitaries, trustees, staff, volunteers, and press. |
| `PRINTER_OPERATOR` | **Card Printer Operator** | [`/print-queue`](http://localhost:5500/print-queue) | Manages CR80 PVC badge printing, batches print jobs, and handles damaged/lost card reprint approvals. |
| `SECURITY` | **Gate Security Officer** | [`/scan`](http://localhost:5500/scan) | Operates mobile camera QR scanner at venue entry gates. Verifies attendee pass authenticity with zero PII exposure. |

---

## 🛡️ Route & Module Protection Layers

### Layer 1: Next.js Edge Middleware (`src/middleware.ts`)
Protects operational routes before requests reach React components:
```ts
// Protected route rules
'/registrations': ['DATA_ENTRY_OPERATOR', 'EVENT_ADMIN', 'SUPER_ADMIN']
'/verification': ['VERIFIER', 'EVENT_ADMIN', 'SUPER_ADMIN']
'/card-designer': ['EVENT_ADMIN', 'SUPER_ADMIN']
'/print-queue': ['PRINTER_OPERATOR', 'EVENT_ADMIN', 'SUPER_ADMIN']
'/special-cards': ['SPECIAL_ID_OPERATOR', 'EVENT_ADMIN', 'SUPER_ADMIN']
'/scan': ['SECURITY', 'SPECIAL_ID_OPERATOR', 'EVENT_ADMIN', 'SUPER_ADMIN']
'/reports': ['VERIFIER', 'EVENT_ADMIN', 'SUPER_ADMIN']
'/users': ['EVENT_ADMIN', 'SUPER_ADMIN']
'/settings': ['SUPER_ADMIN']
```

### Layer 2: Client Role Access Gate (`RoleAccessGate.tsx`)
If an unauthorized operator directly navigates to a URL, [`RoleAccessGate`](file:///C:/Users/gpuuser/Documents/event_v1/src/components/auth/RoleAccessGate.tsx) renders an unauthorized warning block with a redirect button back to their designated workspace.

### Layer 3: Dynamic Dashboard Filtering (`src/app/page.tsx`)
The home dashboard strictly filters module cards:
* **Unauthenticated Visitors**: Rendered a sign-in callout with quick test credentials.
* **DEO**: Sees only Participant Registration Desk.
* **Verifier**: Sees only Verification Station and Reports.
* **Printer Op**: Sees only CR80 Print Queue.
* **Security**: Sees only Gate QR Scanner.
* **Admin**: Sees all 9 modules.

---

## 🧪 Test Accounts Reference (Test Names Only)

* **Shared Default Password**: `TestUser@2026`

```
┌─────────────────────────┬────────────────────────────┬───────────────────────┐
│ Role Code               │ Test Full Name             │ Test Email Address    │
├─────────────────────────┼────────────────────────────┼───────────────────────┤
│ SUPER_ADMIN             │ Test Super Admin           │ superadmin@test.com   │
│ EVENT_ADMIN             │ Test Event Admin           │ admin@test.com        │
│ VERIFIER                │ Test Verifier              │ verifier@test.com     │
│ DATA_ENTRY_OPERATOR     │ Test Data Entry Operator   │ deo@test.com          │
│ SPECIAL_ID_OPERATOR     │ Test Special ID Operator   │ specialid@test.com    │
│ PRINTER_OPERATOR        │ Test Printer Operator      │ printer@test.com      │
│ SECURITY                │ Test Security Officer      │ security@test.com     │
└─────────────────────────┴────────────────────────────┴───────────────────────┘
```
