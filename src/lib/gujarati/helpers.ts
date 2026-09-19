/**
 * Gujarati Unicode range and text validation utilities
 */

// Basic Gujarati Unicode block: U+0A80 - U+0AF0
export const GUJARATI_REGEX = /[\u0A80-\u0AFF]/;

/**
 * Checks whether a given string contains any Gujarati characters.
 */
export function containsGujarati(text: string): boolean {
  if (!text) return false;
  return GUJARATI_REGEX.test(text);
}

/**
 * Validates Indian 10-digit mobile numbers.
 */
export function isValidIndianMobile(mobile: string): boolean {
  if (!mobile) return false;
  const cleaned = mobile.replace(/[\s+-]/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
}

/**
 * Mask sensitive mobile number for public displays: 98765XXXXX -> 98765****0
 */
export function maskMobile(mobile: string): string {
  if (!mobile || mobile.length < 10) return mobile;
  return `${mobile.slice(0, 5)}****${mobile.slice(-1)}`;
}

/**
 * Mask Aadhaar number for security (only show last 4 digits)
 */
export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar) return '';
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `XXXX-XXXX-${digits.slice(-4)}`;
  }
  return 'XXXX-XXXX-XXXX';
}
