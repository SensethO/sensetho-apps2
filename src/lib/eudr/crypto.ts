import crypto from 'node:crypto'

/**
 * Chiffrement au repos des secrets EUDR TRACES (clé Web Service).
 * AES-256-GCM ; clé de 32 octets dérivée de EUDR_CRED_SECRET via scrypt.
 * Format stocké : base64( iv[12] || authTag[16] || ciphertext ).
 */

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const secret = process.env.EUDR_CRED_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('EUDR_CRED_SECRET manquant ou trop court (>= 16 caractères requis) dans les variables d\'environnement.')
  }
  // Sel fixe : la dérivation doit être déterministe pour déchiffrer d'un déploiement à l'autre.
  cachedKey = crypto.scryptSync(secret, 'eudr-traces-cred-v1', 32)
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
