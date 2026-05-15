import { NextRequest, NextResponse } from 'next/server'

const API_URL = 'https://recherche-entreprises.api.gouv.fr/search'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const page = searchParams.get('page') ?? '1'
  const per_page = searchParams.get('per_page') ?? '10'

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], total_results: 0 })
  }

  try {
    const params = new URLSearchParams({ q, page, per_page, minimal: 'false' })
    const res = await fetch(`${API_URL}?${params}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 },
    })

    if (!res.ok) {
      return NextResponse.json({ results: [], total_results: 0, error: 'API error' }, { status: res.status })
    }

    const raw = await res.json()

    // Normalise les résultats
    const results = (raw.results ?? []).map((e: Record<string, unknown>) => {
      const siege = (e.siege ?? {}) as Record<string, unknown>
      const dirigeants = (e.dirigeants ?? []) as Record<string, unknown>[]
      return {
        siren: e.siren ?? null,
        siret_siege: siege.siret ?? null,
        nom_complet: e.nom_complet ?? '',
        nom_commercial: e.nom_commercial ?? null,
        sigle: e.sigle ?? null,
        forme_juridique: e.forme_juridique ?? null,
        etat_administratif: e.etat_administratif ?? null,
        activite_principale: e.activite_principale ?? null,
        libelle_activite: e.libelle_activite_principale ?? null,
        categorie_entreprise: e.categorie_entreprise ?? null,
        effectif_tranche: e.tranche_effectif_salarie ?? null,
        adresse: siege.adresse ?? null,
        code_postal: siege.code_postal ?? null,
        ville: siege.libelle_commune ?? null,
        region: siege.libelle_region ?? null,
        est_association: e.est_association ?? null,
        est_ess: e.est_ess ?? null,
        est_societe_mission: e.est_societe_mission ?? null,
        est_service_public: e.est_service_public ?? null,
        dirigeants: dirigeants.map(d => ({
          nom: d.nom ?? '',
          prenoms: d.prenoms ?? undefined,
          qualite: d.qualite ?? undefined,
          date_naissance_partielle: d.date_naissance_partielle ?? undefined,
          nationalite: d.nationalite ?? undefined,
          type_dirigeant: d.type_dirigeant ?? 'personne_physique',
          denomination: d.denomination ?? undefined,
          siren: d.siren ?? undefined,
        })),
        identifiant_association: e.identifiant_association_sirene ?? null,
        raw_data: e,
      }
    })

    return NextResponse.json({
      results,
      total_results: raw.total_results ?? 0,
      page: raw.page ?? 1,
      per_page: raw.per_page ?? 10,
    })
  } catch (err) {
    console.error('[organisations/search]', err)
    return NextResponse.json({ results: [], total_results: 0, error: 'Internal error' }, { status: 500 })
  }
}
