// Succession d'une partie prenante.
//
// Renommer un acteur propage partout, mais réécrit le passé : les entrées de
// journal antérieures finissent par désigner un enregistrement qui porte
// désormais un autre nom. Quand une personne en remplace une autre, ce n'est
// pas un changement de libellé, c'est un changement de titulaire.
//
// La succession crée donc un nouvel acteur, transfère les rattachements, clôt
// le prédécesseur — qui reste au registre, inactif — et laisse chaque trace
// passée attachée à la personne qui l'a produite.
//
// Règle sur les actions d'engagement : celles qui restent à faire ou sont en
// cours suivent le successeur, parce qu'il devra les mener. Celles qui sont
// achevées restent au prédécesseur, parce que c'est lui qui les a menées.
//
// AUCUNE COLONNE NOUVELLE. Le lien entre prédécesseur et successeur est porté
// par une ligne de `projet_rse_acteur_historique` de champ « succession », dont
// `ancienne_valeur` et `nouvelle_valeur` contiennent les deux identifiants.
// Une ligne symétrique est écrite sur chacun des deux acteurs, ce qui rend la
// navigation possible dans les deux sens avec une seule requête.

import { createAdminClient } from '@/lib/supabase/admin'
import { elementsRattaches } from '@/lib/projet-rse/acteurs'

/** Attributs de la fonction, repris par le successeur. */
const REPRIS = [
  'organisation', 'type', 'categorie', 'role', 'pouvoir', 'interet',
  'legitimite', 'urgence', 'attentes', 'strategie', 'engagement_souhaite',
] as const

export interface ResultatSuccession {
  predecesseur: { id: string; nom: string }
  successeur: { id: string; nom: string }
  rattachements_transferes: number
  engagements_transferes: number
  engagements_conserves: number
  elements_journalises: number
}

