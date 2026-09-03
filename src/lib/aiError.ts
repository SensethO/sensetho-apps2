/**
 * Traduit une erreur d'appel au modèle (Anthropic SDK) en message utilisateur propre,
 * sans exposer le JSON brut de l'API (ex. « 401 authentication_error … »).
 */
export function aiErrorResponse(err: unknown): { message: string; status: number } {
  const e = err as { status?: number; message?: string; error?: { error?: { message?: string; type?: string } } }
  const status = typeof e?.status === 'number' ? e.status : 0
  const raw = (e?.error?.error?.message || e?.message || '').toLowerCase()

  if (status === 401 || raw.includes('api key') || raw.includes('authentication')) {
    return { message: "Analyse IA indisponible : la clé API Anthropic est invalide ou expirée. À vérifier côté administrateur (variable ANTHROPIC_API_KEY).", status: 503 }
  }
  if (raw.includes('credit') || raw.includes('billing') || raw.includes('quota') || raw.includes('insufficient')) {
    return { message: "Analyse IA indisponible : crédit Anthropic insuffisant. À vérifier côté administrateur.", status: 503 }
  }
  if (status === 429 || raw.includes('rate limit') || raw.includes('overloaded')) {
    return { message: "Analyse IA momentanément saturée (trop de requêtes). Réessayez dans un instant.", status: 503 }
  }
  return { message: "Analyse IA indisponible pour le moment. Réessayez plus tard.", status: 502 }
}
