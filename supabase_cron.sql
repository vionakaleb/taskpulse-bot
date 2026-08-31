-- 1. Automated Cleanup: Delete checklists and events older than 2 months
-- This can be scheduled via pg_cron or a GitHub Action calling a Supabase Edge Function.
CREATE OR REPLACE FUNCTION cleanup_expired_items()
RETURNS void AS $$
BEGIN
  DELETE FROM items 
  WHERE type IN ('checklist', 'event') 
  AND created_at < NOW() - INTERVAL '2 months';
END;
$$ LANGUAGE plpgsql;

-- 2. Bill Notification: Identify users who have bills to pay
-- This function returns a list of users who have any 'bill' items
CREATE OR REPLACE FUNCTION get_bill_payers()
RETURNS TABLE(telegram_id BIGINT, username TEXT) AS $$
BEGIN
  RETURN QUERY 
  SELECT DISTINCT u.telegram_id, u.username 
  FROM users u
  JOIN items i ON u.telegram_id = i.user_id
  WHERE i.type = 'bill';
END;
$$ LANGUAGE plpgsql;

-- Schedule examples (if pg_cron is enabled in Supabase):
-- SELECT cron.schedule('0 0 1 * *', 'SELECT cleanup_expired_items()'); -- Every 1st of month
-- SELECT cron.schedule('0 9 1 * *', 'SELECT get_bill_payers()'); -- Trigger notifications on 1st
