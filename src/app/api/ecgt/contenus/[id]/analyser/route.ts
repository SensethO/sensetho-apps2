/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/ecgt/contenus/[id]/analyser
 * Extrait le contenu, l'analyse par IA au regard du référentiel ECGT
 * (directive (UE) 2024/825) et enregistre les constats de non-conformité.
 *
 * Réponse : {
 *   data: {
 *     contenu: <ligne ecgt_contenus mise à jour>,
 *     constats: <lignes ecgt_constats créées>,
 *     avertissements: string[],
 *     extraction: { longueur, tronque } | null
 *   }
 * }
 *
 * Une nouvelle analyse REMPLACE les constats précédents du contenu, à
 * l'exception de ceux que l'utilisateur a déjà traités (statut « corrige » ou
 * « ecarte »), qui sont conservés pour ne perdre aucune décision.
 *
 * Fichiers : pour un PDF ou un visuel, le serveur LIT le fichier depuis
 * SharePoint pour le TRAITER (envoi en vision à l'API Anthropic) sans jamais le
 * servir au navigateur ni le stocker — exemption explicitement admise par
 * docs/RSE_APP_PATTERN.md §11 (« analyse COA par IA »).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessDiagnostic } from '@/lib/rseShares'
import { getConfigForApp, downloadSpFile } from '@/lib/sharepointMulti'
import { extractFromUrl, extractFromTexte } from '@/lib/ecgt/extraction'
import { analyseContenu, type EcgtFichier } from '@/lib/ecgt/analyse'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const APP_SLUG = 'ecgt'
const TABLE = 'ecgt_diagnostics'
const APP_KEY = 'ecgt-diagnostic'

/** Taille maximale d'un fichier envoyé en vision (limite pratique de l'API). */
const MAX_FICHIER_BYTES = 20 * 1024 * 1024

const VISION_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient()
  const contenuId = params.id

  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: contenu } = await admin.from('ecgt_contenus').select('*').eq('id', contenuId).maybeSingle()
    if (!contenu) return NextResponse.json({ error: 'Contenu non trouvé' }, { status: 404 })
    if (!await canAccessDiagnostic(APP_SLUG, TABLE, user.id, contenu.diagnostic_id, { requireEdit: true })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ─── 1. Extraction ───────────────────────────────────────────────────────
    let texte: string | null = (contenu.texte_source as string | null) ?? null
    let titre: string | null = (contenu.titre as string | null) ?? null
    let extraction: { longueur: number; tronque: boolean } | null = null
    const avertissements: string[] = []

    if (contenu.type === 'url') {
      const res = await extractFromUrl(contenu.url as string)
      texte = res.texte
      if (!titre && res.titre) titre = res.titre
      extraction = { longueur: res.longueurBrute, tronque: res.tronque }
      avertissements.push(...res.avertissements)
      if (!texte.trim()) throw new Error("Aucun texte n’a pu être extrait de cette page. Collez le contenu visible dans un contenu de type « texte ».")
    } else if (texte) {
      const res = extractFromTexte(texte, titre)
      texte = res.texte
      extraction = { longueur: res.longueurBrute, tronque: res.tronque }
      avertissements.push(...res.avertissements)
    }

    // ─── 2. Fichier SharePoint éventuel (PDF / image) → vision ───────────────
    let fichier: EcgtFichier | null = null
    if ((contenu.type === 'document' || contenu.type === 'image') && contenu.sharepoint_item_id) {
      const mime = (contenu.mime as string | null) ?? ''
      if (!VISION_MIMES.includes(mime)) {
        if (!texte?.trim()) {
          throw new Error(
            `Format « ${mime || 'inconnu'} » non analysable directement. Convertissez le fichier en PDF ou en image (PNG, JPEG, WebP), ou collez son texte.`
          )
        }
        avertissements.push(
          `Le fichier joint (${mime || 'type inconnu'}) n’est pas lisible par le modèle : seul le texte fourni a été analysé.`
        )
      } else if ((contenu.taille as number | null) && (contenu.taille as number) > MAX_FICHIER_BYTES) {
        throw new Error('Fichier trop volumineux pour l’analyse (plus de 20 Mo). Découpez-le ou collez le texte concerné.')
      } else {
        const config = await getConfigForApp(APP_KEY)
        const buf = await downloadSpFile(config, contenu.sharepoint_item_id as string)
        if (buf.byteLength > MAX_FICHIER_BYTES) {
          throw new Error('Fichier trop volumineux pour l’analyse (plus de 20 Mo).')
        }
        fichier = { data: Buffer.from(buf), mime, name: (contenu.titre as string | null) ?? 'document' }
      }
    }

    if (!fichier && !texte?.trim()) {
      throw new Error('Aucun contenu exploitable : ajoutez un fichier PDF ou image, ou collez le texte à analyser.')
    }

    // ─── 3. Analyse IA ───────────────────────────────────────────────────────
    const result = await analyseContenu({
      type: contenu.type,
      titre,
      url: (contenu.url as string | null) ?? null,
      texte,
      fichier,
    })
    avertissements.push(...result.avertissements)

    // ─── 4. Enregistrement des constats ──────────────────────────────────────
    // Les constats déjà traités par l'utilisateur sont conservés ; seuls les
    // constats encore « ouverts » sont remplacés par la nouvelle analyse.
    await admin.from('ecgt_constats').delete().eq('contenu_id', contenuId).eq('statut', 'ouvert')

    let constats: any[] = []
    if (result.constats.length) {
      const { data, error } = await admin
        .from('ecgt_constats')
        .insert(result.constats.map(c => ({
          contenu_id: contenuId,
          critere_id: c.critere_id,
          gravite: c.gravite,
          extrait: c.extrait,
          probleme: c.probleme,
          article_vise: c.article_vise,
          suggestion: c.suggestion,
          justification: c.justification,
          statut: 'ouvert',
        })))
        .select()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      constats = data ?? []
    }

    const { data: updated } = await admin
      .from('ecgt_contenus')
      .update({
        statut: 'analyse',
        analysed_at: new Date().toISOString(),
        erreur: null,
        titre,
        texte_source: texte,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contenuId)
      .select()
      .single()

    return NextResponse.json({
      data: {
        contenu: updated,
        constats,
        avertissements,
        extraction,
        lots: result.lots,
        lotsEnEchec: result.lotsEnEchec,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ecgt/contenus/analyser]', message)
    await admin
      .from('ecgt_contenus')
      .update({ statut: 'erreur', erreur: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq('id', contenuId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
