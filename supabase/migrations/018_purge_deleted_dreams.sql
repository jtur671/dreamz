-- Purge soft-deleted dreams after 30 days
--
-- Privacy policy promises: "Deleted dreams enter a 30-day soft-delete
-- recovery period, after which they are permanently deleted."
--
-- This migration creates a function and pg_cron job to permanently
-- delete dreams where deleted_at is older than 30 days.
--
-- Requires: pg_cron extension (enabled on Supabase Pro plan)
-- If pg_cron is not available, run the purge function manually via
-- SQL Editor periodically: SELECT purge_deleted_dreams();

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to permanently delete soft-deleted dreams older than 30 days
CREATE OR REPLACE FUNCTION purge_deleted_dreams()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete from the encrypted storage (private schema)
  DELETE FROM private.dreams_encrypted
  WHERE id IN (
    SELECT id FROM private.dreams_encrypted
    WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days'
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    RAISE LOG 'purge_deleted_dreams: permanently deleted % dreams', deleted_count;
  END IF;

  RETURN deleted_count;
END;
$$;

-- Schedule the purge to run daily at 3:00 AM UTC
SELECT cron.schedule(
  'purge-deleted-dreams',
  '0 3 * * *',
  'SELECT purge_deleted_dreams()'
);
