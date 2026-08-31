import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guard } from '../../traces/_auth'
import { chargerAppariements } from '../../plots/_referentiel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Reprise des conclusions d'instruction d'une version de fichier vers l'autre.
 *
 * Pourquoi une reprise EXPLICITE, et pourquoi elle ne concerne que les conclusions.
 *
 * La correction automatique dépose un second fichier (« X (corrigé).geojson ») et
 * donc un second attachement. Or `eudr_deforestation` comme `eudr_signal_qualifications`
 * sont clés par `attachment_id` : rien ne suit d'une version à l'autre.
 *
 * — L'ANALYSE de couvert n'est jamais reprise. La correction a modifié les
 *   géométries (trous retirés, contours refermés, auto-intersections résolues) :
 *   un résultat Whisp calculé sur l'original ne décrit plus les terres de la
 *   version corrigée. Le reporter serait une erreur de fond. Le panneau se borne
 *   à signaler qu'une autre version a été analysée, et invite à ré-analyser.
 *
 * — Une CONCLUSION D'INSTRUCTION, elle, est un fait établi sur le terrain
 *   (« parcelle déjà en production », avec sa source et son commentaire) : nettoyer
 *   un contour ne l'invalide pas. Elle garde sa valeur documentaire, d'où cette
 *   reprise — jamais automatique, toujours déclenchée par l'opérateur, et tracée
 *   dans le champ `source`. L'opérateur reste tenu de vérifier que la conclusion
 *   vaut encore pour la géométrie corrigée.
 *
 * Appariement des parcelles : par `plotId` (identifiant Whisp), à défaut par rang
 * et seulement si les deux analyses comptent le même nombre de parcelles. Ce qui
 * n'est pas appariable est SIGNALÉ, jamais rattaché au hasard.
 */

interface PlotWhisp { plotId?: string }
interface QualLigne {
  attachment_id: string; plot_id: string; statut: string
  commentaire: string | null; source: string | null
  qualified_at: string | null; qualified_by: string | null
}

