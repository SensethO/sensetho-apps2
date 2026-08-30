// Registre des acteurs — propagation et traçabilité.
//
// Un acteur est enregistré une fois au niveau de l'organisation et référencé
// par les éléments qu'il concerne : portefeuille, programme, sous-programme,
// projet. Le modifier le modifie donc partout, sans recopie.
//
// Mais propager silencieusement serait un défaut : si l'interlocuteur d'un
// projet change en cours de route, celui qui relira le projet dans six mois
// doit pouvoir le constater. Chaque modification produit donc deux traces —
// une ligne dans l'historique de l'acteur, et une ligne dans le fil
// d'avancement de chaque élément rattaché, rédigée avec son contexte.

import { createAdminClient } from '@/lib/supabase/admin'

/** Champs de l'acteur qui peuvent être modifiés par l'API. */
export const CHAMPS_ACTEUR = [
  'nom', 'organisation', 'type', 'categorie', 'role', 'pouvoir', 'interet',
  'legitimite', 'urgence', 'attitude', 'attentes', 'verbatims', 'strategie',
  'statut_suivi', 'engagement_actuel', 'engagement_souhaite', 'actif',
] as const

/** Libellés lisibles, employés dans le fil d'avancement. */
const LIBELLE: Record<string, string> = {
  nom: 'nom', organisation: 'entité d’appartenance', type: 'nature',
  categorie: 'catégorie', role: 'rôle', pouvoir: 'pouvoir', interet: 'intérêt',
  legitimite: 'légitimité', urgence: 'urgence', attitude: 'attitude',
  attentes: 'attentes', verbatims: 'verbatims', strategie: 'stratégie d’engagement',
  statut_suivi: 'statut de suivi', engagement_actuel: 'engagement actuel',
  engagement_souhaite: 'engagement souhaité', actif: 'présence au registre',
}

/** Champs dont la modification mérite d'être reportée dans le fil des éléments. */
const CHAMPS_NOTABLES = new Set([
  'nom', 'organisation', 'role', 'type', 'pouvoir', 'legitimite', 'urgence',
  'attitude', 'engagement_actuel', 'statut_suivi', 'actif',
])

export interface ElementRattache {
  niveau: 'portefeuille' | 'programme' | 'sous_programme' | 'projet'
  colonne: 'portefeuille_id' | 'programme_id' | 'sous_programme_id' | 'projet_id'
  id: string
  nom: string
  role_local: string | null
}

/** Les éléments auxquels un acteur est rattaché, avec leur nom, pour le journal. */
export async function elementsRattaches(acteurId: string): Promise<ElementRattache[]> {
  const admin = createAdminClient()
  const { data: liens } = await admin
    .from('projet_rse_acteur_liens')
    .select('portefeuille_id, programme_id, sous_programme_id, projet_id, role_local')
    .eq('acteur_id', acteurId)
  if (!liens?.length) return []

  const ids = (col: string) =>
    liens.map(l => (l as Record<string, string | null>)[col]).filter((v): v is string => Boolean(v))

  const [pf, pg, sp, pj] = await Promise.all([
    ids('portefeuille_id').length
      ? admin.from('projet_rse_portefeuilles').select('id, nom').in('id', ids('portefeuille_id'))
      : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
    ids('programme_id').length
      ? admin.from('projet_rse_programmes').select('id, nom').in('id', ids('programme_id'))
      : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
    ids('sous_programme_id').length
      ? admin.from('projet_rse_sous_programmes').select('id, nom, code').in('id', ids('sous_programme_id'))
      : Promise.resolve({ data: [] as { id: string; nom: string; code?: string }[] }),
    ids('projet_id').length
      ? admin.from('projet_rse_projets').select('id, nom').in('id', ids('projet_id'))
      : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
  ])

  const nom = (rows: { id: string; nom: string }[] | null, id: string) =>
    rows?.find(r => r.id === id)?.nom ?? '(élément supprimé)'

  const out: ElementRattache[] = []
  for (const l of liens) {
    const lien = l as Record<string, string | null>
    if (lien.portefeuille_id)
      out.push({ niveau: 'portefeuille', colonne: 'portefeuille_id', id: lien.portefeuille_id,
        nom: nom(pf.data, lien.portefeuille_id), role_local: lien.role_local })
    else if (lien.programme_id)
      out.push({ niveau: 'programme', colonne: 'programme_id', id: lien.programme_id,
        nom: nom(pg.data, lien.programme_id), role_local: lien.role_local })
    else if (lien.sous_programme_id)
      out.push({ niveau: 'sous_programme', colonne: 'sous_programme_id', id: lien.sous_programme_id,
        nom: nom(sp.data as { id: string; nom: string }[], lien.sous_programme_id), role_local: lien.role_local })
    else if (lien.projet_id)
      out.push({ niveau: 'projet', colonne: 'projet_id', id: lien.projet_id,
        nom: nom(pj.data, lien.projet_id), role_local: lien.role_local })
  }
  return out
}

