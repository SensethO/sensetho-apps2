import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  downloadSpFile,
  uploadSpFile,
  isSharePointItemId,
} from '@/lib/sharepointMulti'
import type { SpConfigResolved } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return { user, admin }
}

function resolveConfig(cfg: Record<string, unknown>): SpConfigResolved {
  return {
    tenantId: cfg.tenant_id as string,
    clientId: cfg.client_id as string,
    clientSecret: cfg.client_secret as string,
    siteHost: cfg.site_host as string,
    sitePath: cfg.site_path as string,
    driveId: cfg.drive_id as string,
    rootFolder: cfg.root_folder as string,
  }
}

interface SectionAttachment {
  path?: string
  name?: string
  mime?: string
  [key: string]: unknown
}

interface Section {
  attachments?: SectionAttachment[]
  [key: string]: unknown
}

// GET — job status
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { jobId } = await params

  const { data, error } = await auth.admin
    .from('sp_migrations')
    .select(`
      id,
      name,
      app_keys,
      status,
      total_files,
      migrated_files,
      failed_files,
      error_log,
      created_by,
      created_at,
      updated_at,
      source:source_config_id ( id, name ),
      target:target_config_id ( id, name )
    `)
    .eq('id', jobId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  return NextResponse.json(data)
}

// POST — run migration
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { jobId } = await params
  const body = (await req.json()) as { action: string }

  if (body.action !== 'run') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch job
  const { data: job, error: jobErr } = await admin
    .from('sp_migrations')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.status === 'running') return NextResponse.json({ error: 'Job already running' }, { status: 409 })
  if (job.status === 'done') return NextResponse.json({ error: 'Job already completed' }, { status: 409 })

  // Fetch configs
  const { data: srcCfg } = await admin.from('sp_configs').select('*').eq('id', job.source_config_id).single()
  const { data: tgtCfg } = await admin.from('sp_configs').select('*').eq('id', job.target_config_id).single()

  if (!srcCfg?.drive_id || !tgtCfg?.drive_id) {
    return NextResponse.json({ error: 'Source or target config not tested (missing drive_id)' }, { status: 400 })
  }

  const source = resolveConfig(srcCfg as Record<string, unknown>)
  const target = resolveConfig(tgtCfg as Record<string, unknown>)

  // Mark as running
  await admin.from('sp_migrations').update({
    status: 'running',
    migrated_files: 0,
    failed_files: 0,
    error_log: [],
  }).eq('id', jobId)

  // Run migration async (fire and forget — client polls for status)
  runMigration(jobId, job.app_keys as string[], source, target, admin).catch(async (err) => {
    await admin.from('sp_migrations').update({
      status: 'failed',
      error_log: [{ message: err instanceof Error ? err.message : String(err), ts: new Date().toISOString() }],
    }).eq('id', jobId)
  })

  return NextResponse.json({ ok: true, message: 'Migration started' })
}

// ── Migration runner ──────────────────────────────────────────────────────────

async function runMigration(
  jobId: string,
  appKeys: string[],
  source: SpConfigResolved,
  target: SpConfigResolved,
  admin: ReturnType<typeof createAdminClient>
) {
  let migrated = 0
  let failed = 0
  const errorLog: Array<{ app: string; id: string; message: string; ts: string }> = []

  async function saveProgress(done = false) {
    await admin.from('sp_migrations').update({
      status: done ? (failed > 0 && migrated === 0 ? 'failed' : 'done') : 'running',
      migrated_files: migrated,
      failed_files: failed,
      error_log: errorLog,
    }).eq('id', jobId)
  }

  for (const appKey of appKeys) {
    if (appKey === 'guided-diagnostic') {
      await migrateGuidedDiagnostic(source, target, admin, jobId, {
        onSuccess: () => { migrated++ },
        onError: (id, msg) => {
          failed++
          errorLog.push({ app: appKey, id, message: msg, ts: new Date().toISOString() })
        },
        onProgress: saveProgress,
      })
    } else if (['iso26000', 'csrd', 'gri'].includes(appKey)) {
      await migrateActionNotes(appKey, source, target, admin, {
        onSuccess: () => { migrated++ },
        onError: (id, msg) => {
          failed++
          errorLog.push({ app: appKey, id, message: msg, ts: new Date().toISOString() })
        },
        onProgress: saveProgress,
      })
    }
    // mon-dossier and rapport-integre: folder-based, no item IDs to migrate
  }

  await saveProgress(true)
}

interface MigrationCallbacks {
  onSuccess: () => void
  onError: (id: string, msg: string) => void
  onProgress: () => Promise<void>
}

async function migrateGuidedDiagnostic(
  source: SpConfigResolved,
  target: SpConfigResolved,
  admin: ReturnType<typeof createAdminClient>,
  _jobId: string,
  cb: MigrationCallbacks
) {
  const { data: rows } = await admin
    .from('guided_action_attachments')
    .select('id, sharepoint_item_id, file_name, mime_type')

  if (!rows) return

  for (const row of rows) {
    const itemId = row.sharepoint_item_id as string | null
    if (!itemId || !isSharePointItemId(itemId)) continue

    try {
      const data = await downloadSpFile(source, itemId)
      const fileName = (row.file_name as string) ?? 'file'
      const mime = (row.mime_type as string) ?? 'application/octet-stream'
      const uploaded = await uploadSpFile(target, target.rootFolder, fileName, data, mime)

      await admin
        .from('guided_action_attachments')
        .update({ sharepoint_item_id: uploaded.id })
        .eq('id', row.id)

      cb.onSuccess()
    } catch (err) {
      cb.onError(String(row.id), err instanceof Error ? err.message : String(err))
    }

    await cb.onProgress()
  }
}

async function migrateActionNotes(
  appKey: string,
  source: SpConfigResolved,
  target: SpConfigResolved,
  admin: ReturnType<typeof createAdminClient>,
  cb: MigrationCallbacks
) {
  const table = `${appKey}_action_notes`

  const { data: rows } = await admin
    .from(table)
    .select('id, sections')
    .not('sections', 'is', null)

  if (!rows) return

  for (const row of rows) {
    const sections = row.sections as Section[] | null
    if (!Array.isArray(sections)) continue

    let changed = false
    const updatedSections: Section[] = []

    for (const section of sections) {
      const updatedSection: Section = { ...section }
      if (Array.isArray(section.attachments)) {
        const updatedAttachments: SectionAttachment[] = []

        for (const att of section.attachments as SectionAttachment[]) {
          const path = att.path
          if (!path || !isSharePointItemId(path)) {
            updatedAttachments.push(att)
            continue
          }

          try {
            const data = await downloadSpFile(source, path)
            const fileName = att.name ?? 'file'
            const mime = att.mime ?? 'application/octet-stream'
            const uploaded = await uploadSpFile(target, target.rootFolder, fileName, data, mime)
            updatedAttachments.push({ ...att, path: uploaded.id })
            changed = true
            cb.onSuccess()
          } catch (err) {
            updatedAttachments.push(att)
            cb.onError(`${row.id}/${path}`, err instanceof Error ? err.message : String(err))
          }
        }

        updatedSection.attachments = updatedAttachments
      }
      updatedSections.push(updatedSection)
    }

    if (changed) {
      await admin.from(table).update({ sections: updatedSections }).eq('id', row.id)
    }

    await cb.onProgress()
  }
}
