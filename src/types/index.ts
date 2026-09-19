// TypeScript Type Definitions for Event ID Card Management System

export type UserRoleType =
  | 'SUPER_ADMIN'
  | 'EVENT_ADMIN'
  | 'VERIFIER'
  | 'DATA_ENTRY_OPERATOR'
  | 'SPECIAL_ID_OPERATOR'
  | 'PRINTER_OPERATOR'
  | 'SECURITY';

export type RegistrationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_VERIFICATION'
  | 'CORRECTION_REQUIRED'
  | 'REJECTED'
  | 'APPROVED';

export type DocumentType =
  | 'APPLICATION_FORM'
  | 'IDENTITY_PROOF'
  | 'PHOTOGRAPH'
  | 'OTHER';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  message?: string;
  matchedRecord?: {
    registrationNumber: string;
    fullNameEn: string;
    fullNameGu: string;
    mobile: string;
    status: string;
  } | null;
}

export type VerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'CORRECTION_REQUIRED';

export type CardStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PRINT_QUEUED'
  | 'PRINTED'
  | 'REPRINTED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PrintJobStatus =
  | 'QUEUED'
  | 'PRINTING'
  | 'PRINTED'
  | 'FAILED'
  | 'CANCELLED';

export type ReprintReason =
  | 'LOST'
  | 'DAMAGED'
  | 'WRONG_PRINT'
  | 'PRINTER_FAILURE'
  | 'PHOTO_REPLACEMENT'
  | 'OTHER';

export interface Organization {
  id: string;
  name_en: string;
  name_gu: string;
  code: string;
  logo_url?: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  organization_id: string;
  name_en: string;
  name_gu: string;
  code: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  settings?: Record<string, any>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  full_name_en: string;
  full_name_gu?: string | null;
  mobile: string;
  is_active: boolean;
  created_at: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  is_system: boolean;
}

export interface CardType {
  id: string;
  event_id: string;
  code: string;
  name_en: string;
  name_gu: string;
  is_registered: boolean;
  requires_approval: boolean;
}

export interface CardThemeRecord {
  id: string;
  event_id: string;
  card_type_id: string;
  gender_rule?: 'MALE' | 'FEMALE' | null;
  primary_color: string;
  header_color: string;
  footer_color: string;
  accent_color: string;
  text_color: string;
  logo_url?: string | null;
  watermark_url?: string | null;
  template_config?: Record<string, any>;
}

export interface Registration {
  id: string;
  event_id: string;
  registration_number: string;
  physical_form_number?: string | null;
  receipt_number?: string | null;
  full_name_en: string;
  full_name_gu: string;
  father_husband_name_en?: string | null;
  father_husband_name_gu?: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  dob?: string | null;
  mobile: string;
  alternate_mobile?: string | null;
  address_en: string;
  address_gu: string;
  area_zone?: string | null;
  city: string;
  state: string;
  pincode?: string | null;
  status: RegistrationStatus;
  category_id: string;
  created_by?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  verification_remarks?: string | null;
  created_at: string;
  updated_at: string;
  card_type?: CardType;
  documents?: DocumentRecord[];
}

export interface DocumentRecord {
  id: string;
  registration_id: string;
  event_id: string;
  doc_type: DocumentType;
  file_path: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  status: VerificationStatus;
  remarks?: string | null;
  uploaded_by?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
}

export interface IdCard {
  id: string;
  event_id: string;
  registration_id?: string | null;
  card_number: string;
  qr_token: string;
  card_type_id: string;
  theme_id: string;
  holder_name_en: string;
  holder_name_gu: string;
  holder_photo_url?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  valid_from: string;
  valid_to: string;
  status: CardStatus;
  print_count: number;
  reprint_count: number;
  created_by?: string | null;
  approved_by?: string | null;
  created_at: string;
  card_type?: CardType;
  theme?: CardThemeRecord;
}

export interface PrintJob {
  id: string;
  card_id: string;
  event_id: string;
  printer_identifier?: string | null;
  status: PrintJobStatus;
  attempt_count: number;
  error_message?: string | null;
  reprint_flag: boolean;
  reprint_reason?: ReprintReason | null;
  reprint_notes?: string | null;
  requested_by?: string | null;
  printed_at?: string | null;
  created_at: string;
  card?: IdCard;
}

export interface AuditLog {
  id: string;
  event_id?: string | null;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}
