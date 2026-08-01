// Extraction de l'annuaire Microsoft Entra d'origine d'une session SSO.
//
// Supabase ne remonte pas le claim `tid` à un endroit unique et garanti selon
// les versions : on essaie donc plusieurs sources, de la plus explicite à la
// plus indirecte. Aucune n'est falsifiable par l'utilisateur — toutes viennent
// d'un jeton déjà validé par Supabase auprès de Microsoft.

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

interface SessionUser {
  user_metadata?: Record<string, unknown> | null
  identities?: Array<{ provider: string; identity_data?: Record<string, unknown> | null }> | null
}

/** Charge utile d'un JWT, sans vérification de signature (usage : lecture d'un claim). */
function chargeUtile(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function premierGuid(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null
  const m = valeur.match(GUID)
  return m ? m[0].toLowerCase() : null
}

/**
 * Identifiant d'annuaire Entra de la session, ou null s'il reste indéterminable.
 * `providerToken` est le jeton d'accès Microsoft renvoyé par Supabase : c'est un
 * JWT qui porte `tid`, utilisé en dernier recours.
 */
export function tenantDeLaSession(user: SessionUser, providerToken?: string | null): string | null {
  const meta = user.user_metadata ?? {}

  // 1. Claim explicite, quand Supabase le recopie tel quel.
  const claims = (meta.custom_claims ?? {}) as Record<string, unknown>
  const direct = premierGuid(claims.tid) ?? premierGuid(meta.tid)
  if (direct) return direct

  // 2. Émetteur du jeton d'identité : https://login.microsoftonline.com/<tid>/v2.0
  const parIssuer = premierGuid(meta.iss)
  if (parIssuer) return parIssuer

  // 3. Données d'identité du fournisseur azure.
  const azure = (user.identities ?? []).find(i => i.provider === 'azure')
  const donnees = azure?.identity_data ?? {}
  const parIdentite = premierGuid(donnees.tid) ?? premierGuid(donnees.iss)
  if (parIdentite) return parIdentite

  // 4. Jeton d'accès Microsoft.
  if (providerToken) {
    const p = chargeUtile(providerToken)
    if (p) return premierGuid(p.tid) ?? premierGuid(p.iss)
  }

  return null
}
