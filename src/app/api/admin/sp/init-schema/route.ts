/**
 * POST /api/admin/sp/init-schema
 * One-time endpoint to create sp_configs, sp_app_routes, sp_migrations tables.
 * Requires DATABASE_URL env var (Supabase → Settings → Database → Connection string → Direct).
 * Protected by admin role. Delete this file after first successful run.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const SQL = `
-- SharePoint tenant configurations
CREATE TABLE IF NOT EXISTS sp_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tenant_id text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  site_host text NOT NULL,
  site_path text NOT NULL,
  drive_id text,
  root_folder text NOT NULL DEFAULT 'Documents partages',
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sp_configs_unique_default
  ON sp_configs(is_default) WHERE is_default = true;

-- Per-app SharePoint routing
CREATE TABLE IF NOT EXISTS sp_app_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key text NOT NULL UNIQUE,
  sp_config_id uuid REFERENCES sp_configs(id) ON DELETE SET NULL,
  folder_name text NOT NULL,
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
  status text NOT NULL DEFAULT 'pending',
  total_files int NOT NULL DEFAULT 0,
  migrated_files int NOT NULL DEFAULT 0,
  failed_files int NOT NULL DEFAULT 0,
  error_log jsonb NOT NULL DEFAULT '[]',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Auto updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS sp_configs_updated_at ON sp_configs;
CREATE TRIGGER sp_configs_updated_at
  BEFORE UPDATE ON sp_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS sp_app_routes_updated_at ON sp_app_routes;
CREATE TRIGGER sp_app_routes_updated_at
  BEFORE UPDATE ON sp_app_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS sp_migrations_updated_at ON sp_migrations;
CREATE TRIGGER sp_migrations_updated_at
  BEFORE UPDATE ON sp_migrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: only service role can access
ALTER TABLE sp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_app_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_migrations ENABLE ROW LEVEL SECURITY;
`

export async function POST() {
  try {
    // Auth check
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      return NextResponse.json({
        error: 'DATABASE_URL manquante',
        hint: 'Ajoutez DATABASE_URL dans les variables d\'environnement Vercel. Trouvez-la dans Supabase → Project Settings → Database → Connection string (Direct connection).',
      }, { status: 400 })
    }

    // Dynamic import to avoid bundling postgres in client chunks
    const { default: postgres } = await import('postgres')
    const sql = postgres(dbUrl, { ssl: 'require', max: 1, connect_timeout: 15 })

    try {
      await sql.unsafe(SQL)
      await sql.end()
      return NextResponse.json({ ok: true, message: 'Tables sp_configs, sp_app_routes, sp_migrations créées avec succès.' })
    } catch (sqlErr) {
      await sql.end().catch(() => {})
      throw sqlErr
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