function dateFr(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Remplace le titulaire d'une partie prenante.
 *
 * @param dateEffet  date à partir de laquelle le successeur est en fonction
 * @param engagementInitial  position d'engagement du successeur. Par défaut
 *   « peu conscient » : un successeur hérite du rôle, pas de la relation.
 */
export async function succeder(opts: {
  acteurId: string
  nouveauNom: string
  motif: string
  dateEffet: string
  auteurId: string
  engagementInitial?: string
  attributs?: Record<string, unknown>
}): Promise<ResultatSuccession | { erreur: string; statut: number }> {
  const admin = createAdminClient()

  const { data: ancien } = await admin
    .from('projet_rse_acteurs').select('*').eq('id', opts.acteurId).maybeSingle()
  if (!ancien) return { erreur: 'Acteur introuvable', statut: 404 }
  if (!ancien.actif)
    return { erreur: `« ${ancien.nom} » a déjà été remplacé et n’est plus actif au registre.`, statut: 409 }
  if (ancien.type !== 'personne' && ancien.type !== 'fonction')
    return {
      erreur: 'La succession ne s’applique qu’à une personne physique ou à une fonction. '
            + 'Une entité ou un collectif se modifie, il ne se remplace pas.',
      statut: 400,
    }

  const nom = opts.nouveauNom.trim()
  if (!nom) return { erreur: 'Le nom du successeur est requis.', statut: 400 }
  if (nom.toLowerCase() === String(ancien.nom).toLowerCase())
    return { erreur: 'Le successeur porte le même nom que le prédécesseur.', statut: 400 }
  if (!opts.motif?.trim())
    return {
      erreur: 'Le motif est requis : il sera repris dans le fil d’avancement de chaque '
            + 'élément rattaché, et c’est lui qui rendra le changement lisible plus tard.',
      statut: 400,
    }

  // 1. Le successeur, avec les attributs de la fonction et une relation à construire.
  const insert: Record<string, unknown> = { organisation_id: ancien.organisation_id, nom }
  for (const k of REPRIS) insert[k] = ancien[k]
  Object.assign(insert, opts.attributs ?? {})
  insert.engagement_actuel = opts.engagementInitial ?? 'peu_conscient'
  insert.statut_suivi = 'a_engager'
  insert.verbatims = null

  const { data: nouveau, error: eN } = await admin
    .from('projet_rse_acteurs').insert(insert).select().single()
  if (eN) {
    const doublon = eN.message.includes('idx_projet_rse_acteurs_nom')
    return {
      erreur: doublon ? `« ${nom} » figure déjà au registre de cette organisation.` : eN.message,
      statut: doublon ? 409 : 500,
    }
  }

  // 2. Les rattachements suivent, avec leur rôle local et leur criticité.
  const elements = await elementsRattaches(opts.acteurId)
  const { data: liens } = await admin
    .from('projet_rse_acteur_liens').select('*').eq('acteur_id', opts.acteurId)
  let transferes = 0
  for (const l of liens ?? []) {
    const { error } = await admin.from('projet_rse_acteur_liens').insert({
      acteur_id: nouveau.id,
      portefeuille_id: l.portefeuille_id, programme_id: l.programme_id,
      sous_programme_id: l.sous_programme_id, projet_id: l.projet_id,
      role_local: l.role_local, criticite: l.criticite,
    })
    if (!error) transferes++
  }
  await admin.from('projet_rse_acteur_liens').delete().eq('acteur_id', opts.acteurId)

  // 3. Les actions à mener suivent ; les actions menées restent au prédécesseur.
  const { data: engs } = await admin
    .from('projet_rse_engagements').select('id, statut').eq('acteur_id', opts.acteurId)
  const aTransferer = (engs ?? []).filter(e => e.statut !== 'fait').map(e => e.id)
  const conserves = (engs ?? []).length - aTransferer.length
  if (aTransferer.length)
    await admin.from('projet_rse_engagements')
      .update({ acteur_id: nouveau.id }).in('id', aTransferer)

  // 4. Le prédécesseur est clos, non supprimé.
  await admin.from('projet_rse_acteurs')
    .update({ actif: false, statut_suivi: 'ok' }).eq('id', opts.acteurId)

  // 5. Traçabilité, symétrique et navigable dans les deux sens.
  const quand = dateFr(opts.dateEffet)
  await admin.from('projet_rse_acteur_historique').insert([
    {
      acteur_id: opts.acteurId, type: 'retrait', champ: 'succession',
      ancienne_valeur: opts.acteurId, nouvelle_valeur: nouveau.id,
      motif: `Remplacé par ${nom} à compter du ${quand}. ${opts.motif.trim()}`,
      auteur_id: opts.auteurId,
    },
    {
      acteur_id: nouveau.id, type: 'remplacement', champ: 'succession',
      ancienne_valeur: opts.acteurId, nouvelle_valeur: nouveau.id,
      motif: `Succède à ${ancien.nom} à compter du ${quand}. ${opts.motif.trim()}`,
      auteur_id: opts.auteurId,
    },
  ])

  // 6. Le fil d'avancement de chaque élément rattaché.
  if (elements.length) {
    const lignes = elements.map(el => {
      let texte = `Succession : ${ancien.nom} est remplacé par ${nom} à compter du ${quand}.`
      if (el.role_local) {
        const r = el.role_local.trim()
        texte += ` Rôle sur cet élément : ${/[.!?]$/.test(r) ? r : r + '.'}`
      }
      texte += ` Motif : ${opts.motif.trim()}`
      if (aTransferer.length || conserves) {
        texte += ` Actions d’engagement : ${aTransferer.length} transférée(s) au successeur`
        texte += conserves
          ? `, ${conserves} achevée(s) restant attachée(s) à ${ancien.nom}.`
          : '.'
      }
      return {
        organisation_id: ancien.organisation_id,
        [el.colonne]: el.id,
        type: 'acteur',
        acteur_id: nouveau.id,
        texte,
        auteur_id: opts.auteurId,
      }
    })
    await admin.from('projet_rse_journal').insert(lignes)
  }

  return {
    predecesseur: { id: opts.acteurId, nom: ancien.nom },
    successeur: { id: nouveau.id, nom },
    rattachements_transferes: transferes,
    engagements_transferes: aTransferer.length,
    engagements_conserves: conserves,
    elements_journalises: elements.length,
  }
}

export interface LienSuccession {
  predecesseur_id: string | null
  successeur_id: string | null
}

/**
 * Chaîne de succession de toute l'organisation, pour un affichage direct.
 * Renvoie, par identifiant d'acteur, son prédécesseur et son successeur.
 */
export async function successionsDeLOrganisation(
  organisationId: string
): Promise<Record<string, LienSuccession>> {
  const admin = createAdminClient()
  const { data: acteurs } = await admin
    .from('projet_rse_acteurs').select('id').eq('organisation_id', organisationId)
  const ids = (acteurs ?? []).map(a => a.id)
  if (!ids.length) return {}

  const { data: lignes } = await admin
    .from('projet_rse_acteur_historique')
    .select('acteur_id, ancienne_valeur, nouvelle_valeur')
    .eq('champ', 'succession').in('acteur_id', ids)

  const out: Record<string, LienSuccession> = {}
  for (const l of lignes ?? []) {
    const ancien = l.ancienne_valeur as string, nouveau = l.nouvelle_valeur as string
    if (!ancien || !nouveau) continue
    out[ancien] = { ...(out[ancien] ?? { predecesseur_id: null, successeur_id: null }), successeur_id: nouveau }
    out[nouveau] = { ...(out[nouveau] ?? { predecesseur_id: null, successeur_id: null }), predecesseur_id: ancien }
  }
  return out
}
