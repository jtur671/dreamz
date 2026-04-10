-- Migration: 024_subscription_tier_rpc.sql
-- Purpose: Add service_role-only RPC to update subscription_tier
-- Date: 2026-04-09
--
-- Context:
--   Migration 022 locked subscription_tier and reading_count to OLD values
--   in profiles_view_update(), which is correct for security — authenticated
--   users must not be able to promote themselves to premium.
--
--   However, this also blocks legitimate server-side updates. RevenueCat
--   webhook handlers and E2E test helpers need a safe, controlled way to
--   change a user's tier.
--
-- Fix:
--   Create a SECURITY DEFINER function that validates the tier value and
--   updates private.profiles_encrypted directly. Access is restricted to
--   service_role only (REVOKE from PUBLIC and authenticated).

BEGIN;

-- Service-role-only function to update subscription tier
-- Used by: RevenueCat webhook handler, E2E test helpers
CREATE OR REPLACE FUNCTION public.update_subscription_tier(
  p_user_id uuid,
  p_tier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private
AS $$
BEGIN
  IF p_tier NOT IN ('free', 'premium') THEN
    RAISE EXCEPTION 'Invalid tier: %. Must be free or premium', p_tier;
  END IF;

  UPDATE private.profiles_encrypted
    SET subscription_tier = p_tier,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_subscription_tier(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_subscription_tier(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_subscription_tier(uuid, text) TO service_role;

COMMIT;
