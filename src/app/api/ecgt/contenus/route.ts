/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Contenus soumis à l'analyse ECGT.
 *
 *  GET    /api/ecgt/contenus?diagnostic_id=xxx  → { data: Contenu[] } (constats agrégés)
 *  POST   /api/ecgt/contenus                    → crée un contenu
 *  DELETE /api/ecgt/contenus?id=xxx             → supprime un contenu (et ses constats, en cascade)
 *
 * Aucun fichier ne transite ici : pour un document ou un visuel, le navigateur
 * envoie le fichier directement à SharePoint via /contenus/upload-session, puis
 * transmet le `sharepoint_item_id` obtenu à ce POST.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessDiagnostic } from '@/lib/rseShares'
import type { EcgtContenuType } from '@/lib/ecgt/referentiel'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'ecgt'
const TABLE = 'ecgt_diagnostics'
const TYPES: EcgtContenuType[] = ['url', 'document', 'image', 'video', 'texte']

const canAccess = (userId: string, diagnosticId: string, requireEdit = false) =>
  canAccessDiagnostic(APP_SLUG, TABLE, userId, diagnosticId, { requireEdit })

/** GET /api/ecgt/contenus?diagnostic_id=xxx */
export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const diagnosticId = req.nextUrl.searchParams.get('diagnostic_id')
    if (!diagnosticId) return NextResponse.json({ error: 'diagnostic_id requis' }, { status: 400 })
    if (!await canAccess(user.id, diagnosticId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('ecgt_contenus')
      .select('*')
      .eq('diagnostic_id', diagnosticId)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const contenus = (data ?? []) as any[]

    // Compteur de constats par contenu et par gravité (pour les cartes de la liste)
    let stats: Record<string, { total: number; ouverts: number; critique: number; majeur: number; mineur: number; vigilance: number }> = {}
    if (contenus.length) {
      const { data: constats } = await admin
        .from('ecgt_constats')
        .select('contenu_id, gravite, statut')
        .in('contenu_id', contenus.map(c => c.id))
      stats = {}
      for (const k of (constats ?? []) as any[]) {
        const s = stats[k.contenu_id] ?? { total: 0, ouverts: 0, critique: 0, majeur: 0, mineur: 0, vigilance: 0 }
        s.total++
        if (k.statut === 'ouvert') s.ouverts++
        if (k.gravite in s) (s as any)[k.gravite]++
        stats[k.contenu_id] = s
      }
    }

    return NextResponse.json({
      data: contenus.map(c => ({
        ...c,
        // Le texte source complet n'est pas renvoyé dans la liste (volume) : seul un aperçu.
        texte_source: undefined,
        texte_apercu: typeof c.texte_source === 'string' ? c.texte_source.slice(0, 400) : null,
        texte_longueur: typeof c.texte_source === 'string' ? c.texte_source.length : 0,
        constats: stats[c.id] ?? { total: 0, ouverts: 0, critique: 0, majeur: 0, mineur: 0, vigilance: 0 },
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * POST /api/ecgt/contenus
 * Body : {
 *   diagnostic_id, type: 'url'|'document'|'image'|'video'|'texte',
 *   titre?, url?, sharepoint_item_id?, mime?, taille?, texte_source?
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      diagnostic_id?: string
      type?: string
      titre?: string
      url?: string
      sharepoint_item_id?: string
      mime?: string
      taille?: number
      texte_source?: string
    }
    const { diagnostic_id, type } = body
    if (!diagnostic_id) return NextResponse.json({ error: 'diagnostic_id requis' }, { status: 400 })
    if (!type || !TYPES.includes(type as EcgtContenuType)) {
      return NextResponse.json({ error: `type requis parmi ${TYPES.join(', ')}` }, { status: 400 })
    }
    if (!await canAccess(user.id, diagnostic_id, true)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Contrôles de cohérence par type
    const url = (body.url ?? '').trim() || null
    const texte = (body.texte_source ?? '').trim() || null
    const spId = (body.sharepoint_item_id ?? '').trim() || null
    if (type === 'url' && !url) return NextResponse.json({ error: 'url requise pour un contenu de type « url »' }, { status: 400 })
    if (type === 'texte' && !texte) return NextResponse.json({ error: 'texte_source requis pour un contenu de type « texte »' }, { status: 400 })
    if ((type === 'document' || type === 'image') && !spId && !texte) {
      return NextResponse.json({ error: 'Envoyez le fichier vers SharePoint (sharepoint_item_id) ou collez son texte.' }, { status: 400 })
    }
    if (type === 'video' && !texte) {
      return NextResponse.json({
        error: "Les vidéos ne sont pas transcrites : collez le script, la voix off ou les sous-titres dans texte_source.",
      }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('ecgt_contenus')
      .insert({
        diagnostic_id,
        type,
        titre: (body.titre ?? '').trim() || null,
        url,
        sharepoint_item_id: spId,
        mime: (body.mime ?? '').trim() || null,
        taille: body.taille ?? null,
        texte_source: texte,
        statut: 'a_analyser',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/ecgt/contenus?id=xxx */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: contenu } = await admin.from('ecgt_contenus').select('diagnostic_id').eq('id', id).maybeSingle()
    if (!contenu) return NextResponse.json({ error: 'Contenu non trouvé' }, { status: 404 })
    if (!await canAccess(user.id, contenu.diagnostic_id, true)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await admin.from('ecgt_contenus').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
