-- ====================================================================
-- Event ID Card Management System - RBAC & Permissions Seed
-- ====================================================================

-- Populate Permissions Catalog
INSERT INTO permissions (code, name, category, description) VALUES
  ('CREATE_REGISTRATION', 'Create Registration', 'Registration', 'Create draft and submitted participant registrations'),
  ('EDIT_REGISTRATION', 'Edit Registration', 'Registration', 'Modify participant details prior to approval'),
  ('VIEW_REGISTRATION', 'View Registration', 'Registration', 'View registration details and history'),
  ('DELETE_REGISTRATION', 'Delete Registration', 'Registration', 'Delete draft or rejected registrations'),
  ('SEARCH_REGISTRATION', 'Search Registration', 'Registration', 'Search participant directory'),

  ('UPLOAD_DOCUMENT', 'Upload Document', 'Document', 'Upload application forms and identity proofs'),
  ('VIEW_DOCUMENT', 'View Document', 'Document', 'Access private uploaded identity proofs'),
  ('DOWNLOAD_DOCUMENT', 'Download Document', 'Document', 'Download high resolution identity documents'),
  ('VERIFY_DOCUMENT', 'Verify Document', 'Document', 'Mark documents as verified'),
  ('REJECT_DOCUMENT', 'Reject Document', 'Document', 'Reject documents with feedback'),

  ('APPROVE_REGISTRATION', 'Approve Registration', 'Approval', 'Formally approve participant for ID card issuance'),
  ('REJECT_REGISTRATION', 'Reject Registration', 'Approval', 'Formally reject registration with reason'),
  ('SEND_FOR_CORRECTION', 'Send for Correction', 'Approval', 'Return registration for correction'),
  ('OVERRIDE_MAKER_CHECKER', 'Override Maker-Checker', 'Approval', 'Allow self-approval of authored registrations'),

  ('GENERATE_REGISTERED_CARD', 'Generate Registered Card', 'ID Card', 'Generate ID card for approved registration'),
  ('PRINT_REGISTERED_CARD', 'Print Registered Card', 'ID Card', 'Send registered card to print queue'),
  ('REPRINT_CARD', 'Reprint Card', 'ID Card', 'Request card reprint with mandatory reason'),
  ('CANCEL_CARD', 'Cancel Card', 'ID Card', 'Revoke active card'),
  ('ISSUE_NON_REGISTERED_CARD', 'Issue Special Card', 'ID Card', 'Create non-registered card for VIP/Staff/Guest'),
  ('APPROVE_NON_REGISTERED_CARD', 'Approve Special Card', 'ID Card', 'Approve non-registered card for printing'),
  ('PRINT_NON_REGISTERED_ID_CARD', 'Print Special Card', 'ID Card', 'CRITICAL: Send non-registered card to printer'),
  ('MANAGE_CARD_THEMES', 'Manage Card Themes', 'ID Card', 'Configure colors, headers, and templates'),
  ('MANAGE_CARD_TYPES', 'Manage Card Types', 'ID Card', 'Configure card categories'),

  ('SCAN_QR', 'Scan QR Code', 'Access Control', 'Access QR scanner portal'),
  ('VIEW_QR_STATUS', 'View QR Status', 'Access Control', 'View holder status on scan'),
  ('VIEW_SCAN_LOG', 'View Scan Log', 'Access Control', 'Inspect gate ingress logs'),

  ('VIEW_REPORTS', 'View Reports', 'Reporting', 'Access analytics dashboard and reports'),
  ('EXPORT_REPORTS', 'Export Reports', 'Reporting', 'Export data to Excel and PDF'),

  ('MANAGE_USERS', 'Manage Users', 'Admin', 'Create, invite, and assign roles to users'),
  ('MANAGE_ROLES', 'Manage Roles', 'Admin', 'Modify role-permission mappings'),
  ('MANAGE_EVENTS', 'Manage Events', 'Admin', 'Create and configure events'),
  ('VIEW_AUDIT_LOG', 'View Audit Log', 'Admin', 'Inspect system audit trails')
ON CONFLICT (code) DO NOTHING;

