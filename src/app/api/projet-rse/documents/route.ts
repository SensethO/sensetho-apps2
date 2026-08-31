// /api/projet-rse/documents — vue agrégée des notes et pièces jointes de
// l'organisation.
//
// Une note ne se trouve, aujourd'hui, qu'en rouvrant l'élément qui la porte.
// Cette route balaie toutes les lignes projet_rse_notes de l'organisation,
// décode la clé de l'élément porteur en libellé lisible, et renvoie une liste
// plate — c'est ce qui permet de retrouver un fichier sans se souvenir d'où on
// l'avait mis.
//
// Aucune URL SharePoint n'est résolue ici : le téléchargement passe par
// .../notes/signed-url, à la demande. Résoudre trois cents URL pour afficher
// une liste coûterait trois cents appels Graph.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'
import { messageErreur, structureAbsente } from '@/lib/projet-rse/erreurs'

export const dynamic = 'force-dynamic'

/** Métadonnée d'une pièce jointe, telle qu'elle vit dans les sections jsonb. */
interface PieceJointe {
  id?: string
  name?: string
  path?: string
  mime?: string
  size?: number
  deleted_at?: string | null
}

interface Section {
  id?: string
  title?: string
  content?: string
  attachments?: PieceJointe[]
}

/**
 * Convention des clés d'élément porteur. Le préfixe dit la nature, le suffixe
 * l'identifiant. Deux clés sont sans suffixe : la fiche de cadrage et la
 * théorie du changement, uniques par projet.
 */
const NATURES: Record<string, { libelle: string; table?: string; champs?: string }> = {
  cadrage: { libelle: 'Cadrage' },
  'impact-social': { libelle: 'Théorie du changement' },
  jalon: { libelle: 'Jalon', table: 'projet_rse_jalons', champs: 'id, libelle' },
  risque: { libelle: 'Risque', table: 'projet_rse_risques', champs: 'id, libelle' },
  lot: { libelle: 'Lot de travail', table: 'projet_rse_lots', champs: 'id, code, libelle' },
  indicateur: { libelle: 'Indicateur', table: 'projet_rse_indicateurs', champs: 'id, nom' },
  p5: { libelle: 'Analyse d’impact P5' },
  parties: { libelle: 'Parties prenantes' },
  smp: { libelle: 'Indicateur de durabilité', table: 'projet_rse_smp', champs: 'id, libelle' },
  engagement: { libelle: 'Engagement', table: 'projet_rse_engagements', champs: 'id, action' },
  acteur: { libelle: 'Partie prenante', table: 'projet_rse_acteurs', champs: 'id, nom' },
}

/** Découpe « jalon_<uuid> » en { nature, identifiant }. */
function decouper(cle: string): { nature: string; identifiant: string | null } {
  const i = cle.indexOf('_')
  if (i === -1) return { nature: cle, identifiant: null }
  return { nature: cle.slice(0, i), identifiant: cle.slice(i + 1) }
}

/** Libellé d'une ligne, quelle que soit la table d'origine. */
function libelleDeLigne(l: Record<string, unknown>): string {
  const code = typeof l.code === 'string' ? l.code : ''
  const texte = (l.libelle ?? l.nom ?? l.action ?? '') as string
  return code ? `${code} — ${texte}` : texte
}

/**
 * GET /api/projet-rse/documents?organisation_id=…
 * → { elements: [{ projet_id, projet_nom, action_key, nature, libelle,
 *                  note, nb_pieces, pieces: [{ id, nom, item_id, mime, taille }] }] }
 */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    if (!organisationId)
      return NextResponse.json({ error: 'organisation_id requis' }, { status: 400 })
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()

    // Les projets de l'organisation, qui bornent le périmètre de lecture.
    const { data: projets, error: eProjets } = await admin
      .from('projet_rse_projets')
      .select('id, nom')
      .eq('organisation_id', organisationId)
    if (eProjets) return NextResponse.json({ error: messageErreur(eProjets) }, { status: 500 })

    const nomDuProjet = new Map((projets ?? []).map(p => [p.id as string, p.nom as string]))
    const ids = Array.from(nomDuProjet.keys())
    if (!ids.length) return NextResponse.json({ elements: [] })

    const { data: notes, error: eNotes } = await admin
      .from('projet_rse_notes')
      .select('projet_id, action_key, content, sections, updated_at')
      .in('projet_id', ids)
    if (eNotes) {
      // Sans la table, on affiche la cause plutôt qu'une liste vide trompeuse.
      if (structureAbsente(eNotes))
        return NextResponse.json({ error: messageErreur(eNotes) }, { status: 500 })
      return NextResponse.json({ error: eNotes.message }, { status: 500 })
    }

    // Résolution des libellés : un appel par table concernée, jamais un par ligne.
    const parNature: Record<string, string[]> = {}
    for (const n of (notes ?? [])) {
      const { nature, identifiant } = decouper(n.action_key as string)
      if (!identifiant || !NATURES[nature]?.table) continue
      ;(parNature[nature] ??= []).push(identifiant)
    }
    const libelles = new Map<string, string>()
    for (const [nature, listeIds] of Object.entries(parNature)) {
      const meta = NATURES[nature]
      if (!meta?.table) continue
      const { data } = await admin
        .from(meta.table).select(meta.champs ?? 'id').in('id', Array.from(new Set(listeIds)))
      for (const l of ((data ?? []) as unknown as Record<string, unknown>[])) {
        libelles.set(`${nature}_${l.id as string}`, libelleDeLigne(l))
      }
    }

    const elements = (notes ?? []).map(n => {
      const cle = n.action_key as string
      const { nature, identifiant } = decouper(cle)
      const meta = NATURES[nature]
      const sections = (Array.isArray(n.sections) ? n.sections : []) as Section[]
      const pieces = sections.flatMap(s =>
        (s.attachments ?? [])
          .filter(a => !a.deleted_at && a.path)
          .map(a => ({
            id: a.id ?? a.path,
            nom: a.name ?? 'sans nom',
            item_id: a.path,
            mime: a.mime ?? '',
            taille: a.size ?? 0,
            section: (s.title ?? '').replace(/<[^>]*>/g, '').trim(),
          })))
      return {
        projet_id: n.projet_id as string,
        projet_nom: nomDuProjet.get(n.projet_id as string) ?? '—',
        action_key: cle,
        nature: meta?.libelle ?? nature,
        // Pour les clés sans identifiant, le libellé de nature suffit.
        libelle: identifiant ? (libelles.get(cle) ?? identifiant) : (meta?.libelle ?? cle),
        note: ((n.content as string) ?? '').replace(/<[^>]*>/g, '').trim(),
        nb_pieces: pieces.length,
        pieces,
        modifie_le: n.updated_at as string,
      }
    })
    // Ce qui porte des fichiers d'abord, puis le plus récemment modifié.
    elements.sort((a, b) =>
      (b.nb_pieces - a.nb_pieces) || String(b.modifie_le).localeCompare(String(a.modifie_le)))

    return NextResponse.json({ elements })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
