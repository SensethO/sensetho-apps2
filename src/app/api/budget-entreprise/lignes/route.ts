// Dérivé du module budget-association — variante ENTREPRISE (plan comptable général).
// Ne pas éditer sans reporter au module source.
import { lignesPOST, lignesPATCH, lignesDELETE } from '@/lib/budget-entreprise/handlers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const POST = lignesPOST
export const PATCH = lignesPATCH
export const DELETE = lignesDELETE
