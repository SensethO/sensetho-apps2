// Vendorisé depuis @sensetho/catalogue-app v0.5.10 (src/budget) — adapté plateforme sensetho-apps2.
// Ne pas éditer sans reporter au Catalogue-App.
import { lignesPOST, lignesPATCH, lignesDELETE } from '@/lib/budget-association/handlers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const POST = lignesPOST
export const PATCH = lignesPATCH
export const DELETE = lignesDELETE
