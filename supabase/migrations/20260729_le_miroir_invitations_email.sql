-- Le Miroir — envoi des liens d'invitation par Microsoft Graph (transactionnel).
ALTER TABLE public.le_miroir_invitations
  ADD COLUMN IF NOT EXISTS email      TEXT,
  ADD COLUMN IF NOT EXISTS sent_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0;
