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
  WITH reg_stats AS (
    SELECT
      COUNT(*) AS total_reg,
      COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved,
      COUNT(*) FILTER (WHERE status = 'UNDER_VERIFICATION') AS under_verification,
      COUNT(*) FILTER (WHERE status = 'CORRECTION_REQUIRED') AS correction_required,
      COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected,
      COUNT(*) FILTER (WHERE status = 'DRAFT') AS draft,
      COUNT(*) FILTER (WHERE gender = 'MALE') AS male_count,
      COUNT(*) FILTER (WHERE gender = 'FEMALE') AS female_count,
      COUNT(*) FILTER (WHERE gender NOT IN ('MALE', 'FEMALE') OR gender IS NULL) AS other_count
    FROM registrations
    WHERE event_id = p_event_id
  ),
  cat_breakdown AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'code', ct.code,
          'nameEn', ct.name_en,
          'count', count(r.id)
        ) ORDER BY count(r.id) DESC
      ),
      '[]'::jsonb
    ) AS cat_data
    FROM card_types ct
    LEFT JOIN registrations r ON r.category_id = ct.id AND r.event_id = p_event_id
    WHERE ct.event_id = p_event_id
    GROUP BY ct.code, ct.name_en
    HAVING count(r.id) > 0
  ),
  daily_trend AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', d.dt::text,
          'count', count(r.id)
        ) ORDER BY d.dt ASC
      ),
      '[]'::jsonb
    ) AS daily_data
    FROM (
      SELECT generate_series(
        CURRENT_DATE - INTERVAL '13 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      )::date AS dt
    ) d
    LEFT JOIN registrations r ON r.created_at::date = d.dt AND r.event_id = p_event_id
    GROUP BY d.dt
  ),
  card_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE ic.status = 'PRINTED') AS cards_printed,
      COUNT(*) FILTER (WHERE ic.status = 'PRINT_QUEUED') AS cards_queued,
      COALESCE(SUM(NULLIF(ic.metadata->>'reprint_count', '')::integer), 0) AS reprint_count,
      COUNT(*) FILTER (WHERE ct.is_registered = false) AS special_cards
    FROM id_cards ic
    LEFT JOIN card_types ct ON ic.card_type_id = ct.id
    WHERE ic.event_id = p_event_id
  )
  SELECT jsonb_build_object(
    'totalRegistrations', COALESCE(rs.total_reg, 0),
    'approved', COALESCE(rs.approved, 0),
    'underVerification', COALESCE(rs.under_verification, 0),
    'correctionRequired', COALESCE(rs.correction_required, 0),
    'rejected', COALESCE(rs.rejected, 0),
    'draft', COALESCE(rs.draft, 0),
    'genderBreakdown', jsonb_build_object(
      'MALE', COALESCE(rs.male_count, 0),
      'FEMALE', COALESCE(rs.female_count, 0),
      'OTHER', COALESCE(rs.other_count, 0)
    ),
    'categoryBreakdown', COALESCE(cb.cat_data, '[]'::jsonb),
    'dailyRegistrations', COALESCE(dt.daily_data, '[]'::jsonb),
    'cardsPrinted', COALESCE(cs.cards_printed, 0),
    'cardsQueued', COALESCE(cs.cards_queued, 0),
    'totalReprintCount', COALESCE(cs.reprint_count, 0),
    'specialCards', COALESCE(cs.special_cards, 0)
  ) INTO v_summary
  FROM reg_stats rs
  CROSS JOIN cat_breakdown cb
  CROSS JOIN daily_trend dt
  CROSS JOIN card_stats cs;

  RETURN v_summary;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
