// Adressage d'un élément porteur de notes, à n'importe quel niveau.
//
// projet_rse_notes accepte cinq cibles depuis la migration 20260901 :
// portefeuille, programme, sous-programme, projet, acteur du registre — et
// l'organisation elle-même lorsqu'aucune n'est désignée. Une note doit donc
// pouvoir se désigner d'une seule chaîne, pour que les routes et le panneau
// partagé n'aient qu'un paramètre.
//
// Forme retenue : « programme:<uuid> », « organisation:<uuid> ». Elle passe
// dans un segment d'URL sans encodage particulier et se lit à l'œil nu dans
// un journal.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'

export type Niveau = 'organisation' | 'portefeuille' | 'programme'
                   | 'sous_programme' | 'projet' | 'acteur'

/** Colonne de projet_rse_notes qui porte chaque niveau. */
export const COLONNE: Record<Niveau, string | null> = {
  organisation: null,          // aucune cible : la note est celle de l'organisation
  portefeuille: 'portefeuille_id',
  programme: 'programme_id',
  sous_programme: 'sous_programme_id',
  projet: 'projet_id',
  acteur: 'acteur_id',
}

/** Table à interroger pour retrouver l'organisation propriétaire, et le nom. */
const SOURCE: Record<Niveau, { table: string; champNom: string } | null> = {
  organisation: null,
  portefeuille: { table: 'projet_rse_portefeuilles', champNom: 'nom' },
  programme: { table: 'projet_rse_programmes', champNom: 'nom' },
  sous_programme: { table: 'projet_rse_sous_programmes', champNom: 'nom' },
  projet: { table: 'projet_rse_projets', champNom: 'nom' },
  acteur: { table: 'projet_rse_acteurs', champNom: 'nom' },
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface Cible {
  niveau: Niveau
  id: string
  organisationId: string
  nom: string
}

/** Découpe « programme:<uuid> ». Renvoie null si la forme n'est pas la bonne. */
export function lireCible(brut: string): { niveau: Niveau; id: string } | null {
  const i = brut.indexOf(':')
  if (i === -1) return null
  const niveau = brut.slice(0, i) as Niveau
  const id = brut.slice(i + 1)
  if (!(niveau in COLONNE) || !UUID.test(id)) return null
  return { niveau, id }
}

/**
 * Résout la cible, vérifie que l'appelant possède son organisation, et rend de
 * quoi écrire la ligne de note. Renvoie une NextResponse d'erreur sinon —
 * même contrat d'appel que requireProjet.
 */
export async function requireCible(brut: string): Promise<Cible | NextResponse> {
  const lu = lireCible(decodeURIComponent(brut))
  if (!lu) return NextResponse.json({ error: 'Cible mal formée' }, { status: 400 })

  const admin = createAdminClient()
  let organisationId = lu.id
  let nom = 'Organisation'

  const src = SOURCE[lu.niveau]
  if (src) {
    // Le sous-programme n'a pas d'organisation en propre : il remonte par son
    // programme. Les autres la portent directement.
    const colonnes = lu.niveau === 'sous_programme'
      ? `id, ${src.champNom}, programme_id`
      : `id, ${src.champNom}, organisation_id`
    const { data, error } = await admin
      .from(src.table).select(colonnes).eq('id', lu.id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Élément introuvable' }, { status: 404 })

    const ligne = data as unknown as Record<string, unknown>
    nom = (ligne[src.champNom] as string) ?? '—'

    if (lu.niveau === 'sous_programme') {
      const { data: pg } = await admin
        .from('projet_rse_programmes').select('organisation_id')
        .eq('id', ligne.programme_id as string).maybeSingle()
      if (!pg) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
      organisationId = pg.organisation_id as string
    } else {
      organisationId = ligne.organisation_id as string
    }
  }

  const guard = await requireOrgOwner(organisationId)
  if (guard instanceof NextResponse) return guard

  return { niveau: lu.niveau, id: lu.id, organisationId, nom }
}

/** Filtre Supabase correspondant à la cible, pour lire ou écrire sa note. */
export function filtreDeCible(c: Cible): Record<string, string | null> {
  const f: Record<string, string | null> = { organisation_id: c.organisationId }
  for (const col of Object.values(COLONNE)) if (col) f[col] = null
  const col = COLONNE[c.niveau]
  if (col) f[col] = c.id
  return f
}

/** Segment de dossier SharePoint d'une cible, lisible dans l'arborescence. */
export function dossierDeCible(c: Cible): string {
  const propre = (s: string) => s.replace(/[/\\:*?"<>|#%]/g, '_').trim()
  if (c.niveau === 'organisation') return '_Organisation'
  const prefixe: Record<Niveau, string> = {
    organisation: '_Organisation', portefeuille: '_Portefeuille',
    programme: '_Programme', sous_programme: '_Sous-programme',
    projet: '', acteur: '_Partie-prenante',
  }
  const p = prefixe[c.niveau]
  return propre(p ? `${p} ${c.nom}` : c.nom) || c.id
}
