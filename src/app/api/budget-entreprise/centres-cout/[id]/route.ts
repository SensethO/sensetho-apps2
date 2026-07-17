// Dérivé du module budget-association — variante ENTREPRISE (plan comptable général).
// Ne pas éditer sans reporter au module source.
import { centreCoutPATCH, centreCoutDELETE } from '@/lib/budget-entreprise/handlers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const PATCH = centreCoutPATCH
export const DELETE = centreCoutDELETE
