# Role-Based Access Control (RBAC) & Permission Matrix

---

## 1. Architectural Philosophy
Security in the Event ID Card Management System is enforced strictly at the **server-side boundary**. Hiding interface buttons or navigations is purely a user experience convenience; every Server Action, Route Handler, and Supabase RPC verifies user permissions against the database before executing any state changes.

---

## 2. Standard System Roles

| Role Identifier | Display Name | Target User | Primary Responsibilities |
|---|---|---|---|
| `SUPER_ADMIN` | Super Administrator | Organization Directors, Head IT | Global tenant configuration, user management, audit review, security policies. |
| `EVENT_ADMIN` | Event Administrator | Trust Event Convener / Manager | Event configuration, card categories, theme customizer, verifier assignment. |
| `VERIFIER` | Document & Registration Verifier | Trust Senior Committee Members | Identity document inspection, detail verification, approval or rejection. |
| `DATA_ENTRY_OPERATOR` | Data Entry Operator | Trust Staff, Temporary Clerks | Participant enrollment, form entry in Gujarati/English, document upload. |
| `SPECIAL_ID_OPERATOR` | Special Card Issuer | Protocol & VIP In-Charge | Creation and issuance of Guest, VIP, Media, and Contractor access cards. |
| `PRINTER_OPERATOR` | Printing Operator | Card Production Staff | Print queue processing, physical printer monitoring, controlled reprints. |
| `SECURITY` | Gate Security / Scanner | Entry Gate Volunteers, Security Guards | Mobile QR code scanning and access validation at event premises. |

---

## 3. Granular Permission Catalog

### 3.1 Registration Operations
- `CREATE_REGISTRATION`: Create draft and submitted participant registrations.
- `EDIT_REGISTRATION`: Modify participant details prior to final approval.
- `VIEW_REGISTRATION`: View registration details and status.
- `DELETE_REGISTRATION`: Hard or soft delete draft/rejected registrations (Super Admin only).
- `SEARCH_REGISTRATION`: Execute demographic and mobile queries.

### 3.2 Document Management
- `UPLOAD_DOCUMENT`: Upload application forms, ID proofs, and photos.
- `VIEW_DOCUMENT`: Inspect sensitive identity documents (generates signed URL).
- `DOWNLOAD_DOCUMENT`: Download high-resolution proof files.
- `VERIFY_DOCUMENT`: Mark individual documents as verified.
- `REJECT_DOCUMENT`: Mark documents as invalid or illegible with feedback.

### 3.3 Approval & Verification
- `APPROVE_REGISTRATION`: Formally approve participant for ID card generation.
- `REJECT_REGISTRATION`: Formally reject participant registration with reason.
- `SEND_FOR_CORRECTION`: Return record to Data Entry Operator for fixes.
- `OVERRIDE_MAKER_CHECKER`: Exceptional permission to approve self-created registrations.

### 3.4 ID Card & Theme Operations
- `GENERATE_REGISTERED_CARD`: Create card record for approved participants.
- `PRINT_REGISTERED_CARD`: Send registered cards to the print queue.
- `REPRINT_CARD`: Request a duplicate card print with mandatory justification.
- `CANCEL_CARD`: Revoke or deactivate an active card.
- `ISSUE_NON_REGISTERED_CARD`: Create special access cards (VIP, Guest, Staff, etc.).
- `APPROVE_NON_REGISTERED_CARD`: Formally approve special cards before printing.
- `PRINT_NON_REGISTERED_ID_CARD`: **CRITICAL**: Send non-registered cards to printer.
- `MANAGE_CARD_THEMES`: Configure color schemes, header/footer styles, and logo assets.
- `MANAGE_CARD_TYPES`: Define custom categories and access levels.

### 3.5 QR Code & Access Control
- `SCAN_QR`: Access the mobile QR scanner portal.
- `VIEW_QR_STATUS`: View card status and holder summary on scan.
- `VIEW_SCAN_LOG`: Access security scan logs and ingress statistics.

### 3.6 Reports & Administration
- `VIEW_REPORTS`: Access analytical dashboards and summary tables.
- `EXPORT_REPORTS`: Export data to Excel (UTF-8 BOM) and PDF.
- `MANAGE_USERS`: Create, invite, and assign roles to system operators.
- `MANAGE_ROLES`: Modify permission sets assigned to roles.
- `MANAGE_EVENTS`: Create and configure event instances.
- `VIEW_AUDIT_LOG`: Inspect the immutable security audit log.

---

## 4. Role-Permission Matrix

| Permission | Super Admin | Event Admin | Verifier | Data Entry | Special ID Op | Printer Op | Security |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `CREATE_REGISTRATION` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `EDIT_REGISTRATION` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `VIEW_REGISTRATION` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `DELETE_REGISTRATION` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `SEARCH_REGISTRATION` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `UPLOAD_DOCUMENT` | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `VIEW_DOCUMENT` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `VERIFY_DOCUMENT` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `APPROVE_REGISTRATION` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `REJECT_REGISTRATION` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `SEND_FOR_CORRECTION` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GENERATE_REGISTERED_CARD`| ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `PRINT_REGISTERED_CARD` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `REPRINT_CARD` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (with reason) | ❌ |
| `CANCEL_CARD` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `ISSUE_NON_REGISTERED_CARD`| ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `APPROVE_NON_REGISTERED_CARD`| ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `PRINT_NON_REGISTERED_ID_CARD`| ✅ | ✅ | ❌ | ❌ | ✅ (if granted)| ❌ | ❌ |
| `MANAGE_CARD_THEMES` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `MANAGE_CARD_TYPES` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `SCAN_QR` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `VIEW_REPORTS` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `EXPORT_REPORTS` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `MANAGE_USERS` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `VIEW_AUDIT_LOG` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 5. Implementation Strategy in Next.js & Supabase

```typescript
// src/lib/auth/permissions.ts
import { createServerClient } from '@/lib/supabase/server';

export async function hasPermission(
  userId: string,
  eventId: string,
  requiredPermission: string
): Promise<boolean> {
  const supabase = await createServerClient();
  
  const { data, error } = await supabase.rpc('check_user_permission', {
    p_user_id: userId,
    p_event_id: eventId,
    p_permission: requiredPermission,
  });

  if (error || !data) {
    return false;
  }
  return data;
}
```

```typescript
// Guarded Action Example
export async function approveRegistrationAction(registrationId: string, eventId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthenticated');

  const allowed = await hasPermission(user.id, eventId, 'APPROVE_REGISTRATION');
  if (!allowed) {
    await recordSecurityViolation(user.id, 'UNAUTHORIZED_APPROVE_ATTEMPT', registrationId);
    throw new Error('403 Forbidden: Insufficient privileges.');
  }

  // Maker-checker constraint validation
  const registration = await getRegistration(registrationId);
  if (registration.created_by === user.id) {
    const canOverride = await hasPermission(user.id, eventId, 'OVERRIDE_MAKER_CHECKER');
    if (!canOverride) {
      throw new Error('Maker-Checker Violation: You cannot approve a record you created.');
    }
  }

  return executeApproval(registrationId, user.id);
}
```
