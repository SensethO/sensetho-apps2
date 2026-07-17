-- 20260717_budget_pieces_dates.sql — Budget association & entreprise :
--   • date_valeur (date comptable de l'écriture) sur les détails de lignes ;
--   • extension du CHECK type_piece des pièces justificatives
--     (facture_client / facture_fournisseur pour les factures SharePoint).
-- Idempotente : ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT IF EXISTS.

-- ── Date de valeur sur les détails ─────────────────────────────────────────
alter table budget_lignes_details
  add column if not exists date_valeur date;

alter table budget_ent_lignes_details
  add column if not exists date_valeur date;

-- ── Extension des types de pièces ──────────────────────────────────────────
alter table budget_pieces
  drop constraint if exists budget_pieces_type_piece_check;
alter table budget_pieces
  add constraint budget_pieces_type_piece_check
  check (type_piece in ('facture','facture_client','facture_fournisseur','devis','contrat','autre'));

alter table budget_ent_pieces
  drop constraint if exists budget_ent_pieces_type_piece_check;
alter table budget_ent_pieces
  add constraint budget_ent_pieces_type_piece_check
  check (type_piece in ('facture','facture_client','facture_fournisseur','devis','contrat','autre'));
