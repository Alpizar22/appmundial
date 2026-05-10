-- Migration: restructure user_cards for team-based card IDs
-- Old: card_number INTEGER (1-980)
-- New: carta_id TEXT e.g. "mexico_3", cantidad INTEGER
--
-- WARNING: existing card data cannot be migrated (ID format changed).
-- Users will need to re-mark their collection after this migration.

BEGIN;

-- Add new columns
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS carta_id TEXT;
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS cantidad INTEGER NOT NULL DEFAULT 1;

-- Clear all existing rows (old integer IDs are incompatible with new string IDs)
DELETE FROM user_cards;

-- Make carta_id required
ALTER TABLE user_cards ALTER COLUMN carta_id SET NOT NULL;

-- Remove old columns
ALTER TABLE user_cards DROP COLUMN IF EXISTS card_number;
ALTER TABLE user_cards DROP COLUMN IF EXISTS quantity;

-- Drop any old unique constraint on card_number
ALTER TABLE user_cards DROP CONSTRAINT IF EXISTS user_cards_user_id_card_number_key;

-- Add unique constraint on new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_cards_user_id_carta_id_key'
  ) THEN
    ALTER TABLE user_cards ADD CONSTRAINT user_cards_user_id_carta_id_key UNIQUE (user_id, carta_id);
  END IF;
END $$;

COMMIT;
