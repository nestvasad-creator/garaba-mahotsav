# Operational Workflows & State Machine Specifications

---

## 1. Participant Registration Lifecycle

The registration process governs the complete progression of a standard participant from initial form filling to physical card issuance.

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Operator initiates form
    DRAFT --> SUBMITTED : Form filled & documents uploaded
    SUBMITTED --> UNDER_VERIFICATION : Assigned / opened by Verifier
    
    UNDER_VERIFICATION --> CORRECTION_REQUIRED : Discrepancy found
    CORRECTION_REQUIRED --> SUBMITTED : Operator updates & resubmits
    
    UNDER_VERIFICATION --> REJECTED : Invalid credentials / duplicate
    REJECTED --> [*]
    
    UNDER_VERIFICATION --> APPROVED : Approved by Verifier (Maker-Checker verified)
    APPROVED --> CARD_GENERATED : Auto-create ID card & QR token
    CARD_GENERATED --> PRINT_QUEUED : Sent to print queue
    PRINT_QUEUED --> PRINTED : Physical card printed successfully
    
    PRINTED --> REPRINT_REQUESTED : Damaged / Lost / Error
    REPRINT_REQUESTED --> PRINT_QUEUED : Authorized reprint approved
    
    PRINTED --> CANCELLED : Revocation / Misconduct
    CANCELLED --> [*]
```

### State Definitions:
- `DRAFT`: Form partially filled; editable only by the authoring Data Entry Operator.
- `SUBMITTED`: Form finalized, mandatory proofs uploaded, awaiting verifier review.
- `UNDER_VERIFICATION`: Verifier has locked the record for inspection.
- `CORRECTION_REQUIRED`: Returned to data entry with detailed verifier notes.
- `REJECTED`: Permanently rejected with an immutable reason logged.
- `APPROVED`: Passed all verification checks; eligible for card generation.
- `PRINTED`: Card has been physically output on an ID card printer.
- `CANCELLED`: Card revoked; subsequent QR scans report `INVALID/CANCELLED`.

---

## 2. Non-Registered & Special Access Card Workflow

Special access cards (VIP, Guest, Security, Volunteer, Staff, Media) bypass the general registration queue and follow a strictly audited, privileged lifecycle.

```mermaid
sequenceDiagram
    autonumber
    actor Issuer as Special ID Operator
    actor Approver as Event Admin / Super Admin
    participant Server as Next.js Backend
    participant DB as Supabase DB
    actor Printer as Printer Operator

    Issuer->>Server: POST /api/special-cards (Category, Name, Validity, Photo)
    Server->>Server: Verify Permission: ISSUE_NON_REGISTERED_CARD
    alt Unauthorized
        Server-->>Issuer: 403 Forbidden (Audit Logged)
    else Authorized
        Server->>DB: Insert id_cards (Status: PENDING_APPROVAL)
        Server-->>Issuer: 201 Created
    end

    Approver->>Server: POST /api/special-cards/{id}/approve
    Server->>Server: Verify Permission: APPROVE_NON_REGISTERED_CARD
    Server->>DB: Update id_cards (Status: APPROVED, Generate QR Token)
    Server-->>Approver: 200 Approved

    Printer->>Server: POST /api/print-jobs (Send to Queue)
    Server->>Server: Verify Permission: PRINT_NON_REGISTERED_ID_CARD
    alt Missing Print Permission
        Server-->>Printer: 403 Forbidden: Missing Special Print Privilege
    else Permitted
        Server->>DB: Insert print_jobs (Status: QUEUED)
        Server-->>Printer: 200 Queued
    end
```

---

## 3. Controlled Reprint Workflow

Reprinting is a high-risk operational action prone to credential duplication and fraud. It enforces strict audit compliance.

```mermaid
flowchart TD
    A[Printer Operator requests reprint] --> B{Has REPRINT_CARD permission?}
    B -->|No| C[Reject request & Log 403 attempt]
    B -->|Yes| D[Display Reprint Modal]
    D --> E[Operator selects reason: Lost / Damaged / Misprint / Photo Update]
    E --> F[Operator enters mandatory explanatory notes]
    F --> G[Submit Server Action]
    G --> H[Update id_cards: increment reprint_count]
    H --> I[Insert new record in print_jobs with reprint_flag = TRUE]
    I --> J[Write immutable audit_logs entry with user_id & reason]
    J --> K[Card dispatched to printer]
```

---

## 4. Mobile QR Verification Flow

```mermaid
sequenceDiagram
    autonumber
    actor Guard as Security Guard (Mobile Phone)
    participant App as Next.js Scanner Portal
    participant API as Verification API (/api/verify/[token])
    participant DB as Supabase Database

    Guard->>App: Scan Physical Card QR with Camera
    App->>API: GET /api/verify/{token}
    API->>DB: SELECT * FROM id_cards WHERE qr_token = token
    alt Token Not Found
        API->>DB: INSERT INTO qr_scans (status: NOT_FOUND)
        API-->>App: 404 NOT_FOUND (Red Screen: Invalid Card)
    else Token Found
        API->>DB: Check Status & Validity Period
        alt Status != APPROVED && Status != PRINTED
            API->>DB: INSERT INTO qr_scans (status: CANCELLED/EXPIRED)
            API-->>App: 200 INVALID (Red Screen: Card Cancelled or Expired)
        else Card Active
            API->>DB: INSERT INTO qr_scans (status: VALID)
            API-->>App: 200 VALID (Green Screen: Photo, Gujarati Name, Category, Validity)
        end
    end
    App-->>Guard: Render Visual Result with Sound Cue
```
