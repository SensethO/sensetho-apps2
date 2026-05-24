import { Pool, PoolClient } from 'pg'

// ── Types ────────────────────────────────────────────────────────────────────

interface ProjectCredentials {
  url: string; serviceRoleKey: string; dbPassword: string; projectRef: string; pat: string
}
interface TransferOptions {
  schema: boolean; data: boolean; rls: boolean; auth: boolean
  storage: boolean; listFunctions: boolean; listSecrets: boolean
}
interface TransferBody { source: ProjectCredentials; destination: ProjectCredentials; options: TransferOptions }
interface StepEvent { step: string; status: 'running' | 'done' | 'error' | 'info' | 'warn'; msg: string; count?: number }
interface Summary { tables: number; rows: number; users: number; files: number; functions: string[]; secrets: string[]; warnings: string[] }
interface ColumnInfo { column_name: string; data_type: string; character_maximum_length: number | null; numeric_precision: number | null; numeric_scale: number | null; is_nullable: string; column_default: string | null; is_identity: string; identity_generation: string | null }
interface ConstraintInfo { conname: string; contype: string; condef: string }
interface IndexInfo { indexname: string; indexdef: string }
interface PolicyInfo { tablename: string; policyname: string; permissive: string; roles: string[]; cmd: string; qual: string | null; with_check: string | null }
interface FunctionDef { name: string; def: string }
interface EnumInfo { typname: string; enumlabel: string }
interface AuthUser { id: string; email?: string; phone?: string; phone_confirmed_at?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown>; role?: string }
interface StorageBucket { id: string; name: string; public: boolean; file_size_limit: number | null; allowed_mime_types: string[] | null }
interface StorageFile { name: string; id: string | null }
interface EdgeFunction { name: string; slug: string; status: string }
interface SecretEntry { name: string }

// ── Pool factory ──────────────────────────────────────────────────────────────

function buildConnStr(creds: ProjectCredentials, direct = false): string {
  if (direct) return `postgresql://postgres:${creds.dbPassword}@db.${creds.projectRef}.supabase.co:5432/postgres?sslmode=require`
  return `postgresql://postgres.${creds.projectRef}:${creds.dbPassword}@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?sslmode=require`
}

async function createPool(creds: ProjectCredentials): Promise<Pool> {
  for (const direct of [false, true]) {
    const pool = new Pool({ connectionString: buildConnStr(creds, direct), max: 5, connectionTimeoutMillis: 15000, ssl: { rejectUnauthorized: false } })
    try {
      const client = await pool.connect(); await client.query('SELECT 1'); client.release(); return pool
    } catch { await pool.end() }
  }
  throw new Error(`Impossible de se connecter au projet ${creds.projectRef}`)
}

// ── Schema ────────────────────────────────────────────────────────────────────

