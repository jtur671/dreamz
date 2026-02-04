-- Fix: Add dream_type and zodiac_sign columns that were missing
-- This is a repair migration

-- Add dream_type to dreams table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dreams' AND column_name = 'dream_type'
    ) THEN
        ALTER TABLE dreams ADD COLUMN dream_type text DEFAULT 'dream';
        ALTER TABLE dreams ADD CONSTRAINT dreams_dream_type_check
            CHECK (dream_type IN ('dream', 'nightmare'));
    END IF;
END $$;

-- Add zodiac_sign to profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'zodiac_sign'
    ) THEN
        ALTER TABLE profiles ADD COLUMN zodiac_sign text;
    END IF;
END $$;
