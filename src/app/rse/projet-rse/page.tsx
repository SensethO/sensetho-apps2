import { redirect } from 'next/navigation'

// L'app Projet RSE a été transférée en catégorie Business (2026-08-07).
export default function AncienneRouteProjetRse() {
  redirect('/business/projet-rse')
}
