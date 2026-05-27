/**
 * Microsoft Graph API — Service client (Application permissions / Client Credentials)
 * Accès à la boîte mail partagée web@sensetho.com
 * Utilise fetch natif (pas de dépendance MSAL) pour la compatibilité Next.js App Router
 */

const SHARED_MAILBOX = 'web@sensetho.com'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// ─── Token OAuth2 Client Credentials (fetch natif) ────────────────────────────

let tokenCache: { token: string; expiresAt: number } | null = null

export async function getAccessToken(): Promise<string> {
  // Réutiliser le token s'il est encore valide (marge de 60s)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token
  }

  const tenantId = process.env.MS_TENANT_ID
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Variables MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET manquantes dans .env.local')
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
      cache: 'no-store',
    }
  )

  const data = await res.json()

  if (!data.access_token) {
    throw new Error(`Erreur token Microsoft: ${data.error} — ${data.error_description}`)
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }

  return tokenCache.token
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function graphFetch<T>(path: string): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Graph API error ${res.status}: ${err}`)
  }
  return res.json()
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphEmail {
  id: string
  conversationId: string
  subject: string | null
  bodyPreview: string
  body: { contentType: string; content: string }
  from: { emailAddress: { name: string; address: string } } | null
  toRecipients: { emailAddress: { name: string; address: string } }[]
  ccRecipients: { emailAddress: { name: string; address: string } }[]
  receivedDateTime: string
  isRead: boolean
  hasAttachments: boolean
  importance: string
  categories: string[]
  parentFolderId: string
}

export interface GraphMailFolder {
  id: string
  displayName: string
  totalItemCount: number
  unreadItemCount: number
}

// ─── Récupérer les dossiers de la boîte ───────────────────────────────────────

export async function getMailFolders(): Promise<GraphMailFolder[]> {
  const data = await graphFetch<{ value: GraphMailFolder[] }>(
    `/users/${SHARED_MAILBOX}/mailFolders?$top=50`
  )
  return data.value
}

// ─── Récupérer les mails d'un dossier (avec pagination automatique) ───────────

export interface FetchMailsOptions {
  folderId?: string       // ID du dossier (défaut: toute la boîte)
  maxTotal?: number       // Nombre max total à récupérer (défaut: 500)
  since?: string          // ISO date — seulement les mails plus récents
}

export async function fetchMails(options: FetchMailsOptions = {}): Promise<GraphEmail[]> {
  const { folderId, maxTotal = 500, since } = options

  const basePath = folderId
    ? `/users/${SHARED_MAILBOX}/mailFolders/${folderId}/messages`
    : `/users/${SHARED_MAILBOX}/messages`

  const params = new URLSearchParams({
    $top: '100',  // max par page Graph API
    $select: 'id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,importance,categories,parentFolderId',
    $orderby: 'receivedDateTime desc',
  })

  if (since) {
    params.set('$filter', `receivedDateTime ge ${since}`)
  }

  const allEmails: GraphEmail[] = []
  let nextUrl: string | null = `${GRAPH_BASE}${basePath}?${params}`

  // Pagination automatique via @odata.nextLink
  while (nextUrl && allEmails.length < maxTotal) {
    const token = await getAccessToken()
    const res = await fetch(nextUrl, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Graph API error ${res.status}: ${err}`)
    }
    const data: { value: GraphEmail[]; '@odata.nextLink'?: string } = await res.json()
    allEmails.push(...data.value)
    nextUrl = data['@odata.nextLink'] ?? null
  }

  return allEmails.slice(0, maxTotal)
}

// ─── Répondre à un mail ───────────────────────────────────────────────────────

export async function replyToEmail(messageId: string, replyBody: string): Promise<void> {
  const token = await getAccessToken()
  const res = await fetch(
    `${GRAPH_BASE}/users/${SHARED_MAILBOX}/messages/${messageId}/reply`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          body: {
            contentType: 'html',
            content: replyBody,
          },
        },
        comment: '',
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Erreur envoi réponse: ${res.status} — ${err}`)
  }
}

// ─── Envoyer un nouveau mail ───────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  options?: {
    fromName?: string
    replyTo?: string
    headers?: Array<{ name: string; value: string }>
  }
): Promise<void> {
  const token = await getAccessToken()
  const fromName = options?.fromName ?? "SensethO"
  const res = await fetch(
    `${GRAPH_BASE}/users/${SHARED_MAILBOX}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'html', content: body },
          from: { emailAddress: { name: fromName, address: SHARED_MAILBOX } },
          toRecipients: [{ emailAddress: { address: to } }],
          ...(options?.replyTo ? {
            replyTo: [{ emailAddress: { address: options.replyTo } }],
          } : {}),
          ...(options?.headers?.length ? {
            internetMessageHeaders: options.headers,
          } : {}),
        },
        saveToSentItems: true,
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Erreur envoi mail: ${res.status} — ${err}`)
  }
}

// ─── Mapper Graph → format BDD ────────────────────────────────────────────────

export interface EmailRecord {
  ms_id: string
  conversation_id: string | null
  subject: string | null
  body_preview: string
  body_html: string | null
  from_email: string | null
  from_name: string | null
  to_recipients: { name: string; address: string }[]
  cc_recipients: { name: string; address: string }[]
  received_at: string
  is_read: boolean
  has_attachments: boolean
  folder_id: string | null
  importance: string
  categories: string[]
}

export function mapEmailToRecord(email: GraphEmail): EmailRecord {
  return {
    ms_id: email.id,
    conversation_id: email.conversationId ?? null,
    subject: email.subject ?? null,
    body_preview: email.bodyPreview,
    body_html: email.body?.contentType === 'html' ? email.body.content : null,
    from_email: email.from?.emailAddress?.address ?? null,
    from_name: email.from?.emailAddress?.name ?? null,
    to_recipients: email.toRecipients.map(r => r.emailAddress),
    cc_recipients: email.ccRecipients.map(r => r.emailAddress),
    received_at: email.receivedDateTime,
    is_read: email.isRead,
    has_attachments: email.hasAttachments,
    folder_id: email.parentFolderId ?? null,
    importance: email.importance,
    categories: email.categories ?? [],
  }
}
