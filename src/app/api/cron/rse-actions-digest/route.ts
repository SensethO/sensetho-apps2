/**
 * GET /api/cron/rse-actions-digest
 *
 * Cron Vercel — récap quotidien des actions RSE.
 * Programmé à 07:00 et 08:00 UTC du lundi au vendredi ; le gate interne ne
 * laisse passer QUE l'exécution correspondant à 9h00 heure de Paris (gère
 * automatiquement l'heure d'été/hiver via Intl). Résultat : un envoi unique
 * à 9h Paris, du lundi au vendredi, toute l'année.
 *
 * Pour chaque responsable AYANT UN COMPTE Sens'ethO, agrège ses actions
 * ouvertes (statut != terminé) sur toutes les apps RSE (RSE_ACTION_SOURCES)
 * et lui envoie un email de récap. Pas d'email si aucune action ouverte.
 * Les responsables saisis en texte libre sans compte correspondant sont ignorés.
 *
 * Sécurisé par le header Authorization: Bearer <CRON_SECRET>.
 * Test manuel : ?force=1 (bypass du gate horaire) avec le même header.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/msGraph'
import { RSE_ACTION_SOURCES } from '@/lib/rseActionSources'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface OpenAction {
  titre: string
  statut: string
  echeance: string | null
  responsable: string | null
  appLabel: string
}

/** Heure + jour de la semaine à Paris (gère l'heure d'été/hiver). */
function parisNow(now: Date): { hour: number; weekday: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', hour12: false,
  }).formatToParts(now)
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '-1', 10)
  return { hour, weekday }
}

/** Statut d'échéance pour l'affichage. */
function echeanceTag(echeance: string | null): { fr: string; flag: 'retard' | 'bientot' | 'normal' | 'none' } {
  if (!echeance) return { fr: '', flag: 'none' }
  const d = new Date(echeance)
  if (isNaN(d.getTime())) return { fr: echeance, flag: 'none' }
  const fr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { fr, flag: 'retard' }
  if (diff < 7) return { fr, flag: 'bientot' }
  return { fr, flag: 'normal' }
}

const STATUT_FR: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours' }

