-- ============================================================
-- API Sentinel — Database Initialization Script
-- Run this against your Supabase / Postgres instance.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Users table
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  encrypted_api_key TEXT,
  daily_limit   NUMERIC DEFAULT 0,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. Usage Logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. Alerts table
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_date ON usage_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_alerts_user_triggered ON alerts(user_id, triggered_at);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================================
-- 5. Row-Level Security (RLS) — Enable on Supabase
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own rows
-- (These use Supabase auth.uid(); adjust if using a different auth system.)
-- For backend service calls, use the service_role key which bypasses RLS.

CREATE POLICY users_self_access ON users
  FOR ALL USING (id = auth.uid());

CREATE POLICY usage_logs_self_access ON usage_logs
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY alerts_self_access ON alerts
  FOR ALL USING (user_id = auth.uid());
