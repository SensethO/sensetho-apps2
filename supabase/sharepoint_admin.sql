-- SharePoint tenant configurations
CREATE TABLE IF NOT EXISTS sp_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- display name, e.g. "Tenant Principal"
  tenant_id text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,           -- stored server-side only, masked in UI
  site_host text NOT NULL,               -- e.g. "scdbpro.sharepoint.com"
  site_path text NOT NULL,               -- e.g. "sites/WebApp-Partage"
  drive_id text,                         -- filled automatically on test connection
  root_folder text NOT NULL DEFAULT 'Documents partages',
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensures exactly one default
CREATE UNIQUE INDEX IF NOT EXISTS sp_configs_unique_default ON sp_configs(is_default) WHERE is_default = true;

-- Per-app SharePoint routing
CREATE TABLE IF NOT EXISTS sp_app_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key text NOT NULL UNIQUE,
  sp_config_id uuid REFERENCES sp_configs(id) ON DELETE SET NULL,
  folder_name text NOT NULL,             -- root folder for this app in SP
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Migration jobs
CREATE TABLE IF NOT EXISTS sp_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_config_id uuid REFERENCES sp_configs(id),
  target_config_id uuid REFERENCES sp_configs(id),
  app_keys text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending', -- pending | running | done | failed
  total_files int NOT NULL DEFAULT 0,
  migrated_files int NOT NULL DEFAULT 0,
  failed_files int NOT NULL DEFAULT 0,
  error_log jsonb NOT NULL DEFAULT '[]',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER sp_configs_updated_at
  BEFORE UPDATE ON sp_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sp_app_routes_updated_at
  BEFORE UPDATE ON sp_app_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sp_migrations_updated_at
  BEFORE UPDATE ON sp_migrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE sp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_app_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_migrations ENABLE ROW LEVEL SECURITY;

-- Only service role (admin) can access these tables
-- API routes use createAdminClient() with service role key which bypasses RLS
-- These policies allow nothing from anon/authenticated to enforce server-only access
CREATE POLICY "sp_configs_no_access" ON sp_configs FOR ALL USING (false);
CREATE POLICY "sp_app_routes_no_access" ON sp_app_routes FOR ALL USING (false);
CREATE POLICY "sp_migrations_no_access" ON sp_migrations FOR ALL USING (false);
