CREATE TABLE IF NOT EXISTS guided_action_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES guided_diagnostics(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  name text NOT NULL,
  sharepoint_item_id text NOT NULL,
  mime text,
  size bigint,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gaa_diagnostic_action ON guided_action_attachments(diagnostic_id, action_key);
