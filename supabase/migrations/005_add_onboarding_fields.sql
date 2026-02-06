-- Migration: Add onboarding fields to profiles table
-- Adds gender, age_range, and onboarding_completed columns

-- Add gender column with predefined values
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS gender text
CHECK (gender IN ('female', 'male', 'non-binary', 'other', 'prefer-not-to-say'));

-- Add age_range column with predefined values
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS age_range text
CHECK (age_range IN ('18-24', '25-34', '35-44', '45-54', '55-64', '65+'));

-- Add onboarding_completed flag (default false for new users, null for existing users)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Comment on new columns
COMMENT ON COLUMN profiles.gender IS 'User gender for personalization (optional)';
COMMENT ON COLUMN profiles.age_range IS 'User age range for analytics (optional)';
COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether user has completed the onboarding flow';