function affiche(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  return String(v)
}

/**
 * Consigne une modification d'acteur : historique de l'acteur, puis report dans
 * le fil d'avancement de chaque élément rattaché.
 *
 * `motif` porte le contexte. Il est exigé par la route lorsqu'une personne
 * physique est remplacée — c'est-à-dire quand le nom d'un acteur de type
 * « personne » change.
 */
export async function consignerModification(opts: {
  acteurId: string
  organisationId: string
  nomActeur: string
  avant: Record<string, unknown>
  apres: Record<string, unknown>
  motif?: string | null
  auteurId: string
  remplacement?: boolean
}): Promise<{ champs: string[]; elements: number }> {
  const admin = createAdminClient()
  const changes = CHAMPS_ACTEUR.filter(
    c => c in opts.apres && String(opts.avant[c] ?? '') !== String(opts.apres[c] ?? ''))
  if (!changes.length) return { champs: [], elements: 0 }

  await admin.from('projet_rse_acteur_historique').insert(
    changes.map(c => ({
      acteur_id: opts.acteurId,
      type: opts.remplacement && c === 'nom' ? 'remplacement' : 'modification',
      champ: c,
      ancienne_valeur: affiche(opts.avant[c]),
      nouvelle_valeur: affiche(opts.apres[c]),
      motif: opts.motif ?? null,
      auteur_id: opts.auteurId,
    })))

  const notables = changes.filter(c => CHAMPS_NOTABLES.has(c))
  if (!notables.length) return { champs: changes as string[], elements: 0 }

  const elements = await elementsRattaches(opts.acteurId)
  if (!elements.length) return { champs: changes as string[], elements: 0 }

  const nomFinal = (opts.apres.nom as string) ?? opts.nomActeur
  const lignes = elements.map(el => {
    let texte: string
    if (opts.remplacement) {
      texte = `Changement d’interlocuteur : ${affiche(opts.avant.nom)} est remplacé par ${nomFinal}.`
      if (el.role_local) {
        const r = el.role_local.trim()
        texte += ` Rôle sur cet élément : ${/[.!?]$/.test(r) ? r : r + '.'}`
      }
      texte += opts.motif
        ? ` Motif : ${opts.motif}`
        : ' Motif non renseigné — à documenter.'
    } else {
      const detail = notables
        .map(c => `${LIBELLE[c] ?? c} : ${affiche(opts.avant[c])} → ${affiche(opts.apres[c])}`)
        .join(' · ')
      texte = `Mise à jour de la partie prenante « ${nomFinal} » — ${detail}.`
      if (opts.motif) texte += ` Motif : ${opts.motif}`
    }
    return {
      organisation_id: opts.organisationId,
      [el.colonne]: el.id,
      type: 'acteur',
      acteur_id: opts.acteurId,
      texte,
      auteur_id: opts.auteurId,
    }
  })
  await admin.from('projet_rse_journal').insert(lignes)
  return { champs: changes as string[], elements: elements.length }
}

/** Consigne un rattachement ou un détachement, des deux côtés. */
export async function consignerLien(opts: {
  acteurId: string
  organisationId: string
  nomActeur: string
  element: ElementRattache
  sens: 'rattachement' | 'detachement'
  motif?: string | null
  auteurId: string
}): Promise<void> {
  const admin = createAdminClient()
  const NIVEAU = { portefeuille: 'portefeuille', programme: 'programme',
    sous_programme: 'sous-programme', projet: 'projet' } as const

  await admin.from('projet_rse_acteur_historique').insert({
    acteur_id: opts.acteurId,
    type: opts.sens,
    champ: NIVEAU[opts.element.niveau],
    nouvelle_valeur: opts.element.nom,
    motif: opts.motif ?? null,
    auteur_id: opts.auteurId,
  })

  // Le rôle local est saisi librement : il se termine souvent déjà par un point.
  const phrase = (t: string | null) => {
    const v = (t ?? '').trim()
    return !v ? '' : /[.!?]$/.test(v) ? ` — ${v}` : ` — ${v}.`
  }
  const texte = opts.sens === 'rattachement'
    ? `Partie prenante rattachée : « ${opts.nomActeur} »${phrase(opts.element.role_local) || '.'}${opts.motif ? ` Motif : ${opts.motif}` : ''}`
    : `Partie prenante détachée : « ${opts.nomActeur} ».${opts.motif ? ` Motif : ${opts.motif}` : ''}`

  await admin.from('projet_rse_journal').insert({
    organisation_id: opts.organisationId,
    [opts.element.colonne]: opts.element.id,
    type: 'rattachement',
    acteur_id: opts.acteurId,
    texte,
    auteur_id: opts.auteurId,
  })
}
