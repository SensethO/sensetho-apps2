// Dérivé du module budget-association — variante ENTREPRISE (plan comptable général).
// Ne pas éditer sans reporter au module source.
import { exerciceGET, exercicePATCH, exerciceDELETE } from '@/lib/budget-entreprise/handlers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const GET = exerciceGET
export const PATCH = exercicePATCH
export const DELETE = exerciceDELETE
