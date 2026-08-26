import crypto from 'node:crypto'

/**
 * Chiffrement au repos de la clé API Sindup (préparation du connecteur API —
 * le client sera branché quand la doc Sindup sera disponible).
 * AES-256-GCM ; clé de 32 octets dérivée de SINDUP_CRED_SECRET via scrypt.
 * Format stocké : base64( iv[12] || authTag[16] || ciphertext ).
 *
 * Repli : si SINDUP_CRED_SECRET est absente, on utilise EUDR_CRED_SECRET
 * (déjà présente en production pour l'intégration EUDR/TRACES). Une clé dédiée
 * SINDUP_CRED_SECRET pourra être ajoutée plus tard sans casser le déchiffrement
 * TANT QUE rien n'a encore été chiffré avec le repli (sinon re-chiffrer).
 */

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const secret = process.env.SINDUP_CRED_SECRET || process.env.EUDR_CRED_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('SINDUP_CRED_SECRET (ou EUDR_CRED_SECRET en repli) manquant ou trop court (>= 16 caractères requis) dans les variables d’environnement.')
  }
  // Sel fixe : la dérivation doit être déterministe pour déchiffrer d'un déploiement à l'autre.
  cachedKey = crypto.scryptSync(secret, 'sindup-cred-v1', 32)
  return cachedKey
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const enc = raw.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
