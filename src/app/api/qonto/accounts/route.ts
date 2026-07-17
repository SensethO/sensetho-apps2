import { NextRequest, NextResponse } from 'next/server'
import { qontoGetOrganization, QontoApiError } from '@/lib/qonto/client'
import { requireOrgOwner, getCreds } from '@/lib/qonto/connections'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET ?organisation_id= — organisation Qonto + comptes bancaires (multi-comptes).
 * 404 si aucune connexion Qonto n'est configurée pour l'organisation.
 */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const creds = await getCreds(organisationId!)
    if (!creds) {
      return NextResponse.json(
        { error: 'Aucune connexion Qonto configurée pour cette organisation' },
        { status: 404 }
      )
    }

    const org = await qontoGetOrganization(creds)
    return NextResponse.json({
      organization: { name: org.legal_name, slug: org.slug },
      bank_accounts: org.bank_accounts.map((a) => ({
        id: a.id,
        slug: a.slug,
        iban: a.iban,
        name: a.name,
        balance: a.balance,
        balance_cents: a.balance_cents,
        currency: a.currency,
        status: a.status,
      })),
    })
  } catch (err) {
    if (err instanceof QontoApiError && err.status === 401) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