function buildHtml(name: string, actions: OpenAction[], dateFr: string): string {
  // overdue d'abord, puis par échéance croissante
  const rank = (a: OpenAction) => {
    const t = echeanceTag(a.echeance)
    const base = t.flag === 'retard' ? 0 : t.flag === 'bientot' ? 1 : t.flag === 'normal' ? 2 : 3
    const time = a.echeance && !isNaN(new Date(a.echeance).getTime()) ? new Date(a.echeance).getTime() : Number.POSITIVE_INFINITY
    return { base, time }
  }
  const sorted = [...actions].sort((a, b) => {
    const ra = rank(a), rb = rank(b)
    return ra.base !== rb.base ? ra.base - rb.base : ra.time - rb.time
  })

  const rows = sorted.map(a => {
    const t = echeanceTag(a.echeance)
    const tag =
      t.flag === 'retard'  ? `<span style="color:#dc2626;font-weight:600;">⚠️ En retard — ${t.fr}</span>`
    : t.flag === 'bientot' ? `<span style="color:#ea580c;font-weight:600;">🔸 Bientôt — ${t.fr}</span>`
    : t.flag === 'normal'  ? `<span style="color:#6b7280;">📅 ${t.fr}</span>`
    : `<span style="color:#9ca3af;">Sans échéance</span>`
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">
        <div style="font-weight:600;color:#111;">${escapeHtml(a.titre)}</div>
        <div style="font-size:12px;color:#6366f1;">${escapeHtml(a.appLabel)}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;white-space:nowrap;">${tag}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:#374151;white-space:nowrap;">${STATUT_FR[a.statut] ?? escapeHtml(a.statut)}</td>
    </tr>`
  }).join('')

  const nbRetard = sorted.filter(a => echeanceTag(a.echeance).flag === 'retard').length

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111;">
    <h2 style="color:#4f46e5;margin-bottom:4px;">Vos actions RSE du jour</h2>
    <p style="color:#6b7280;margin-top:0;">Récap du ${dateFr}</p>
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>Vous avez <strong>${sorted.length}</strong> action${sorted.length > 1 ? 's' : ''} en cours${nbRetard > 0 ? `, dont <strong style="color:#dc2626;">${nbRetard} en retard</strong>` : ''}.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px;">
      <thead><tr style="background:#f5f3ff;">
        <th style="text-align:left;padding:8px 12px;font-size:12px;color:#6b7280;">Action</th>
        <th style="text-align:left;padding:8px 12px;font-size:12px;color:#6b7280;">Échéance</th>
        <th style="text-align:left;padding:8px 12px;font-size:12px;color:#6b7280;">Statut</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:20px;"><a href="https://apps.sensetho.com" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Ouvrir mes dossiers RSE</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Email automatique — récap quotidien des actions RSE (lun.–ven., 9h). Vous le recevez car des actions RSE vous sont assignées sur la plateforme Sens'ethO.</p>
  </div>`
}

function buildText(name: string, actions: OpenAction[], dateFr: string): string {
  const lines = actions.map(a => {
    const t = echeanceTag(a.echeance)
    const ech = t.flag === 'retard' ? `EN RETARD (${t.fr})` : t.fr || 'sans échéance'
    return `- [${a.appLabel}] ${a.titre} — ${ech} — ${STATUT_FR[a.statut] ?? a.statut}`
  }).join('\n')
  return `Bonjour ${name},\n\nVos actions RSE en cours (récap du ${dateFr}) :\n\n${lines}\n\nOuvrir : https://apps.sensetho.com\n`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const secret = process.env.CRON_SECRET ?? ''
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sp = new URL(req.url).searchParams
    const force = sp.get('force') === '1'
    const dry = sp.get('dry') === '1'   // calcule les destinataires sans envoyer
    const { hour, weekday } = parisNow(new Date())
    const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday)
    if (!force && !dry && !(isWeekday && hour === 9)) {
      return NextResponse.json({ skipped: true, reason: `Hors fenêtre d'envoi (Paris ${weekday} ${hour}h)` })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // 1. Récupérer toutes les actions ouvertes de toutes les apps RSE
    const allActions: OpenAction[] = []
    const sourceErrors: string[] = []
    for (const src of RSE_ACTION_SOURCES) {
      try {
        const { data, error } = await admin
          .from(src.table)
          .select('titre, statut, echeance, responsable')
          .neq('statut', 'termine')
          .not('responsable', 'is', null)
        if (error) { sourceErrors.push(`${src.table}: ${error.message}`); continue }
        for (const a of data ?? []) {
          const resp = (a.responsable ?? '').trim()
          if (!resp) continue
          allActions.push({ titre: a.titre, statut: a.statut, echeance: a.echeance, responsable: resp, appLabel: src.label })
        }
      } catch (e) {
        sourceErrors.push(`${src.table}: ${String(e)}`)
      }
    }

    // 2. Profils -> résolution responsable (par email, sinon par nom complet)
    const { data: profiles } = await admin.from('profiles').select('id, email, full_name')
    const byEmail = new Map<string, { email: string; full_name: string | null }>()
    const byName = new Map<string, { email: string; full_name: string | null }>()
    for (const p of profiles ?? []) {
      if (p.email) byEmail.set(String(p.email).trim().toLowerCase(), { email: p.email, full_name: p.full_name })
      if (p.full_name) byName.set(String(p.full_name).trim().toLowerCase(), { email: p.email, full_name: p.full_name })
    }

    // 3. Regrouper par destinataire résolu
    const byRecipient = new Map<string, { name: string; actions: OpenAction[] }>()
    let unresolved = 0
    for (const a of allActions) {
      const key = a.responsable!.trim().toLowerCase()
      const prof = byEmail.get(key) ?? byName.get(key)
      if (!prof?.email) { unresolved++; continue }
      const email = prof.email.toLowerCase()
      if (!byRecipient.has(email)) {
        byRecipient.set(email, { name: (prof.full_name && prof.full_name.trim()) || prof.email, actions: [] })
      }
      byRecipient.get(email)!.actions.push(a)
    }

    // 4. Envoyer
    const dateFr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const sent: string[] = []
    const sendErrors: string[] = []
    for (const [email, { name, actions }] of Array.from(byRecipient.entries())) {
      if (!actions.length) continue
      if (dry) { sent.push(`${email} (${actions.length} action${actions.length > 1 ? 's' : ''})`); continue }
      try {
        const subject = `Récap RSE — ${actions.length} action${actions.length > 1 ? 's' : ''} en cours`
        await sendEmail(email, subject, buildHtml(name, actions, dateFr), {
          fromName: "Sens'ethO",
          textBody: buildText(name, actions, dateFr),
        })
        sent.push(email)
      } catch (e) {
        sendErrors.push(`${email}: ${String(e)}`)
      }
    }

    return NextResponse.json({
      ok: true,
      paris: `${weekday} ${hour}h`,
      forced: force,
      dryRun: dry,
      actionsOpen: allActions.length,
      recipients: byRecipient.size,
      sent: sent.length,
      sentTo: sent,
      unresolvedActions: unresolved,
      sourceErrors,
      sendErrors,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
