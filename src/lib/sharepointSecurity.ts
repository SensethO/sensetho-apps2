/**
 * Sécurité SharePoint — ID validation + config verrouillée
 *
 * Seul le drive configuré dans SHAREPOINT_DRIVE_ID est accessible.
 * Tout itemId reçu du navigateur passe par assertSafeId() avant usage.
 */

// ─── Pattern d'ID Graph autorisé ─────────────────────────────────────────────
// Couvre les formats connus :
//   • item IDs classiques  : 015O3EXMN6Y2GOVW7725BZO354PWSELRRZ
//   • item IDs base64-like : b!uTF1ESI1jUe5XH_Lsrlhfp...
//   • base64 standard avec padding : ...==
//   • mot-clé spécial      : root
// Rejetés : /, .., espaces, caractères de contrôle, quotes, <>, {}
const SAFE_ID_RE = /^[A-Za-z0-9!$%=+_\-.~]{1,512}$/

/**
 * Valide un ID Graph reçu du navigateur.
 * Lève une erreur 400 si l'ID est absent ou contient des caractères dangereux.
 */
export function assertSafeId(id: string | null | undefined, label = 'id'): string {
  if (!id || id.trim() === '') {
    throw new SafeIdError(`${label} manquant`)
  }
  const cleaned = id.trim()
  // "root" est le seul mot-clé Graph autorisé
  if (cleaned === 'root') return cleaned
  if (!SAFE_ID_RE.test(cleaned)) {
    throw new SafeIdError(
      `${label} invalide — seuls les caractères alphanumériques et !$%_-.~ sont autorisés`
    )
  }
  return cleaned
}

export class SafeIdError extends Error {
  readonly status = 400
  constructor(msg: string) {
    super(msg)
    this.name = 'SafeIdError'
  }
}

// ─── Drive verrouillé ────────────────────────────────────────────────────────

/**
 * Retourne l'ID du drive configuré côté serveur.
 * Ne provient JAMAIS du navigateur.
 */
export function getLockedDriveId(): string {
  const driveId = (process.env.SHAREPOINT_DRIVE_ID || '').trim()
  if (!driveId) {
    throw new Error('SHAREPOINT_DRIVE_ID non configuré dans Vercel → Environment Variables.')
  }
  return driveId
}

/**
 * Retourne l'ID et le nom du dossier racine accessible.
 * Si SHAREPOINT_BASE_FOLDER_ID est défini, c'est le seul point d'entrée autorisé.
 * Si absent, l'accès démarre à la racine du drive (root).
 */
export function getBaseFolderConfig(): { id: string; name: string } {
  const id   = (process.env.SHAREPOINT_BASE_FOLDER_ID   || '').trim()
  const name = (process.env.SHAREPOINT_BASE_FOLDER_NAME || 'Documents partagés').trim()
  return { id: id || 'root', name }
}

/**
 * Retourne l'ID du dossier de base (SHAREPOINT_BASE_FOLDER_ID).
 * Utilisé pour créer les dossiers clients dans le bon conteneur.
 */
export function getBaseFolderId(): string {
  return (process.env.SHAREPOINT_BASE_FOLDER_ID || '').trim() || 'root'
}

/**
 * Helper : formate la réponse d'erreur JSON pour les routes API.
 */
export function errorResponse(err: unknown) {
  if (err instanceof SafeIdError) {
    return { status: 400, body: { error: err.message } }
  }
  return { status: 500, body: { error: err instanceof Error ? err.message : String(err) } }
}
