// Vendorisé depuis @sensetho/catalogue-app v0.5.10 (src/budget) — adapté plateforme sensetho-apps2.
// Ne pas éditer sans reporter au Catalogue-App.
import { piecesGET, piecesPOST } from '@/lib/budget-association/handlers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const GET = piecesGET
export const POST = piecesPOST
