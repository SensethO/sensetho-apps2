import { CatalogueClient } from '@/components/catalogue/CatalogueClient'

export const metadata = {
  title: "Catalogue des applications — Sens'ethO Apps",
  description: "Le catalogue Sens'ethO Apps : se voir agir, dialoguer, mesurer et prouver — Le Miroir, diagnostics ISO 26000, CSRD/ESRS, VSME, parties prenantes, applications business et métier.",
}

export default function CataloguePage() {
  return <CatalogueClient />
}
