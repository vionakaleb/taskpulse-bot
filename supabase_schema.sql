-- Users table
CREATE TABLE tele_users (
  telegram_id BIGINT PRIMARY KEY,
  username TEXT,
  resume_url TEXT,
  skills TEXT[],
  job_titles TEXT[],
  reesu_user_id UUID,
  reesu_access_token TEXT,
  reesu_refresh_token TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Items table
CREATE TABLE tele_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT REFERENCES tele_users(telegram_id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('checklist', 'event', 'bill')),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for cleanup
CREATE INDEX idx_items_created_at ON tele_items(created_at);

-- Cleanup Function: Delete checklist and events older than 2 months
CREATE OR REPLACE FUNCTION cleanup_expired_items()
RETURNS void AS $$
BEGIN
  DELETE FROM tele_items 
  WHERE type IN ('checklist', 'event') 
  AND created_at < NOW() - INTERVAL '2 months';
END;
$$ LANGUAGE plpgsql;

-- Notification logic for Bills (can be triggered by external cron or pg_cron)
-- SELECT telegram_id FROM tele_users JOIN tele_items ON tele_users.telegram_id = tele_items.user_id WHERE tele_items.type = 'bill';
