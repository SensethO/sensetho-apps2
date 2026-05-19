import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * DÉSACTIVÉE — règle universelle : aucun transit de fichier par Vercel.
 *
 * Utiliser à la place le flux en deux étapes :
 *   1. POST /notes/upload-session  → obtenir l'URL d'upload SharePoint directe
 *   2. PUT direct du navigateur vers SharePoint (0 octets transitent par Vercel)
 *   3. POST /notes/upload-confirm  → enregistrer en DB
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Cette route est désactivée. Utiliser /notes/upload-session puis /notes/upload-confirm pour un upload sans transit Vercel.',
    },
    { status: 410 },
  )
}
