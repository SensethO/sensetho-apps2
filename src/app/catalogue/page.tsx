import { CatalogueClient } from '@/components/catalogue/CatalogueClient'

export const metadata = {
  title: "Catalogue des applications — Sens'ethO Apps",
  description: "Découvrez les applications RSE, Business et Métier de Sens'ethO Apps : ISO 26000, CSRD, VSME, Parties Prenantes, Gestion des organisations.",
}

export default function CataloguePage() {
  return <CatalogueClient />
}
