import { NextRequest, NextResponse } from 'next/server'
import { qontoGetTransactions, QontoApiError } from '@/lib/qonto/client'
import { requireOrgOwner, getCreds } from '@/lib/qonto/connections'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET ?organisation_id=&bank_account_id=&side=&settled_from=&settled_to=&page=&per_page=
 * Liste paginée des transactions Qonto d'un compte bancaire.
 * 404 si aucune connexion Qonto n'est configurée pour l'organisation.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const organisationId = sp.get('organisation_id')
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const bankAccountId = sp.get('bank_account_id')
    const iban = sp.get('iban')
    if (!bankAccountId && !iban) {
      return NextResponse.json({ error: 'bank_account_id (ou iban) requis' }, { status: 400 })
    }

    const creds = await getCreds(organisationId!)
    if (!creds) {
      return NextResponse.json(
        { error: 'Aucune connexion Qonto configurée pour cette organisation' },
        { status: 404 }
      )
    }

    const sideParam = sp.get('side')
    const side = sideParam === 'debit' || sideParam === 'credit' ? sideParam : undefined

    const { transactions, meta } = await qontoGetTransactions(creds, {
      bank_account_id: bankAccountId ?? undefined,
      iban: iban ?? undefined,
      status: sp.get('status') ?? undefined,
      side,
      settled_from: sp.get('settled_from') ?? undefined,
      settled_to: sp.get('settled_to') ?? undefined,
      page: sp.get('page') ? parseInt(sp.get('page')!, 10) : undefined,
      per_page: sp.get('per_page') ? parseInt(sp.get('per_page')!, 10) : undefined,
    })

    return NextResponse.json({ transactions, meta })
  } catch (err) {
    if (err instanceof QontoApiError && err.status === 401) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
