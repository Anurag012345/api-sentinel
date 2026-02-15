-- ============================================================
-- API Sentinel — V2 Migration Script
-- Purpose: Upgrades existing V1 database to V2 multi-provider schema without data loss.
-- Run this script in your Supabase SQL Editor.
-- ============================================================

-- 1. Create new tables if they don't exist yet
--    (Safe to run even if tables exist)

CREATE TABLE IF NOT EXISTS providers (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name      TEXT NOT NULL CHECK (provider_name IN ('OPENAI', 'CLAUDE')),
  encrypted_api_key  TEXT,
  limit_type         TEXT DEFAULT 'DOLLAR' CHECK (limit_type IN ('DOLLAR', 'TOKEN')),
  daily_limit        NUMERIC DEFAULT 0,
  warning_percentage NUMERIC DEFAULT 80,
  current_state      TEXT DEFAULT 'NORMAL' CHECK (current_state IN ('NORMAL', 'WARNING', 'BLOCKED', 'SYNC_ERROR')),
  last_synced_at     TIMESTAMP WITH TIME ZONE,
  sync_status        TEXT DEFAULT 'PENDING' CHECK (sync_status IN ('OK', 'ERROR', 'PENDING')),
  last_reset_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_key_valid       BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider_name)
);

CREATE TABLE IF NOT EXISTS usage_records (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id   UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  bucket_time   TIMESTAMP WITH TIME ZONE NOT NULL,
  input_tokens  BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  total_tokens  BIGINT DEFAULT 0,
  cost          NUMERIC DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_totals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id    UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cost     NUMERIC DEFAULT 0,
  total_tokens   BIGINT DEFAULT 0,
  input_tokens   BIGINT DEFAULT 0,
  output_tokens  BIGINT DEFAULT 0,
  last_updated   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(provider_id, date)
);

CREATE TABLE IF NOT EXISTS alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id  UUID REFERENCES providers(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,
  message      TEXT,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS state_change_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  from_state   TEXT NOT NULL,
  to_state     TEXT NOT NULL,
  reason       TEXT,
  cost_at_change NUMERIC,
  changed_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_providers_user ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_state ON providers(current_state);
CREATE INDEX IF NOT EXISTS idx_usage_records_provider_date ON usage_records(provider_id, date);
CREATE INDEX IF NOT EXISTS idx_usage_records_bucket ON usage_records(provider_id, bucket_time);
CREATE INDEX IF NOT EXISTS idx_daily_totals_provider_date ON daily_totals(provider_id, date);
CREATE INDEX IF NOT EXISTS idx_alerts_user_triggered ON alerts(user_id, triggered_at);
CREATE INDEX IF NOT EXISTS idx_state_change_logs_provider ON state_change_logs(provider_id, changed_at);

-- 3. RLS Policies (Enable for new tables)
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_change_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'providers' AND policyname = 'providers_self_access') THEN
        CREATE POLICY providers_self_access ON providers FOR ALL USING (user_id = auth.uid());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'usage_records' AND policyname = 'usage_records_self_access') THEN
        CREATE POLICY usage_records_self_access ON usage_records FOR ALL USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_totals' AND policyname = 'daily_totals_self_access') THEN
        CREATE POLICY daily_totals_self_access ON daily_totals FOR ALL USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alerts' AND policyname = 'alerts_self_access') THEN
        CREATE POLICY alerts_self_access ON alerts FOR ALL USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'state_change_logs' AND policyname = 'state_change_logs_self_access') THEN
        CREATE POLICY state_change_logs_self_access ON state_change_logs FOR ALL USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));
    END IF;
END $$;

-- 4. MIGRATE DATA: Existing Users -> Providers Table (OpenAI)
INSERT INTO providers (user_id, provider_name, encrypted_api_key, daily_limit, current_state, is_key_valid)
SELECT 
  id, 
  'OPENAI', 
  encrypted_api_key, 
  daily_limit,
  CASE status 
    WHEN 'active' THEN 'NORMAL' 
    WHEN 'paused' THEN 'BLOCKED' 
    ELSE 'NORMAL' 
  END,
  CASE WHEN encrypted_api_key IS NOT NULL THEN TRUE ELSE FALSE END
FROM users
WHERE encrypted_api_key IS NOT NULL
ON CONFLICT (user_id, provider_name) DO NOTHING;

-- 5. MIGRATE DATA: Old Usage Logs -> Daily Totals
INSERT INTO daily_totals (provider_id, date, total_cost, last_updated)
SELECT 
  p.id,
  ul.date,
  ul.total_cost,
  ul.checked_at
FROM usage_logs ul
JOIN providers p ON p.user_id = ul.user_id AND p.provider_name = 'OPENAI'
ON CONFLICT (provider_id, date) DO NOTHING;


-- 6. CLEANUP (Optional - Uncomment to remove old columns/tables after verifying verify migration)
-- ALTER TABLE users DROP COLUMN IF EXISTS encrypted_api_key;
-- ALTER TABLE users DROP COLUMN IF EXISTS daily_limit;
-- ALTER TABLE users DROP COLUMN IF EXISTS status;
-- DROP TABLE IF EXISTS usage_logs;