async function transferSchema(srcClient: PoolClient, destPool: Pool, send: (e: StepEvent) => void, summary: Summary): Promise<string[]> {
  send({ step: 'schema', status: 'running', msg: 'Récupération des types (enums)...' })

  // Enums
  const enumRows = await srcClient.query<EnumInfo>(`
    SELECT t.typname, e.enumlabel FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder`)
  const enumMap = new Map<string, string[]>()
  for (const row of enumRows.rows) { const arr = enumMap.get(row.typname) ?? []; arr.push(row.enumlabel); enumMap.set(row.typname, arr) }
  for (const [typname, labels] of Array.from(enumMap.entries())) {
    const dc = await destPool.connect()
    try { await dc.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typname}') THEN CREATE TYPE "${typname}" AS ENUM (${labels.map((l: string) => `'${l}'`).join(', ')}); END IF; END $$`) }
    catch (e) { send({ step: 'schema', status: 'warn', msg: `Enum ${typname}: ${String(e).substring(0, 80)}` }) }
    finally { dc.release() }
  }

  // Tables
  send({ step: 'schema', status: 'running', msg: 'Récupération des tables...' })
  const tablesRes = await srcClient.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`)
  const tableNames = tablesRes.rows.map(r => r.table_name)
  summary.tables = tableNames.length
  send({ step: 'schema', status: 'running', msg: `${tableNames.length} tables — génération DDL...` })

  const ddl: string[] = []
  for (const tableName of tableNames) {
    const colRes = await srcClient.query<ColumnInfo>(
      `SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default, is_identity, identity_generation
       FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [tableName])
    const conRes = await srcClient.query<ConstraintInfo>(
      `SELECT conname, contype, pg_get_constraintdef(c.oid) as condef FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public' AND t.relname = $1`, [tableName])

    const colDefs = colRes.rows.map(col => {
      let typeDef = col.data_type
      if (col.character_maximum_length) typeDef += `(${col.character_maximum_length})`
      else if (col.numeric_precision && col.numeric_scale !== null) typeDef += `(${col.numeric_precision},${col.numeric_scale})`
      let def = `  "${col.column_name}" ${typeDef}`
      if (col.is_identity === 'YES') def += ` GENERATED ${col.identity_generation === 'ALWAYS' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY`
      else if (col.column_default !== null) def += ` DEFAULT ${col.column_default}`
      if (col.is_nullable === 'NO') def += ' NOT NULL'
      return def
    })
    const conDefs = conRes.rows.filter(c => ['p','u','f'].includes(c.contype)).map(c => `  CONSTRAINT "${c.conname}" ${c.condef}`)
    ddl.push(`CREATE TABLE IF NOT EXISTS "${tableName}" (\n${[...colDefs, ...conDefs].join(',\n')}\n);`)

    // Indexes
    const idxRes = await srcClient.query<IndexInfo>(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1 AND indexname NOT IN (SELECT conname FROM pg_constraint WHERE conrelid = ('"public"."' || $1 || '"')::regclass)`, [tableName])
    for (const idx of idxRes.rows) ddl.push(`${idx.indexdef};`)
  }

  // Functions
  send({ step: 'schema', status: 'running', msg: 'Récupération des fonctions SQL...' })
  const funcRes = await srcClient.query<FunctionDef>(`SELECT p.proname as name, pg_get_functiondef(p.oid) as def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'`)
  for (const fn of funcRes.rows) ddl.push(`${fn.def};`)

  // Execute DDL
  send({ step: 'schema', status: 'running', msg: `Exécution de ${ddl.length} instructions DDL...` })
  let ddlErrors = 0
  for (const stmt of ddl) {
    const dc = await destPool.connect()
    try { await dc.query(stmt) }
    catch (e) { ddlErrors++; send({ step: 'schema', status: 'warn', msg: `DDL ignorée: ${String(e).substring(0, 120)}` }) }
    finally { dc.release() }
  }
  send({ step: 'schema', status: 'done', msg: `${tableNames.length} tables, ${funcRes.rows.length} fonctions, ${enumMap.size} enums (${ddlErrors} avertissements)`, count: tableNames.length })
  return tableNames
}

// ── RLS ───────────────────────────────────────────────────────────────────────

