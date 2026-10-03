-- ====================================================================
-- Event ID Card Management System - Reports Performance Indexes & RPC
-- Migration: 20260919000001_reports_performance_indexes.sql
-- ====================================================================

-- 1. Enable pg_trgm for ultra-fast substring and text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Indexes on `registrations` to accelerate pagination, sorting, and filters
CREATE INDEX IF NOT EXISTS idx_reg_event_status ON registrations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_reg_event_gender ON registrations(event_id, gender);
CREATE INDEX IF NOT EXISTS idx_reg_event_created ON registrations(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reg_event_category ON registrations(event_id, category_id);
CREATE INDEX IF NOT EXISTS idx_reg_event_regno ON registrations(event_id, registration_number);
CREATE INDEX IF NOT EXISTS idx_reg_event_mobile ON registrations(event_id, mobile);

-- 3. Trigram indexes for fast case-insensitive search across name and mobile
CREATE INDEX IF NOT EXISTS idx_reg_name_en_trgm ON registrations USING gin(full_name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reg_mobile_trgm ON registrations USING gin(mobile gin_trgm_ops);

-- 4. Indexes on `id_cards` for fast joined lookups and print queues
CREATE INDEX IF NOT EXISTS idx_idcards_reg_event ON id_cards(registration_id, event_id);
CREATE INDEX IF NOT EXISTS idx_idcards_event_status ON id_cards(event_id, status);

-- 5. Stored Procedure / RPC for instant KPI and summary aggregation in PostgreSQL (<10ms)
CREATE OR REPLACE FUNCTION get_event_report_summary(p_event_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_summary JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totalRegistrations', (SELECT COUNT(*) FROM registrations WHERE event_id = p_event_id),
    'approved', (SELECT COUNT(*) FROM registrations WHERE event_id = p_event_id AND status = 'APPROVED'),
    'underVerification', (SELECT COUNT(*) FROM registrations WHERE event_id = p_event_id AND status = 'UNDER_VERIFICATION'),
    'correctionRequired', (SELECT COUNT(*) FROM registrations WHERE event_id = p_event_id AND status = 'CORRECTION_REQUIRED'),
    'rejected', (SELECT COUNT(*) FROM registrations WHERE event_id = p_event_id AND status = 'REJECTED'),
    'draft', (SELECT COUNT(*) FROM registrations WHERE event_id = p_event_id AND status = 'DRAFT'),
    'genderBreakdown', jsonb_build_object(
      'MALE', (SELECT COUNT(*) FROM registrations WHERE event_id = p_event_id AND gender = 'MALE'),
      'FEMALE', (SELECT COUNT(*) FROM registrations WHERE event_id = p_event_id AND gender = 'FEMALE'),
      'OTHER', (SELECT COUNT(*) FROM registrations WHERE event_id = p_event_id AND (gender NOT IN ('MALE', 'FEMALE') OR gender IS NULL))
    ),
    'categoryBreakdown', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'code', ct.code,
          'nameEn', ct.name_en,
          'count', sub.cnt
        ) ORDER BY sub.cnt DESC
      )
      FROM (
        SELECT category_id, COUNT(*) AS cnt
        FROM registrations
        WHERE event_id = p_event_id
        GROUP BY category_id
      ) sub
      JOIN card_types ct ON ct.id = sub.category_id
    ), '[]'::jsonb),
    'dailyRegistrations', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', d.dt::text,
          'count', COALESCE(sub.cnt, 0)
        ) ORDER BY d.dt ASC
      )
      FROM (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '13 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS dt
      ) d
      LEFT JOIN (
        SELECT created_at::date AS dt, COUNT(*) AS cnt
        FROM registrations
        WHERE event_id = p_event_id
        GROUP BY created_at::date
      ) sub ON sub.dt = d.dt
    ), '[]'::jsonb),
    'cardsPrinted', (SELECT COUNT(*) FROM id_cards WHERE event_id = p_event_id AND status = 'PRINTED'),
    'cardsQueued', (SELECT COUNT(*) FROM id_cards WHERE event_id = p_event_id AND status = 'PRINT_QUEUED'),
    'totalReprintCount', COALESCE((
      SELECT SUM(NULLIF(metadata->>'reprint_count', '')::integer)
      FROM id_cards
      WHERE event_id = p_event_id
    ), 0),
    'specialCards', (
      SELECT COUNT(*)
      FROM id_cards ic
      JOIN card_types ct ON ic.card_type_id = ct.id
      WHERE ic.event_id = p_event_id AND ct.is_registered = false
    )
  ) INTO v_summary;

  RETURN v_summary;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
