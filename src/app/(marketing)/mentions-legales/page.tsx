export const metadata = { title: "Mentions légales — Sens'ethO Apps" }

const SITE = {
  brand_name:    "Sens'ethO Apps",
  company_name:  'SCDB PRO SARL',
  contact_email: 'sylvain.cassaro@sensetho.com',
  website_url:   'https://apps.sensetho.com',
  company_address:      '[Adresse du siège social à compléter]',
  company_capital:      '[Capital social à compléter]',
  company_rcs:          '[Numéro RCS à compléter]',
  company_siret:        '[Numéro SIRET à compléter]',
  company_tva:          '[Numéro TVA à compléter]',
  legal_representative: '[Représentant légal à compléter]',
}

export default function MentionsLegalesPage() {
  const today = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Mentions légales</h1>
      <p className="text-sm text-gray-400 mb-10">
        Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN)
      </p>

      <div className="space-y-10 text-sm text-gray-700 dark:text-gray-300">

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">1. Éditeur du site</h2>
          <div className="space-y-1">
            <p><strong>Raison sociale :</strong> {SITE.company_name}</p>
            <p><strong>Forme juridique :</strong> Société à Responsabilité Limitée (SARL)</p>
            <p><strong>Capital social :</strong> {SITE.company_capital}</p>
            <p><strong>Siège social :</strong> {SITE.company_address}</p>
            <p><strong>RCS :</strong> {SITE.company_rcs}</p>
            <p><strong>SIRET :</strong> {SITE.company_siret}</p>
            <p><strong>Numéro de TVA intracommunautaire :</strong> {SITE.company_tva}</p>
            <p><strong>Email :</strong>{' '}
              <a href={`mailto:${SITE.contact_email}`} className="text-indigo-600 hover:underline">{SITE.contact_email}</a>
            </p>
            <p><strong>Site web :</strong>{' '}
              <a href={SITE.website_url} className="text-indigo-600 hover:underline">{SITE.website_url}</a>
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">2. Directeur de la publication</h2>
          <p>Le directeur de la publication est le représentant légal de {SITE.company_name}.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">3. Hébergement</h2>
          <div className="space-y-1">
            <p><strong>Hébergeur :</strong> Vercel Inc.</p>
            <p><strong>Adresse :</strong> 340 Pine Street, Suite 603, San Francisco, CA 94104, États-Unis</p>
            <p><strong>Site web :</strong>{' '}
              <a href="https://vercel.com" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">https://vercel.com</a>
            </p>
          </div>
          <p className="mt-3">
            Les données utilisateurs (comptes, diagnostics RSE, organisations) sont stockées sur l&apos;infrastructure
            Supabase (base de données PostgreSQL) et Microsoft Azure SharePoint (documents),
            tous deux disposant de centres de données en Europe.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">4. Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble des contenus présents sur le site <strong>{SITE.website_url}</strong> (textes, images, logos,
            interfaces, code source, marques) sont la propriété exclusive de {SITE.company_name} ou de ses partenaires,
            et sont protégés par les lois françaises et internationales relatives à la propriété intellectuelle.
          </p>
          <p className="mt-2">
            Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des
            éléments du site est interdite sauf autorisation écrite préalable de {SITE.company_name}.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">5. Responsabilité</h2>
          <p>
            {SITE.company_name} s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées
            sur ce site, dont elle se réserve le droit de corriger le contenu à tout moment et sans préavis.
          </p>
          <p className="mt-2">
            Les diagnostics et analyses fournis par les applications {SITE.brand_name} sont donnés à titre indicatif.
            Ils ne sauraient constituer un conseil financier, juridique, fiscal ou RSE certifié.
            L&apos;utilisateur est seul responsable de l&apos;usage qu&apos;il fait des résultats obtenus.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">6. Données personnelles</h2>
          <p>
            Les informations relatives au traitement des données personnelles sont détaillées dans notre{' '}
            <a href="/politique-de-confidentialite" className="text-indigo-600 hover:underline">
              Politique de confidentialité
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">7. Droit applicable et juridiction compétente</h2>
          <p>
            Tout litige en relation avec l&apos;utilisation du site <strong>{SITE.website_url}</strong> est soumis
            au droit français. En dehors des cas où la loi ne le permet pas, il est fait attribution exclusive
            de juridiction aux tribunaux compétents du ressort du siège social de {SITE.company_name}.
          </p>
        </section>

        <p className="text-xs text-gray-400 mt-8">Dernière mise à jour : {today}</p>
      </div>
    </div>
  )
}
