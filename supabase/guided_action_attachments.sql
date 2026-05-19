CREATE TABLE IF NOT EXISTS guided_action_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES guided_diagnostics(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  -- name = préfixe A001_ + libellé + extension (ex: "A001_Mon rapport.pdf")
  -- Le préfixe est généré atomiquement via increment_attachment_counter() à l'upload.
  -- L'utilisateur peut renommer uniquement le libellé (sans toucher au préfixe ni à l'extension).
  name text NOT NULL,
  sharepoint_item_id text NOT NULL,
  mime text,
  size bigint,
  -- annexe_index = valeur du compteur au moment de l'upload (même valeur que dans le préfixe A\d+_)
  annexe_index int,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gaa_diagnostic_action ON guided_action_attachments(diagnostic_id, action_key);
