export type SystemRoleCode =
  | 'SUPER_ADMIN'
  | 'EVENT_ADMIN'
  | 'VERIFIER'
  | 'DATA_ENTRY_OPERATOR'
  | 'SPECIAL_ID_OPERATOR'
  | 'PRINTER_OPERATOR'
  | 'SECURITY';

export interface RoleMetadata {
  code: SystemRoleCode;
  nameEn: string;
  nameGu: string;
  badgeColor: string;
  description: string;
  primaryPath: string;
  allowedPaths: string[];
}

export const ROLE_DEFINITIONS: Record<SystemRoleCode, RoleMetadata> = {
  SUPER_ADMIN: {
    code: 'SUPER_ADMIN',
    nameEn: 'Super Administrator',
    nameGu: 'મુખ્ય વ્યવસ્થાપક (ટ્રસ્ટી)',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Full system control, user management, audit logs, and global overrides.',
    primaryPath: '/users',
    allowedPaths: [
      '/',
      '/users',
      '/registrations',
      '/registrations/new',
      '/verification',
      '/card-designer',
      '/print-queue',
      '/special-cards',
      '/scan',
      '/reports',
      '/settings',
    ],
  },
  EVENT_ADMIN: {
    code: 'EVENT_ADMIN',
    nameEn: 'Event Administrator',
    nameGu: 'ઇવેન્ટ સંચાલક',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Event-level management, card themes, and user role oversight.',
    primaryPath: '/',
    allowedPaths: [
      '/',
      '/users',
      '/registrations',
      '/registrations/new',
      '/verification',
      '/card-designer',
      '/print-queue',
      '/special-cards',
      '/scan',
      '/reports',
      '/settings',
    ],
  },
  VERIFIER: {
    code: 'VERIFIER',
    nameEn: 'Document Verifier',
    nameGu: 'દસ્તાવેજ ચકાસણી ઓપરેટર (Maker-Checker)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Maker-Checker queue: inspect Aadhaar proofs, zoom photos, approve/reject registrations. Cannot register users.',
    primaryPath: '/verification',
    allowedPaths: [
      '/',
      '/verification',
      '/registrations', // Read-only viewing of list
      '/print-queue', // Verifier can view and print cards
      '/reports',
    ],
  },
  DATA_ENTRY_OPERATOR: {
    code: 'DATA_ENTRY_OPERATOR',
    nameEn: 'Data Entry Operator (DEO)',
    nameGu: 'ખેલૈયા ડેટા એન્ટ્રી ઓપરેટર',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Participant registration desk only. Dual Gujarati/English enrollment. Cannot reject registrations or print physical cards.',
    primaryPath: '/registrations',
    allowedPaths: [
      '/',
      '/registrations',
      '/registrations/new',
    ],
  },
  SPECIAL_ID_OPERATOR: {
    code: 'SPECIAL_ID_OPERATOR',
    nameEn: 'Special ID Pass Operator',
    nameGu: 'વિશેષ પાસ ઓપરેટર (VIP/Trustee)',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'Authorized issuance of non-registered VIP, Trustee, Volunteer, and Staff passes.',
    primaryPath: '/special-cards',
    allowedPaths: [
      '/',
      '/special-cards',
      '/registrations',
      '/verification',
      '/print-queue',
    ],
  },
  PRINTER_OPERATOR: {
    code: 'PRINTER_OPERATOR',
    nameEn: 'Physical Card Printer Operator',
    nameGu: 'CR80 પ્રિન્ટિંગ ઓપરેટર',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'CR80 thermal card printing queue, reprint justification logging, and physical badge dispatch.',
    primaryPath: '/print-queue',
    allowedPaths: [
      '/',
      '/print-queue',
      '/registrations',
      '/verification',
    ],
  },
  SECURITY: {
    code: 'SECURITY',
    nameEn: 'Security Gatekeeper',
    nameGu: 'સુરક્ષા ગેટકીપર (ક્યૂઆર સ્કેનર)',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Gate entrance anti-counterfeit QR scanner with offline cache and instant visual pass/fail indicator.',
    primaryPath: '/scan',
    allowedPaths: [
      '/',
      '/scan',
    ],
  },
};

/**
 * Checks if a given role is allowed to access a route.
 */
export function isPathAllowedForRole(roleCode: string | undefined, pathname: string): boolean {
  if (!roleCode) return false;
  const role = ROLE_DEFINITIONS[roleCode as SystemRoleCode];
  if (!role) return false;

  // Exact or prefix match (e.g. /registrations/new matches /registrations)
  return role.allowedPaths.some((allowed) => {
    if (allowed === '/') return pathname === '/';
    return pathname === allowed || pathname.startsWith(allowed + '/');
  });
}

/**
 * Returns whether a role can perform specific sensitive actions.
 */
export function canPerformAction(
  roleCode: string | undefined,
  action:
    | 'REGISTER_PARTICIPANT'
    | 'VERIFY_DOCUMENT'
    | 'REJECT_REGISTRATION'
    | 'PRINT_CARD'
    | 'REPRINT_CARD'
    | 'DESIGN_CARD_THEME'
    | 'ISSUE_SPECIAL_CARD'
    | 'VIEW_SPECIAL_CARD'
    | 'GENERATE_SPECIAL_CARD'
    | 'MANAGE_USERS'
    | 'SCAN_QR'
): boolean {
  if (!roleCode) return false;

  switch (action) {
    case 'REGISTER_PARTICIPANT':
      return [
        'DATA_ENTRY_OPERATOR',
        'EVENT_ADMIN',
        'SUPER_ADMIN',
        'VERIFIER',
        'PRINTER_OPERATOR',
        'SPECIAL_ID_OPERATOR',
      ].includes(roleCode);
    case 'VERIFY_DOCUMENT':
      // Allowed to verify by default across active operators, verifiers and admins
      return [
        'VERIFIER',
        'EVENT_ADMIN',
        'SUPER_ADMIN',
        'PRINTER_OPERATOR',
        'SPECIAL_ID_OPERATOR',
      ].includes(roleCode);
    case 'REJECT_REGISTRATION':
      // Strictly Verifiers and Admins only — DEO is NEVER permitted to reject!
      return ['VERIFIER', 'EVENT_ADMIN', 'SUPER_ADMIN'].includes(roleCode);
    case 'PRINT_CARD':
    case 'REPRINT_CARD':
      // Physical card printing permitted for dedicated printer operators, verifiers, and admins — DEO is strictly excluded!
      return [
        'PRINTER_OPERATOR',
        'VERIFIER',
        'EVENT_ADMIN',
        'SUPER_ADMIN',
        'SPECIAL_ID_OPERATOR',
      ].includes(roleCode);
    case 'DESIGN_CARD_THEME':
      return ['SUPER_ADMIN', 'EVENT_ADMIN'].includes(roleCode);
    case 'VIEW_SPECIAL_CARD':
    case 'GENERATE_SPECIAL_CARD':
    case 'ISSUE_SPECIAL_CARD':
      return ['SPECIAL_ID_OPERATOR', 'EVENT_ADMIN', 'SUPER_ADMIN'].includes(roleCode);
    case 'MANAGE_USERS':
      return ['SUPER_ADMIN', 'EVENT_ADMIN'].includes(roleCode);
    case 'SCAN_QR':
      return [
        'SECURITY',
        'EVENT_ADMIN',
        'SUPER_ADMIN',
        'VERIFIER',
        'DATA_ENTRY_OPERATOR',
        'PRINTER_OPERATOR',
      ].includes(roleCode);
    default:
      return false;
  }
}