/** La table de qualification peut ne pas être encore appliquée (cf. MAINTENANCE §12). */
function missingTable(err: { code?: string; message?: string } | null): boolean {
  return !!err && (err.code === '42P01' || /does not exist|relation .* n'existe pas/i.test(err.message ?? ''))
}

/**
 * Une ligne « à instruire » sans commentaire ni source ne porte aucune conclusion :
 * la reprendre n'apporterait rien et brouillerait le compte annoncé à l'opérateur.
 */
function porteUneConclusion(q: { statut: string; commentaire: string | null; source: string | null }): boolean {
  return q.statut !== 'a_instruire' || !!q.commentaire?.trim() || !!q.source?.trim()
}

const idsDe = (plots: unknown): string[] =>
  (Array.isArray(plots) ? plots as PlotWhisp[] : [])
    .map(p => String(p?.plotId ?? '')).filter(Boolean)

const jour = (s: string | null) => {
  if (!s) return null
  const d = new Date(s)
  return isNaN(+d) ? s : d.toLocaleDateString('fr-FR')
}

interface Appariee { plotIdSource: string; plotIdCible: string; mode: 'plot_id' | 'rang' }
interface NonAppariable { plotIdSource: string; motif: string }

/**
 * POST { org_id, sourceAttachmentId, cibleAttachmentId, dryRun? }
 * dryRun : renvoie le plan d'appariement sans rien écrire.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as {
      org_id?: string; sourceAttachmentId?: string; cibleAttachmentId?: string; dryRun?: boolean
    } | null
    const orgId = body?.org_id ?? null
    const auth = await guard(orgId, { requireEdit: !body?.dryRun })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const source = String(body?.sourceAttachmentId ?? '')
    const cible = String(body?.cibleAttachmentId ?? '')
    if (!source || !cible) {
      return NextResponse.json({ error: 'sourceAttachmentId et cibleAttachmentId requis' }, { status: 400 })
    }
    if (source === cible) {
      return NextResponse.json({ error: 'Source et cible sont le même fichier.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Garde-fou : on ne reprend des conclusions qu'entre les DEUX VERSIONS d'un
    // même fichier. Entre deux fichiers sans lien, un appariement par rang
    // rattacherait des conclusions à des terres qui n'ont rien à voir.
    const appariements = await chargerAppariements(orgId!, admin)
    const aSource = appariements.get(source)
    const aCible = appariements.get(cible)
    if (!aSource || !aCible || aSource.autreVersionId !== cible || aCible.autreVersionId !== source) {
      return NextResponse.json(
        { error: 'Ces deux fichiers ne sont pas les deux versions d’un même fichier : reprise refusée.' },
        { status: 409 },
      )
    }

    const [analyses, quals] = await Promise.all([
      admin.from('eudr_deforestation').select('attachment_id, analyzed_at, plots')
        .eq('org_id', orgId!).in('attachment_id', [source, cible]),
      admin.from('eudr_signal_qualifications').select('*')
        .eq('org_id', orgId!).in('attachment_id', [source, cible]),
    ])
    if (analyses.error) return NextResponse.json({ error: analyses.error.message }, { status: 500 })
    if (quals.error) {
      if (missingTable(quals.error)) {
        return NextResponse.json(
          { error: 'Reprise indisponible : migration 20260831_eudr_signal_qualification non appliquée.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: quals.error.message }, { status: 500 })
    }

    const plotsSource = idsDe((analyses.data ?? []).find(a => String(a.attachment_id) === source)?.plots)
    const plotsCible = (analyses.data ?? []).find(a => String(a.attachment_id) === cible)
    if (!plotsCible) {
      return NextResponse.json(
        { error: 'Le fichier cible n’a pas encore été analysé : analysez-le avant de reprendre des conclusions.' },
        { status: 409 },
      )
    }
    const idsCible = idsDe(plotsCible.plots)
    const setCible = new Set(idsCible)
    const memeCardinal = plotsSource.length > 0 && plotsSource.length === idsCible.length

    const lignes = (quals.data ?? []) as unknown as QualLigne[]
    const dejaCible = new Map<string, QualLigne>()
    for (const q of lignes) if (String(q.attachment_id) === cible) dejaCible.set(q.plot_id, q)
    const aReprendre = lignes
      .filter(q => String(q.attachment_id) === source && porteUneConclusion(q))

    const appariees: Appariee[] = []
    const nonAppariables: NonAppariable[] = []
    const dejaInstruites: string[] = []

    for (const q of aReprendre) {
      let cibleId: string | null = null
      let mode: 'plot_id' | 'rang' = 'plot_id'
      if (setCible.has(q.plot_id)) {
        cibleId = q.plot_id
      } else if (memeCardinal) {
        const rang = plotsSource.indexOf(q.plot_id)
        if (rang >= 0 && idsCible[rang]) { cibleId = idsCible[rang]; mode = 'rang' }
      }
      if (!cibleId) {
        nonAppariables.push({
          plotIdSource: q.plot_id,
          motif: memeCardinal
            ? 'Identifiant absent de l’analyse de l’autre version.'
            : `Identifiant absent et nombre de parcelles différent (${plotsSource.length} → ${idsCible.length}) : l’appariement par rang n’est pas fiable.`,
        })
        continue
      }
      if (dejaCible.has(cibleId)) { dejaInstruites.push(cibleId); continue }
      appariees.push({ plotIdSource: q.plot_id, plotIdCible: cibleId, mode })
    }

    const roleSource = aSource.version === 'corrigee' ? 'la version corrigée' : 'le fichier initial'
    const plan = {
      candidates: aReprendre.length,
      appariees, nonAppariables, dejaInstruites,
      sourceNom: aSource.name, cibleNom: aCible.name, roleSource,
    }
    if (body?.dryRun) return NextResponse.json({ ...plan, reprises: 0, dryRun: true })
    if (!appariees.length) return NextResponse.json({ ...plan, reprises: 0 })

    const { data: { user } } = await createUserClient().auth.getUser()
    const maintenant = new Date().toISOString()
    const parPlot = new Map(aReprendre.map(q => [q.plot_id, q]))

    // Trace de la reprise dans `source` : une conclusion reprise ne doit pas se
    // lire comme une conclusion instruite sur cette version-ci.
    const rows = appariees.map(a => {
      const q = parPlot.get(a.plotIdSource)!
      const mention = `reprise de ${roleSource}${jour(q.qualified_at) ? ` du ${jour(q.qualified_at)}` : ''}`
        + (a.mode === 'rang' ? ', appariement par rang à vérifier' : '')
      return {
        org_id: orgId!, attachment_id: cible, plot_id: a.plotIdCible,
        statut: q.statut,
        commentaire: q.commentaire,
        source: q.source?.trim() ? `${q.source.trim()} — ${mention}` : mention.charAt(0).toUpperCase() + mention.slice(1),
        qualified_at: maintenant,
        qualified_by: user?.email ?? null,
      }
    })

    const { error } = await admin.from('eudr_signal_qualifications')
      .upsert(rows, { onConflict: 'org_id,attachment_id,plot_id' })
    if (error) {
      if (missingTable(error)) {
        return NextResponse.json(
          { error: 'Reprise indisponible : migration 20260831_eudr_signal_qualification non appliquée.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ...plan, reprises: rows.length })
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 500 })
  }
}
