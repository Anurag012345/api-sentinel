-- Seed Admin User
-- Password is 'password123'
INSERT INTO users (email, password_hash, daily_limit, status)
VALUES
  ('admin@duoforge-sentinel.com', '$2b$10$ilMLSc90ZeRL1UPiKK6XveOTa9FnhZkd4jRs1N5FSrboikUQWzob6', 1000.00, 'active')
ON CONFLICT (email) DO NOTHING;