async function transferRLS(srcClient: PoolClient, destPool: Pool, send: (e: StepEvent) => void): Promise<void> {
  send({ step: 'rls', status: 'running', msg: 'Récupération des politiques RLS...' })
  const polRes = await srcClient.query<PolicyInfo>(`SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public'`)
  if (polRes.rows.length === 0) { send({ step: 'rls', status: 'done', msg: 'Aucune politique RLS', count: 0 }); return }

  for (const tableName of Array.from(new Set(polRes.rows.map(p => p.tablename)))) {
    const dc = await destPool.connect()
    try { await dc.query(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY`) }
    catch (e) { send({ step: 'rls', status: 'warn', msg: `Enable RLS ${tableName}: ${String(e).substring(0, 80)}` }) }
    finally { dc.release() }
  }

  let created = 0
  for (const pol of polRes.rows) {
    const roles = Array.isArray(pol.roles) ? pol.roles.join(', ') : pol.roles
    let stmt = `CREATE POLICY "${pol.policyname}" ON "${pol.tablename}" AS ${pol.permissive === 'PERMISSIVE' ? 'PERMISSIVE' : 'RESTRICTIVE'} FOR ${pol.cmd} TO ${roles}`
    if (pol.qual) stmt += ` USING (${pol.qual})`
    if (pol.with_check) stmt += ` WITH CHECK (${pol.with_check})`
    const dc = await destPool.connect()
    try { await dc.query(stmt); created++ }
    catch (e) { send({ step: 'rls', status: 'warn', msg: `Policy ${pol.policyname}: ${String(e).substring(0, 100)}` }) }
    finally { dc.release() }
  }
  send({ step: 'rls', status: 'done', msg: `${created}/${polRes.rows.length} politiques RLS créées`, count: created })
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function transferData(srcClient: PoolClient, destPool: Pool, tableNames: string[], send: (e: StepEvent) => void, summary: Summary): Promise<void> {
  let totalRows = 0
  for (const tableName of tableNames) {
    send({ step: 'data', status: 'running', msg: `Copie de "${tableName}"...` })
    let offset = 0; let tableRows = 0
    const dc0 = await destPool.connect()
    try { await dc0.query(`ALTER TABLE "${tableName}" DISABLE TRIGGER ALL`) } catch { /* ignore */ } finally { dc0.release() }
    while (true) {
      const rowsRes = await srcClient.query(`SELECT * FROM "${tableName}" LIMIT 100 OFFSET $1`, [offset])
      if (rowsRes.rows.length === 0) break
      const cols = rowsRes.fields.map(f => `"${f.name}"`)
      const valuePlaceholders = rowsRes.rows.map((_, ri) => `(${cols.map((__, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`)
      const flatValues = rowsRes.rows.flatMap(row => rowsRes.fields.map(f => {
        const val = row[f.name]
        return (val !== null && typeof val === 'object' && !Buffer.isBuffer(val)) ? JSON.stringify(val) : val
      }))
      const dc = await destPool.connect()
      try { await dc.query(`INSERT INTO "${tableName}" (${cols.join(', ')}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT DO NOTHING`, flatValues) }
      catch (e) { send({ step: 'data', status: 'warn', msg: `"${tableName}" @${offset}: ${String(e).substring(0, 100)}` }) }
      finally { dc.release() }
      tableRows += rowsRes.rows.length; offset += rowsRes.rows.length
      if (rowsRes.rows.length < 100) break
    }
    const dc1 = await destPool.connect()
    try { await dc1.query(`ALTER TABLE "${tableName}" ENABLE TRIGGER ALL`) } catch { /* ignore */ } finally { dc1.release() }
    totalRows += tableRows
    send({ step: 'data', status: 'info', msg: `"${tableName}": ${tableRows} lignes` })
  }
  summary.rows = totalRows
  send({ step: 'data', status: 'done', msg: `${totalRows} lignes copiées au total`, count: totalRows })
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function transferAuth(source: ProjectCredentials, destination: ProjectCredentials, send: (e: StepEvent) => void, summary: Summary): Promise<void> {
  send({ step: 'auth', status: 'running', msg: 'Récupération des utilisateurs auth...' })
  let users: AuthUser[] = []
  try {
    const res = await fetch(`${source.url}/auth/v1/admin/users?page=1&per_page=1000`, { headers: { apikey: source.serviceRoleKey, Authorization: `Bearer ${source.serviceRoleKey}` } })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    const data = await res.json() as { users?: AuthUser[] } | AuthUser[]
    users = Array.isArray(data) ? data : (data.users ?? [])
  } catch (e) { send({ step: 'auth', status: 'error', msg: `Impossible de récupérer les utilisateurs: ${String(e)}` }); return }

  send({ step: 'auth', status: 'running', msg: `${users.length} utilisateurs — création sur la destination...` })
  let created = 0; let errors = 0
  for (const user of users) {
    try {
      const res = await fetch(`${destination.url}/auth/v1/admin/users`, {
        method: 'POST', headers: { apikey: destination.serviceRoleKey, Authorization: `Bearer ${destination.serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, phone: user.phone, email_confirm: true, phone_confirm: !!user.phone_confirmed_at, user_metadata: user.user_metadata ?? {}, app_metadata: user.app_metadata ?? {}, role: user.role }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      created++
    } catch (e) { errors++; if (errors <= 5) send({ step: 'auth', status: 'warn', msg: `${user.email ?? user.id}: ${String(e).substring(0, 100)}` }) }
  }
  summary.users = created
  summary.warnings.push('Les mots de passe auth sont hachés — les utilisateurs devront réinitialiser leur mot de passe via "Mot de passe oublié".')
  send({ step: 'auth', status: 'done', msg: `${created}/${users.length} utilisateurs migrés (${errors} erreurs)`, count: created })
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function transferStorage(source: ProjectCredentials, destination: ProjectCredentials, send: (e: StepEvent) => void, summary: Summary): Promise<void> {
  send({ step: 'storage', status: 'running', msg: 'Récupération des buckets...' })
  let buckets: StorageBucket[] = []
  try {
    const res = await fetch(`${source.url}/storage/v1/bucket`, { headers: { Authorization: `Bearer ${source.serviceRoleKey}`, apikey: source.serviceRoleKey } })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    buckets = await res.json() as StorageBucket[]
  } catch (e) { send({ step: 'storage', status: 'error', msg: `Impossible de récupérer les buckets: ${String(e)}` }); return }

  send({ step: 'storage', status: 'running', msg: `${buckets.length} buckets trouvés` })
  let totalFiles = 0

  for (const bucket of buckets) {
    try {
      await fetch(`${destination.url}/storage/v1/bucket`, {
        method: 'POST', headers: { Authorization: `Bearer ${destination.serviceRoleKey}`, apikey: destination.serviceRoleKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bucket.id, name: bucket.name, public: bucket.public, file_size_limit: bucket.file_size_limit, allowed_mime_types: bucket.allowed_mime_types }),
      })
    } catch (e) { send({ step: 'storage', status: 'warn', msg: `Création bucket ${bucket.name}: ${String(e).substring(0, 80)}` }) }

    let files: StorageFile[] = []
    try {
      const res = await fetch(`${source.url}/storage/v1/object/list/${bucket.name}`, {
        method: 'POST', headers: { Authorization: `Bearer ${source.serviceRoleKey}`, apikey: source.serviceRoleKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: '', limit: 1000, offset: 0 }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      files = await res.json() as StorageFile[]
    } catch (e) { send({ step: 'storage', status: 'warn', msg: `Liste fichiers ${bucket.name}: ${String(e).substring(0, 80)}` }); continue }

    send({ step: 'storage', status: 'running', msg: `Bucket "${bucket.name}": ${files.length} fichiers à copier` })
    let bucketFiles = 0
    for (const file of files) {
      if (!file.name || !file.id) continue
      try {
        const dlRes = await fetch(`${source.url}/storage/v1/object/${bucket.name}/${file.name}`, { headers: { Authorization: `Bearer ${source.serviceRoleKey}`, apikey: source.serviceRoleKey } })
        if (!dlRes.ok) throw new Error(`Download HTTP ${dlRes.status}`)
        const blob = await dlRes.arrayBuffer()
        const upRes = await fetch(`${destination.url}/storage/v1/object/${bucket.name}/${file.name}`, {
          method: 'POST', headers: { Authorization: `Bearer ${destination.serviceRoleKey}`, apikey: destination.serviceRoleKey, 'Content-Type': dlRes.headers.get('content-type') ?? 'application/octet-stream' },
          body: blob,
        })
        if (!upRes.ok) throw new Error(`Upload HTTP ${upRes.status}: ${await upRes.text()}`)
        bucketFiles++
      } catch (e) { send({ step: 'storage', status: 'warn', msg: `${bucket.name}/${file.name}: ${String(e).substring(0, 80)}` }) }
    }
    totalFiles += bucketFiles
    send({ step: 'storage', status: 'info', msg: `Bucket "${bucket.name}": ${bucketFiles}/${files.length} fichiers copiés` })
  }
  summary.files = totalFiles
  send({ step: 'storage', status: 'done', msg: `${totalFiles} fichiers copiés dans ${buckets.length} buckets`, count: totalFiles })
}

// ── Edge Functions (audit) ────────────────────────────────────────────────────

async function listFunctions(source: ProjectCredentials, send: (e: StepEvent) => void, summary: Summary): Promise<void> {
  send({ step: 'functions', status: 'running', msg: 'Listage des Edge Functions via Management API...' })
  if (!source.pat) { send({ step: 'functions', status: 'warn', msg: 'PAT manquant' }); summary.warnings.push('PAT manquant : impossible de lister les Edge Functions.'); return }
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${source.projectRef}/functions`, { headers: { Authorization: `Bearer ${source.pat}` } })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    const fns = await res.json() as EdgeFunction[]
    summary.functions = fns.map(f => f.name ?? f.slug)
    summary.warnings.push(`${fns.length} Edge Function(s) — code non copiable via API. Redéployer avec "supabase functions deploy".`)
    send({ step: 'functions', status: 'done', msg: `${fns.length} fonctions listées (déploiement manuel requis)`, count: fns.length })
  } catch (e) { send({ step: 'functions', status: 'error', msg: `Erreur Management API: ${String(e)}` }) }
}

// ── Secrets (audit) ───────────────────────────────────────────────────────────

async function listSecrets(source: ProjectCredentials, send: (e: StepEvent) => void, summary: Summary): Promise<void> {
  send({ step: 'secrets', status: 'running', msg: 'Listage des secrets via Management API...' })
  if (!source.pat) { send({ step: 'secrets', status: 'warn', msg: 'PAT manquant' }); summary.warnings.push('PAT manquant : impossible de lister les secrets.'); return }
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${source.projectRef}/secrets`, { headers: { Authorization: `Bearer ${source.pat}` } })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    const secrets = await res.json() as SecretEntry[]
    summary.secrets = secrets.map(s => s.name)
    summary.warnings.push(`${secrets.length} secret(s) — valeurs non accessibles via API. Reconfigurer manuellement dans le projet destination.`)
    send({ step: 'secrets', status: 'done', msg: `${secrets.length} secrets listés (reconfiguration manuelle requise)`, count: secrets.length })
  } catch (e) { send({ step: 'secrets', status: 'error', msg: `Erreur Management API: ${String(e)}` }) }
}

// ── Main SSE handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json() as TransferBody
  const { source, destination, options } = body
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: StepEvent | { step: 'done'; status: 'done'; summary: Summary }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      const summary: Summary = { tables: 0, rows: 0, users: 0, files: 0, functions: [], secrets: [], warnings: [] }
      let srcPool: Pool | null = null
      let destPool: Pool | null = null

      try {
        send({ step: 'connect', status: 'running', msg: 'Connexion aux bases de données...' })
        srcPool = await createPool(source)
        destPool = await createPool(destination)
        send({ step: 'connect', status: 'done', msg: 'Connexions établies' })

        const srcClient = await srcPool.connect()
        try {
          let tableNames: string[] = []

          if (options.schema) {
            tableNames = await transferSchema(srcClient, destPool, send, summary)
          } else {
            const r = await srcClient.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`)
            tableNames = r.rows.map(row => row.table_name)
          }

          if (options.rls) await transferRLS(srcClient, destPool, send)
          if (options.data) await transferData(srcClient, destPool, tableNames, send, summary)
        } finally { srcClient.release() }

        if (options.auth) await transferAuth(source, destination, send, summary)
        if (options.storage) await transferStorage(source, destination, send, summary)
        if (options.listFunctions) await listFunctions(source, send, summary)
        if (options.listSecrets) await listSecrets(source, send, summary)

        send({ step: 'done', status: 'done', summary })
      } catch (e) {
        send({ step: 'error', status: 'error', msg: String(e) })
      } finally {
        if (srcPool) await srcPool.end().catch(() => null)
        if (destPool) await destPool.end().catch(() => null)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
