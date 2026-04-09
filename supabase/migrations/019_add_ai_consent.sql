-- Add AI consent tracking columns to profiles
ALTER TABLE profiles
  ADD COLUMN ai_consent_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN ai_consent_date timestamptz;

-- Backfill: grant consent to all existing users
-- They signed up under the original privacy policy which disclosed AI usage
UPDATE profiles
  SET ai_consent_granted = true,
      ai_consent_date = NOW()
  WHERE ai_consent_granted = false;
