-- Module: Lead Signals Database Schema
-- Version: v1.1.0
-- Target: PostgreSQL 15+
-- Purpose: Store collected signals and calculated opportunity scores

-- Notes:
-- 1. This schema is migration-safe and avoids volatile expressions in index predicates.
-- 2. Required extensions should be installed explicitly by the deployment pipeline.
-- 3. If gen_random_uuid() is used, pgcrypto must be enabled before migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE IF NOT EXISTS lead_grade AS ENUM ('S', 'A', 'B', 'C', 'D');

CREATE TABLE IF NOT EXISTS lead_signals (
    id TEXT PRIMARY KEY,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('tender', 'recruitment', 'news', 'internal_crm')),
    source_name VARCHAR(100),
    url VARCHAR(500),
    content_summary TEXT,
    keywords TEXT[],
    related_entities JSONB DEFAULT '{}'::jsonb,
    budget_min NUMERIC(15, 2),
    budget_max NUMERIC(15, 2),
    currency VARCHAR(3) DEFAULT 'CNY',
    publish_date TIMESTAMPTZ NOT NULL,
    deadline TIMESTAMPTZ,
    expected_start_date TIMESTAMPTZ,
    province VARCHAR(50),
    city VARCHAR(50),
    district VARCHAR(50),
    coordinates GEOGRAPHY(POINT, 4326),
    raw_trust_level NUMERIC(2, 1) DEFAULT 0.7,
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_budget CHECK (
        CASE
            WHEN budget_max IS NOT NULL THEN budget_min IS NOT NULL AND budget_min <= budget_max
            ELSE TRUE
        END
    ),
    CONSTRAINT valid_trust_level CHECK (raw_trust_level >= 0.0 AND raw_trust_level <= 1.0)
);

CREATE INDEX IF NOT EXISTS idx_lead_signals_source_type ON lead_signals(source_type);
CREATE INDEX IF NOT EXISTS idx_lead_signals_publish_date ON lead_signals(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_lead_signals_province_city ON lead_signals(province, city);
CREATE INDEX IF NOT EXISTS idx_lead_signals_keywords ON lead_signals USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_lead_signals_budget_range ON lead_signals(budget_min, budget_max) WHERE budget_max IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_signals_deadline ON lead_signals(deadline) WHERE deadline IS NOT NULL;

COMMENT ON TABLE lead_signals IS 'Raw collected signals from supported data sources';
COMMENT ON COLUMN lead_signals.source_type IS 'Signal source type: tender|recruitment|news|internal_crm';
COMMENT ON COLUMN lead_signals.keywords IS 'Extracted technical keywords relevant to product matching';
COMMENT ON COLUMN lead_signals.raw_trust_level IS 'Initial trust confidence based on source reputation';

CREATE TABLE IF NOT EXISTS lead_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id TEXT REFERENCES lead_signals(id) ON DELETE CASCADE,
    opportunity_score NUMERIC(5, 2) NOT NULL CHECK (opportunity_score BETWEEN 0 AND 100),
    grade lead_grade NOT NULL,
    win_probability NUMERIC(5, 4) NOT NULL CHECK (win_probability BETWEEN 0 AND 1),
    meddic_metrics_score INTEGER DEFAULT 0 CHECK (meddic_metrics_score BETWEEN 0 AND 5),
    meddic_economic_buyer_score INTEGER DEFAULT 0 CHECK (meddic_economic_buyer_score BETWEEN 0 AND 5),
    meddic_decision_criteria_score INTEGER DEFAULT 0 CHECK (meddic_decision_criteria_score BETWEEN 0 AND 5),
    meddic_decision_process_score INTEGER DEFAULT 0 CHECK (meddic_decision_process_score BETWEEN 0 AND 5),
    meddic_identify_pain_score INTEGER DEFAULT 0 CHECK (meddic_identify_pain_score BETWEEN 0 AND 5),
    meddic_champion_score INTEGER DEFAULT 0 CHECK (meddic_champion_score BETWEEN 0 AND 5),
    total_meddic_raw_score INTEGER CHECK (total_meddic_raw_score BETWEEN 0 AND 30),
    scored_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    scored_by VARCHAR(50) DEFAULT 'GLM51_MEDDIC_V1',
    top_driving_factors TEXT[],
    missing_factors TEXT[],
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(signal_id, scored_at),
    CONSTRAINT valid_win_prob CHECK (win_probability >= 0.0 AND win_probability <= 1.0),
    CONSTRAINT consistent_total_score CHECK (
        total_meddic_raw_score = meddic_metrics_score +
                                  meddic_economic_buyer_score +
                                  meddic_decision_criteria_score +
                                  meddic_decision_process_score +
                                  meddic_identify_pain_score +
                                  meddic_champion_score
    )
);

CREATE INDEX IF NOT EXISTS idx_opportunities_grade_score ON lead_opportunities(grade, opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_scored_at ON lead_opportunities(scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_missing_factors ON lead_opportunities USING GIN(missing_factors);
CREATE INDEX IF NOT EXISTS idx_opportunities_signal_lookup ON lead_opportunities(signal_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lead_opportunities_timestamp ON lead_opportunities;
CREATE TRIGGER update_lead_opportunities_timestamp
BEFORE UPDATE ON lead_opportunities
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE lead_opportunities IS 'Calculated opportunity scores from MEDDIC algorithm execution';
COMMENT ON COLUMN lead_opportunities.total_meddic_raw_score IS 'Sum of all 6 MEDDIC dimensions (0-30 max)';
COMMENT ON COLUMN lead_opportunities.top_driving_factors IS 'Array of dimension names that contributed most to high score';
COMMENT ON COLUMN lead_opportunities.missing_factors IS 'Array of weak dimensions requiring sales intervention';
