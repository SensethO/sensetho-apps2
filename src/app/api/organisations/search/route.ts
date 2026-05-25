import { NextRequest, NextResponse } from 'next/server'

const API_URL = 'https://recherche-entreprises.api.gouv.fr/search'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q        = searchParams.get('q')?.trim()
  const page     = searchParams.get('page') ?? '1'
  const per_page = searchParams.get('per_page') ?? '10'

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], total_results: 0 })
  }

  try {
    const params = new URLSearchParams({ q, page, per_page, minimal: 'false' })
    const res = await fetch(`${API_URL}?${params}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { results: [], total_results: 0, error: 'API error' },
        { status: res.status }
      )
    }

    const raw = await res.json()

    const results = (raw.results ?? []).map((e: Record<string, unknown>) => {
      const siege      = (e.siege       ?? {}) as Record<string, unknown>
      const complements = (e.complements ?? {}) as Record<string, unknown>
      const dirigeants = (e.dirigeants  ?? []) as Record<string, unknown>[]

      return {
        // ── Identifiants ────────────────────────────────────────────────────
        siren:                    e.siren                           ?? null,
        siret_siege:              siege.siret                       ?? null,
        identifiant_association:  e.identifiant_association_sirene  ?? null,
        // ── Dénomination ────────────────────────────────────────────────────
        nom_complet:              e.nom_complet                     ?? '',
        nom_commercial:           e.nom_commercial                  ?? null,
        sigle:                    e.sigle                           ?? null,
        liste_enseignes:          complements.liste_enseignes        ?? [],
        // ── Statut juridique ────────────────────────────────────────────────
        forme_juridique:          e.forme_juridique                 ?? null,
        nature_juridique:         e.nature_juridique                ?? null,
        etat_administratif:       e.etat_administratif              ?? null,
        date_creation:            e.date_creation                   ?? null,
        date_mise_a_jour:         e.date_mise_a_jour                ?? null,
        // ── Activité ────────────────────────────────────────────────────────
        activite_principale:       e.activite_principale            ?? null,
        section_activite_principale: e.section_activite_principale  ?? null,
        libelle_activite:          e.libelle_activite_principale    ?? null,
        date_debut_activite:       siege.date_debut_activite        ?? null,
        // ── Effectif ────────────────────────────────────────────────────────
        effectif_tranche:         e.tranche_effectif_salarie        ?? null,
        annee_effectif:           e.annee_tranche_effectif_salarie  ?? null,
        categorie_entreprise:     e.categorie_entreprise            ?? null,
        // ── Établissements ──────────────────────────────────────────────────
        nombre_etablissements:        e.nombre_etablissements        ?? null,
        nombre_etablissements_ouverts: e.nombre_etablissements_ouverts ?? null,
        // ── Siège ───────────────────────────────────────────────────────────
        adresse:            siege.adresse           ?? null,
        code_postal:        siege.code_postal        ?? null,
        commune:            siege.commune            ?? null,
        ville:              siege.libelle_commune    ?? null,
        departement:        siege.departement        ?? null,
        libelle_departement: siege.libelle_departement ?? null,
        region:             siege.libelle_region     ?? null,
        latitude:           siege.latitude           ?? null,
        longitude:          siege.longitude          ?? null,
        // ── Labels ──────────────────────────────────────────────────────────
        est_association:           e.est_association              ?? null,
        est_ess:                   e.est_ess                      ?? null,
        est_societe_mission:       e.est_societe_mission          ?? null,
        est_service_public:        e.est_service_public           ?? null,
        est_entrepreneur_individuel:  complements.est_entrepreneur_individuel  ?? null,
        est_entrepreneur_spectacle:   complements.est_entrepreneur_spectacle   ?? null,
        est_finess:                   complements.est_finess                   ?? null,
        est_uai:                      complements.est_uai                      ?? null,
        est_rge:                      complements.est_rge                      ?? null,
        est_organisme_formation:      complements.est_organisme_formation      ?? null,
        est_qualiopi:                 complements.est_qualiopi                 ?? null,
        est_bio:                      complements.est_bio                      ?? null,
        est_patrimoine_vivant:        complements.est_patrimoine_vivant        ?? null,
        est_labor_agrement:           complements.est_labor_agrement           ?? null,
        convention_collective_renseignee: complements.convention_collective_renseignee ?? null,
        liste_idcc: complements.liste_idcc ?? [],
        // ── Dirigeants ──────────────────────────────────────────────────────
        dirigeants: dirigeants.map(d => ({
          nom:                      d.nom                      ?? '',
          prenoms:                  d.prenoms                  ?? undefined,
          qualite:                  d.qualite                  ?? undefined,
          date_naissance_partielle: d.date_naissance_partielle ?? undefined,
          nationalite:              d.nationalite              ?? undefined,
          type_dirigeant:           d.type_dirigeant           ?? 'personne_physique',
          denomination:             d.denomination             ?? undefined,
          siren:                    d.siren                    ?? undefined,
        })),
        // ── Raw ─────────────────────────────────────────────────────────────
        raw_data: e,
      }
    })

    return NextResponse.json({
      results,
      total_results: raw.total_results ?? 0,
      page:          raw.page          ?? 1,
      per_page:      raw.per_page      ?? 10,
    })
  } catch (err) {
    console.error('[organisations/search]', err)
    return NextResponse.json(
      { results: [], total_results: 0, error: 'Internal error' },
      { status: 500 }
    )
  }
}
