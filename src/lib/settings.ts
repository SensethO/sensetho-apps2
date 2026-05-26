import { createAdminClient } from '@/lib/supabase/admin'

// ── Defaults ─────────────────────────────────────────────────────────────────

export const SETTINGS_DEFAULTS: Record<string, string> = {
  // Identité
  brand_name:       "Sens'ethO Apps",
  company_name:     'SCDB PRO SARL',
  // Contact
  contact_email:    'sylvain.cassaro@sensetho.com',
  support_email:    'sylvain.cassaro@sensetho.com',
  dpo_email:        'sylvain.cassaro@sensetho.com',
  website_url:      'https://apps.sensetho.com',
  // Légal (vides = à compléter)
  company_address:  '',
  company_capital:  '',
  company_rcs:      '',
  company_siret:    '',
  company_tva:      '',
  // Hero
  hero_badge:       'La plateforme RSE des professionnels et cabinets de conseil',
  hero_title_1:     'La plateforme RSE',
  hero_title_2:     'des experts et organisations responsables',
  hero_subtitle:    "ISO 26000, CSRD/ESRS, VSME, Parties Prenantes — nos outils couvrent l'ensemble des référentiels RSE internationaux, sans complexité ni frais d'infrastructure.",
  hero_cta_note:    'Accès sur invitation — géré par votre administrateur',
  // Avantages (correspond aux 4 cartes actuelles de la homepage)
  feature_1_title:  'Données souveraines',
  feature_1_desc:   "Hébergées en Europe sur des serveurs à énergie renouvelable. Vos données RSE ne quittent pas l'UE.",
  feature_2_title:  'Standards de référence',
  feature_2_desc:   "ISO 26000, CSRD/ESRS, VSME EFRAG, GRI… Les normes internationales intégrées nativement dans chaque outil.",
  feature_3_title:  'Multi-organisations',
  feature_3_desc:   "Gérez plusieurs structures depuis un seul compte. Idéal pour les cabinets de conseil RSE et les groupes.",
  feature_4_title:  'Export & Partage',
  feature_4_desc:   "Exportez vos diagnostics en PDF et Excel. Partagez vers SharePoint en un clic depuis chaque application.",
  // Section apps
  apps_section_title:    'Vos outils RSE en un seul endroit',
  apps_section_subtitle: 'RSE, Business, Métier — chaque application est disponible depuis votre tableau de bord, par abonnement et avec gestion des droits par organisation.',
  // RSE highlight
  rse_badge:   '🌿 Suite RSE complète',
  rse_title:   'Pilotez votre démarche RSE avec la norme ISO 26000',
  rse_desc:    "Évaluez votre maturité sur les 13 domaines RSE prioritaires, suivez votre couverture des 17 Objectifs de Développement Durable, et générez un plan d'actions concret pour votre organisation.",
  rse_check_1: 'Diagnostic guidé en 30–50 minutes',
  rse_check_2: 'Cartographie des 17 ODD des Nations Unies',
  rse_check_3: 'Recommandations personnalisées par domaine',
  rse_check_4: 'Rapport exportable PDF et Excel',
  // CTA
  cta_title:    'Prêt à structurer votre démarche RSE ?',
  cta_subtitle: "Rejoignez les professionnels RSE et cabinets de conseil qui utilisent nos outils pour piloter leur démarche et produire des rapports conformes aux standards internationaux.",
  // Footer
  footer_tagline: "Plateforme d'outils RSE professionnels. ISO 26000, CSRD, VSME, Parties Prenantes & Matérialité.",
}

// ── Fetch settings (server-side only) ────────────────────────────────────────

export async function getSiteSettings(): Promise<Record<string, string>> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('site_settings').select('key, value')
    if (!data) return { ...SETTINGS_DEFAULTS }
    const fromDb: Record<string, string> = {}
    for (const row of data) fromDb[row.key] = row.value ?? ''
    return { ...SETTINGS_DEFAULTS, ...fromDb }
  } catch {
    return { ...SETTINGS_DEFAULTS }
  }
}
