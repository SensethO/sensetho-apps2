export const metadata = { title: "Politique de confidentialité — Sens'ethO Apps" }

const SITE = {
  brand_name:    "Sens'ethO Apps",
  company_name:  'SCDB PRO SARL',
  contact_email: 'sylvain.cassaro@sensetho.com',
  dpo_email:     'sylvain.cassaro@sensetho.com',
  website_url:   'https://apps.sensetho.com',
}

export default function PolitiqueConfidentialitePage() {
  const today = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
        Politique de confidentialité
      </h1>
      <p className="text-sm text-gray-400 mb-10">
        Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés
      </p>

      <div className="space-y-10 text-sm text-gray-700 dark:text-gray-300">

        {/* 1 — Responsable */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">1. Responsable du traitement</h2>
          <p>
            Le responsable du traitement des données personnelles collectées via la plateforme{' '}
            {SITE.brand_name} est :
          </p>
          <div className="mt-3 pl-4 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-1">
            <p><strong>{SITE.company_name}</strong></p>
            <p>Email DPO : <a href={`mailto:${SITE.dpo_email}`} className="text-indigo-600 hover:underline">{SITE.dpo_email}</a></p>
            <p>Site web : <a href={SITE.website_url} className="text-indigo-600 hover:underline">{SITE.website_url}</a></p>
          </div>
        </section>

        {/* 2 — Données collectées */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">2. Données collectées</h2>
          <p>Nous collectons les données suivantes selon votre utilisation de la plateforme :</p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold">Catégorie</th>
                  <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold">Données</th>
                  <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold">Finalité</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 font-medium">Identité</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Nom, prénom, email</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Création de compte, authentification</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 font-medium">Organisation</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Nom société, secteur, taille</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Personnalisation, diagnostics RSE</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 font-medium">Usage</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Logs de connexion, actions applicatives</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Sécurité, amélioration du service</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 font-medium">Diagnostics</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Données RSE, financières, sociales saisies</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Fourniture du service applicatif</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 font-medium">Facturation</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Email, société, devis</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Gestion des abonnements et licences</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 3 — Base légale */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">3. Base légale des traitements</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Exécution contractuelle</strong> — traitement des données nécessaires à la fourniture des applications et à la gestion des abonnements.
            </li>
            <li>
              <strong>Intérêt légitime</strong> — sécurité de la plateforme, prévention des fraudes, amélioration continue du service.
            </li>
            <li>
              <strong>Obligation légale</strong> — conservation des données de facturation conformément aux obligations comptables et fiscales françaises.
            </li>
            <li>
              <strong>Consentement</strong> — communications marketing (si applicable) et cookies non essentiels.
            </li>
          </ul>
        </section>

        {/* 4 — Durée de conservation */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">4. Durée de conservation</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold">Type de données</th>
                  <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold">Durée</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Données de compte actif</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Durée de la relation contractuelle</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Données après résiliation / suppression de compte</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">30 jours, puis suppression</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Données de facturation</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">10 ans (obligation légale)</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Logs de connexion et sécurité</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">12 mois</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 5 — Destinataires */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">5. Destinataires et sous-traitants</h2>
          <p>
            Vos données peuvent être transmises aux sous-traitants techniques suivants, dans le respect du RGPD :
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-800/40">
              <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">🗄️ Supabase</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Base de données PostgreSQL — authentification, données utilisateurs et diagnostics. Serveurs en Europe (AWS eu-west-3).</p>
            </div>
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-800/40">
              <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">▲ Vercel</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Hébergement de l&apos;application Next.js. 340 Pine Street, San Francisco, CA, USA. Données servies via CDN global.</p>
            </div>
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-800/40">
              <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">☁️ Microsoft Azure / SharePoint</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Stockage des documents et rapports exportés. Centres de données en Europe occidentale.</p>
            </div>
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-800/40">
              <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">📧 Microsoft Graph (emails)</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Envoi de notifications email transactionnelles (confirmations, alertes administrateur).</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Aucune donnée n&apos;est vendue à des tiers. Les transferts hors UE (Vercel) s&apos;effectuent
            sous garanties appropriées (clauses contractuelles types de la Commission européenne).
          </p>
        </section>

        {/* 6 — Droits */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">6. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '👁️', title: 'Droit d\'accès', desc: 'Obtenir une copie des données vous concernant.' },
              { icon: '✏️', title: 'Droit de rectification', desc: 'Corriger des données inexactes ou incomplètes.' },
              { icon: '🗑️', title: 'Droit à l\'effacement', desc: 'Demander la suppression de vos données (« droit à l\'oubli »).' },
              { icon: '⏸️', title: 'Droit à la limitation', desc: 'Limiter le traitement de vos données dans certains cas.' },
              { icon: '📦', title: 'Droit à la portabilité', desc: 'Recevoir vos données dans un format structuré et lisible.' },
              { icon: '🚫', title: 'Droit d\'opposition', desc: 'Vous opposer au traitement fondé sur l\'intérêt légitime.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-900">
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-xs mb-0.5">{title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4">
            Pour exercer vos droits, contactez notre DPO à :{' '}
            <a href={`mailto:${SITE.dpo_email}`} className="text-indigo-600 hover:underline">{SITE.dpo_email}</a>.
            Nous nous engageons à répondre dans un délai d&apos;un mois.
          </p>
          <p className="mt-2">
            En cas de réclamation non résolue, vous pouvez saisir la{' '}
            <a href="https://www.cnil.fr" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">CNIL</a>{' '}
            (Commission Nationale de l&apos;Informatique et des Libertés).
          </p>
        </section>

        {/* 7 — Cookies */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">7. Cookies et traceurs</h2>
          <p>
            La plateforme {SITE.brand_name} utilise des cookies strictement nécessaires au fonctionnement
            du service (authentification, préférences de thème). Aucun cookie publicitaire ou de tracking
            tiers n&apos;est utilisé sans votre consentement.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold">Cookie</th>
                  <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold">Finalité</th>
                  <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold">Durée</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 font-mono text-xs">sb-*</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Session Supabase (authentification)</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Session / 1 semaine</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 font-mono text-xs">theme</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Préférence de thème (clair/sombre)</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">1 an</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 8 — Sécurité */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">8. Sécurité des données</h2>
          <p>
            {SITE.company_name} met en œuvre des mesures techniques et organisationnelles appropriées
            pour protéger vos données contre tout accès non autorisé, perte, destruction ou altération :
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Chiffrement des données en transit (HTTPS/TLS).</li>
            <li>Chiffrement des données au repos (base de données Supabase).</li>
            <li>Contrôle d&apos;accès par rôles (RLS — Row Level Security).</li>
            <li>Authentification sécurisée via Supabase Auth (JWT).</li>
            <li>Journalisation des accès et des actions sensibles.</li>
          </ul>
          <p className="mt-3">
            En cas de violation de données susceptible d&apos;engendrer un risque pour vos droits,
            nous vous en informerons dans les meilleurs délais conformément au RGPD (art. 33-34).
          </p>
        </section>

        {/* 9 — Modifications */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">9. Modifications de la politique</h2>
          <p>
            {SITE.company_name} se réserve le droit de modifier la présente politique à tout moment
            pour la tenir à jour avec les évolutions légales et techniques.
            Les utilisateurs seront informés par email en cas de modification substantielle.
          </p>
          <p className="mt-2">
            La version en vigueur est toujours accessible à l&apos;adresse{' '}
            <a href={`${SITE.website_url}/politique-de-confidentialite`} className="text-indigo-600 hover:underline">
              {SITE.website_url}/politique-de-confidentialite
            </a>.
          </p>
        </section>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-1">
          <p className="text-xs text-gray-400">Dernière mise à jour : {today}</p>
          <p className="text-xs text-gray-400">
            Contact DPO :{' '}
            <a href={`mailto:${SITE.dpo_email}`} className="text-indigo-500 hover:underline">{SITE.dpo_email}</a>
          </p>
        </div>
      </div>
    </div>
  )
}
