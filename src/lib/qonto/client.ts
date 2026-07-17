// Client API Qonto (thirdparty) — identifiants passés en paramètre (par organisation,
// déchiffrés depuis qonto_connections) ; PAS de variables d'environnement.
// Formes de types alignées sur @sensetho/catalogue-app (src/qonto/data.ts).
// Auth Qonto : header `Authorization: <login>:<secret-key>`.

const QONTO_BASE = 'https://thirdparty.qonto.com/v2'

export interface QontoCreds {
  login: string
  secretKey: string
}

export interface BankAccount {
  id: string
  slug: string
  iban: string
  bic: string
  currency: string
  balance: number
  balance_cents: number
  authorized_balance_cents: number
  name: string
  status: string
}

export interface QontoOrg {
  slug: string
  legal_name: string
  bank_accounts: BankAccount[]
}

export interface QontoTransaction {
  transaction_id: string
  amount: number
  amount_cents: number
  local_amount_cents: number
  side: 'debit' | 'credit'
  operation_type: string
  currency: string
  label: string
  settled_at: string | null
  emitted_at: string
  status: string
  note: string | null
  reference: string | null
  vat_amount_cents: number | null
  vat_rate: number | null
  attachment_ids: string[]
  card_last_digits: string | null
  category: string | null
}

export interface QontoMeta {
  current_page: number
  next_page: number | null
  prev_page: number | null
  total_pages: number
  total_count: number
  per_page: number
}

export interface QontoTransactionsResponse {
  transactions: QontoTransaction[]
  meta: QontoMeta
}

export interface QontoTransactionParams {
  /** Identifiant du compte bancaire (multi-comptes) — prioritaire sur iban. */
  bank_account_id?: string
  iban?: string
  status?: string
  side?: 'debit' | 'credit'
  settled_from?: string // YYYY-MM-DD
  settled_to?: string   // YYYY-MM-DD
  page?: number
  per_page?: number
}

/** Erreur typée pour distinguer les identifiants invalides (401 Qonto). */
export class QontoApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'QontoApiError'
    this.status = status
  }
}

function authHeader(creds: QontoCreds): string {
  return `${creds.login}:${creds.secretKey}`
}

async function qontoFetch(creds: QontoCreds, path: string): Promise<unknown> {
  const res = await fetch(`${QONTO_BASE}${path}`, {
    headers: {
      Authorization: authHeader(creds),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    if (res.status === 401) {
      throw new QontoApiError(401, 'Identifiants Qonto invalides (login ou clé secrète incorrects).')
    }
    const err = await res.text().catch(() => '')
    throw new QontoApiError(res.status, `Qonto API ${res.status}: ${err.slice(0, 200)}`)
  }
  return res.json()
}

/** Organisation Qonto + liste de ses comptes bancaires (multi-comptes / multi-IBAN). */
export async function qontoGetOrganization(creds: QontoCreds): Promise<QontoOrg> {
  const data = (await qontoFetch(creds, `/organizations/${encodeURIComponent(creds.login)}`)) as {
    organization?: {
      slug?: string
      legal_name?: string
      bank_accounts?: Array<Record<string, unknown>>
    }
  }
  const org = data.organization
  if (!org) throw new QontoApiError(502, 'Réponse Qonto inattendue : organisation absente.')
  const bank_accounts: BankAccount[] = (org.bank_accounts ?? []).map((a) => ({
    id: String(a.id ?? ''),
    slug: String(a.slug ?? ''),
    iban: String(a.iban ?? ''),
    bic: String(a.bic ?? ''),
    currency: String(a.currency ?? 'EUR'),
    balance: Number(a.balance ?? 0),
    balance_cents: Number(a.balance_cents ?? 0),
    authorized_balance_cents: Number(a.authorized_balance_cents ?? 0),
    name: String(a.name ?? ''),
    status: String(a.status ?? ''),
  }))
  return {
    slug: String(org.slug ?? ''),
    legal_name: String(org.legal_name ?? ''),
    bank_accounts,
  }
}

/** Transactions d'un compte bancaire (par bank_account_id ou iban), avec pagination Qonto. */
export async function qontoGetTransactions(
  creds: QontoCreds,
  params: QontoTransactionParams
): Promise<QontoTransactionsResponse> {
  if (!params.bank_account_id && !params.iban) {
    throw new QontoApiError(400, 'bank_account_id ou iban requis pour lister les transactions.')
  }
  const qs = new URLSearchParams()
  if (params.bank_account_id) qs.set('bank_account_id', params.bank_account_id)
  else if (params.iban) qs.set('iban', params.iban)
  qs.append('status[]', params.status ?? 'completed')
  if (params.side) qs.append('side[]', params.side)
  if (params.settled_from) qs.set('settled_at_from', `${params.settled_from}T00:00:00.000Z`)
  if (params.settled_to) qs.set('settled_at_to', `${params.settled_to}T23:59:59.999Z`)
  qs.set('current_page', String(params.page ?? 1))
  qs.set('per_page', String(params.per_page ?? 100))
  qs.set('sort_by', 'settled_at:desc')

  const data = (await qontoFetch(creds, `/transactions?${qs.toString()}`)) as {
    transactions?: QontoTransaction[]
    meta?: QontoMeta
  }
  return {
    transactions: data.transactions ?? [],
    meta: data.meta ?? {
      current_page: 1, next_page: null, prev_page: null,
      total_pages: 1, total_count: (data.transactions ?? []).length, per_page: params.per_page ?? 100,
    },
  }
}
