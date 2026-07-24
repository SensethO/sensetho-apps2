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
  hero_badge:       "Éthologie d'entreprise — se voir agir, retrouver du sens",
  hero_title_1:     'Et si votre entreprise était un être vivant ?',
  hero_title_2:     'Regardez-la agir. Aidez-la à retrouver du sens.',
  hero_subtitle:    "Une démarche ne commence pas par un référentiel : elle commence par un regard. Observez ce que votre organisation fait vraiment, formulez sa raison d'être, choisissez vos engagements — puis outillez-les, au moment où il le faut.",
  hero_cta_note:    'Accès sur invitation — géré par votre administrateur',
  // La démarche (4 cartes de la section teal, dans l'ordre du parcours)
  feature_1_title:  '1 · Se voir agir',
  feature_1_desc:   "Observer le comportement réel de votre organisation — ce qu'elle fait, pas seulement ce qu'elle déclare.",
  feature_2_title:  '2 · Retrouver le sens',
  feature_2_desc:   "Formuler une raison d'être qui relie ce que vous êtes, ce que vous dites et ce que vous faites.",
  feature_3_title:  "3 · S'engager",
  feature_3_desc:   "Choisir des engagements qui viennent de vous — pas d'une obligation, ni d'une mode.",
  feature_4_title:  '4 · Outiller & prouver',
  feature_4_desc:   'Alors seulement, les outils : diagnostics, dialogue, mesure et preuves au service de vos engagements.',
  // Section apps
  apps_section_title:    'Les instruments de votre engagement',
  apps_section_subtitle: "Chaque application sert une étape de la démarche — jamais l'inverse. Observation, dialogue, mesure et preuve : par abonnement, avec gestion des droits par organisation.",
  // Bloc « Notre propre miroir » (engagement Sens'ethO)
  rse_badge:   '🪞 Notre propre miroir',
  rse_title:   'Nous nous appliquons ce que nous proposons',
  rse_desc:    "« Aider les organisations à se voir agir et à retrouver du sens » — c'est notre raison d'être, et elle nous engage : gouvernance partagée, lucrativité encadrée, et 30 % des bénéfices consacrés à l'équité des chances, pour les enfants et adolescents de l'ASE et ceux vivant sous le seuil de pauvreté.",
  rse_check_1: "Une raison d'être formulée et assumée",
  rse_check_2: 'Des engagements choisis, pas subis',
  rse_check_3: "30 % des bénéfices pour l'équité des chances",
  rse_check_4: 'Une exécution vérifiable, dans la durée',
  // CTA
  cta_title:    'Prêt à tendre le miroir à votre organisation ?',
  cta_subtitle: "Commencez par le regard. Les outils viendront ensuite — au service des engagements que vous aurez choisis.",
  // Footer
  footer_tagline: "Des applications au service du sens : se voir agir, formuler sa raison d'être, tenir ses engagements.",
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
