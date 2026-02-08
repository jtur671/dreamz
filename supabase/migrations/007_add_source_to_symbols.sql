-- Migration: Add source column to symbols table
-- Distinguishes curated symbols from scraped/imported ones

-- Add source column
ALTER TABLE symbols
ADD COLUMN IF NOT EXISTS source text DEFAULT 'curated';

-- Tag all existing symbols as curated
UPDATE symbols SET source = 'curated' WHERE source IS NULL;

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_symbols_source ON symbols(source);

COMMENT ON COLUMN symbols.source IS 'Origin of symbol: curated, dreammoods, etc.';