-- Populate Standard Roles
INSERT INTO roles (code, name, description, is_system) VALUES
  ('SUPER_ADMIN', 'Super Administrator', 'Complete system authority across all events', true),
  ('EVENT_ADMIN', 'Event Administrator', 'Manages event configuration, themes and users', true),
  ('VERIFIER', 'Verifier', 'Inspects documents and approves/rejects registrations', true),
  ('DATA_ENTRY_OPERATOR', 'Data Entry Operator', 'Enrolls participants and enters demographic data', true),
  ('SPECIAL_ID_OPERATOR', 'Special ID Operator', 'Issues VIP, Guest, and Staff cards', true),
  ('PRINTER_OPERATOR', 'Printer Operator', 'Operates card printing and queue processing', true),
  ('SECURITY', 'Security Gatekeeper', 'Validates physical cards via QR code scanning', true)
ON CONFLICT (code) DO NOTHING;

-- Assign Permissions to Roles (Helper Function / Procedure)
DO $$
DECLARE
  v_super_admin UUID;
  v_event_admin UUID;
  v_verifier UUID;
  v_data_entry UUID;
  v_special_id UUID;
  v_printer UUID;
  v_security UUID;
BEGIN
  SELECT id INTO v_super_admin FROM roles WHERE code = 'SUPER_ADMIN';
  SELECT id INTO v_event_admin FROM roles WHERE code = 'EVENT_ADMIN';
  SELECT id INTO v_verifier FROM roles WHERE code = 'VERIFIER';
  SELECT id INTO v_data_entry FROM roles WHERE code = 'DATA_ENTRY_OPERATOR';
  SELECT id INTO v_special_id FROM roles WHERE code = 'SPECIAL_ID_OPERATOR';
  SELECT id INTO v_printer FROM roles WHERE code = 'PRINTER_OPERATOR';
  SELECT id INTO v_security FROM roles WHERE code = 'SECURITY';

  -- 1. Super Admin gets ALL permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_super_admin, id FROM permissions
  ON CONFLICT DO NOTHING;

  -- 2. Event Admin gets all except deleting registrations and global overrides
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_event_admin, id FROM permissions
  WHERE code NOT IN ('DELETE_REGISTRATION', 'OVERRIDE_MAKER_CHECKER')
  ON CONFLICT DO NOTHING;

  -- 3. Verifier gets verification, view, and registered card generation
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_verifier, id FROM permissions
  WHERE code IN (
    'VIEW_REGISTRATION', 'SEARCH_REGISTRATION', 'VIEW_DOCUMENT', 'VERIFY_DOCUMENT',
    'REJECT_DOCUMENT', 'APPROVE_REGISTRATION', 'REJECT_REGISTRATION', 'SEND_FOR_CORRECTION',
    'GENERATE_REGISTERED_CARD', 'SCAN_QR', 'VIEW_QR_STATUS', 'VIEW_REPORTS'
  )
  ON CONFLICT DO NOTHING;

  -- 4. Data Entry Operator gets registration creation and document upload ONLY
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_data_entry, id FROM permissions
  WHERE code IN (
    'CREATE_REGISTRATION', 'EDIT_REGISTRATION', 'VIEW_REGISTRATION', 'SEARCH_REGISTRATION',
    'UPLOAD_DOCUMENT'
  )
  ON CONFLICT DO NOTHING;

  -- 5. Special ID Operator gets special card issuance and approval
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_special_id, id FROM permissions
  WHERE code IN (
    'VIEW_REGISTRATION', 'SEARCH_REGISTRATION', 'UPLOAD_DOCUMENT', 'VIEW_DOCUMENT',
    'ISSUE_NON_REGISTERED_CARD', 'APPROVE_NON_REGISTERED_CARD', 'PRINT_NON_REGISTERED_ID_CARD',
    'SCAN_QR', 'VIEW_QR_STATUS'
  )
  ON CONFLICT DO NOTHING;

  -- 6. Printer Operator gets card printing and reprint requests ONLY
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_printer, id FROM permissions
  WHERE code IN (
    'VIEW_REGISTRATION', 'GENERATE_REGISTERED_CARD', 'PRINT_REGISTERED_CARD', 'REPRINT_CARD'
  )
  ON CONFLICT DO NOTHING;

  -- 7. Security gets QR scan and status view ONLY
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_security, id FROM permissions
  WHERE code IN ('SCAN_QR', 'VIEW_QR_STATUS')
  ON CONFLICT DO NOTHING;
END $$;

-- Database Function to Check User Permission
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_event_id UUID,
  p_permission VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_perm BOOLEAN := false;
BEGIN
  -- Check if user has role with permission for this event or globally (event_id IS NULL)
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND (ur.event_id = p_event_id OR ur.event_id IS NULL)
      AND p.code = p_permission
  ) INTO v_has_perm;

  RETURN v_has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
