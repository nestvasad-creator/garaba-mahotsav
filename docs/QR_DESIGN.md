# QR Code Security Architecture & Verification Engine

---

## 1. Security Philosophy & Threat Model

### 1.1 Anti-Counterfeiting & Privacy Principles
1. **Zero Personally Identifiable Information (PII) in Payload**:
   The QR code string must **never** contain Aadhaar numbers, residential addresses, phone numbers, or passwords.
2. **Opaque Token Design**:
   The QR code embeds solely an unguessable, high-entropy cryptographic token:
   ```text
   QR Payload: https://event.trust.org/verify/tok_9f83a8b27c14e410bfa64e29
   or raw token: tok_9f83a8b27c14e410bfa64e29
   ```
3. **Server-Side Revocation**:
   Because the token is an opaque database foreign key, cancelling or expiring a card immediately reflects at gate scanners without altering the physical card.

---

## 2. Token Generation & QR Format

### 2.1 Cryptographic Token Algorithm
```typescript
import { randomBytes } from 'crypto';

export function generateSecureCardToken(): string {
  // 128-bit cryptographically secure pseudorandom token with prefix
  const rawHex = randomBytes(16).toString('hex');
  return `tok_${rawHex}`;
}
```

### 2.2 QR Parameters
- **Matrix Dimension**: 25 mm × 25 mm on CR80 back layout.
- **Error Correction Level**: Level M (15% recovery) or Level Q (25% recovery) to accommodate surface scratches on physical plastic cards.
- **Quiet Zone**: 4 modules minimum margin around matrix.

---

## 3. Verification API Specification

### Endpoint: `GET /api/verify/[token]`
- **Authentication**: Public or authenticated by gatekeeper credentials (with rate-limiting: 60 requests/min per IP).

#### Response: Valid Active Card
```json
{
  "status": "VALID",
  "card": {
    "cardNumber": "NAV-2026-001245",
    "holderNameEn": "Rahul Patel",
    "holderNameGu": "રાહુલ પટેલ",
    "categoryEn": "Volunteer",
    "categoryGu": "સ્વયંસેવક",
    "photoUrl": "https://supabase.../storage/v1/object/public/event-photos/thumb_1245.jpg",
    "validFrom": "2026-10-01",
    "validTo": "2026-10-12",
    "colorTheme": {
      "primaryColor": "#C2410C",
      "badgeColor": "#FDBA74"
    }
  },
  "message": "Card is active and valid for entry."
}
```

#### Response: Revoked / Cancelled Card
```json
{
  "status": "INVALID",
  "reason": "CARD_REVOKED",
  "message": "This card has been revoked by administration.",
  "revokedAt": "2026-10-04T18:22:10Z"
}
```

#### Response: Token Not Found / Counterfeit
```json
{
  "status": "NOT_FOUND",
  "message": "Security Alert: Invalid or fraudulent QR token."
}
```

---

## 4. Mobile Gate Scanner User Experience

The `/scan` route is optimized for low-end Android/iOS smartphones used by gate guards:
1. Full-screen HTML5 camera viewfinder (`html5-qrcode` library) utilizing rear flashlight where supported.
2. Immediate haptic feedback (vibration: 100ms for Valid, triple buzz for Invalid).
3. Prominent full-screen color banner:
   - 🟢 **Vibrant Green**: Authorized entry with holder photo and Gujarati category badge.
   - 🔴 **Vibrant Red**: Access Denied / Cancelled / Counterfeit warning.
   - 🟡 **Vibrant Amber**: Expired Date / Wrong Zone.
4. Auto-logging of each scan into `qr_scans` table for crowd flow and ingress density analytics.
