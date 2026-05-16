-- Migration: add shell_type column to app_categories
-- shell_type: 'standard' (default) | 'rse' (RSE shell with org/year sidebar)

ALTER TABLE app_categories
  ADD COLUMN IF NOT EXISTS shell_type text NOT NULL DEFAULT 'standard';

UPDATE app_categories
  SET shell_type = 'rse'
  WHERE slug = 'rse';
