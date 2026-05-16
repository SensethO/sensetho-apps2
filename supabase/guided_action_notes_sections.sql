-- Migration: add sections column to guided_action_notes
-- Run via: supabase db query --linked < supabase/guided_action_notes_sections.sql

ALTER TABLE guided_action_notes ADD COLUMN IF NOT EXISTS sections jsonb;
