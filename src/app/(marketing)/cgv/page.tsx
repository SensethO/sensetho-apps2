export const metadata = { title: "Conditions Générales de Vente — Sens'ethO Apps" }

const SITE = {
  brand_name:    "Sens'ethO Apps",
  company_name:  'SCDB PRO SARL',
  contact_email: 'sylvain.cassaro@sensetho.com',
  support_email: 'sylvain.cassaro@sensetho.com',
  website_url:   'https://apps.sensetho.com',
  company_address: '[Adresse du siège social à compléter]',
  company_rcs:     '[Numéro RCS à compléter]',
}

export default function CGVPage() {
  const today = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Conditions Générales de Vente</h1>
      <p className="text-sm text-gray-400 mb-10">
        En vigueur à compter du 1<sup>er</sup> janvier 2025 — Applicables aux abonnements et licences souscrits via {SITE.website_url}
      </p>

      <div className="space-y-10 text-sm text-gray-700 dark:text-gray-300">

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 1 — Parties</h2>
          <p>Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent les relations contractuelles entre :</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>
              <strong>Le Prestataire :</strong> {SITE.company_name},
              RCS {SITE.company_rcs},
              ci-après dénommée « {SITE.brand_name} » ou « le Prestataire ».
            </li>
            <li>
              <strong>Le Client :</strong> toute personne physique ou morale procédant à la demande d&apos;un accès
              ou d&apos;un abonnement sur la plateforme {SITE.website_url}, ci-après dénommée « le Client ».
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 2 — Objet</h2>
          <p>
            Les présentes CGV définissent les conditions dans lesquelles {SITE.company_name} fournit
            au Client l&apos;accès aux applications RSE et métier de la plateforme {SITE.brand_name},
            sous forme de licences d&apos;utilisation à durée déterminée (mensuelle, annuelle) ou indéterminée (perpétuelle),
            activées manuellement par l&apos;administrateur.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 3 — Acceptation des CGV</h2>
          <p>
            Toute demande d&apos;accès à une application payante emporte acceptation pleine et entière des
            présentes CGV. Le Client déclare en avoir pris connaissance avant de finaliser sa demande.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 4 — Description des licences</h2>
          <p>Trois types de licences sont proposés :</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold">Type</th>
                  <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold">Durée</th>
                  <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold">Renouvellement</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Mensuelle</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">1 mois à compter de l&apos;activation</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Non automatique — nouvelle demande requise</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Annuelle</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">12 mois à compter de l&apos;activation</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Non automatique — nouvelle demande requise</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Perpétuelle</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Sans limite de durée</td>
                  <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">Sans objet</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            L&apos;accès à l&apos;application est effectif dès validation de l&apos;abonnement par l&apos;équipe {SITE.brand_name}.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 5 — Prix et modalités de paiement</h2>
          <p>
            Les prix des licences sont indiqués en euros (€) toutes taxes comprises (TTC) sur la plateforme
            {SITE.website_url}. {SITE.company_name} se réserve le droit de modifier ses tarifs à tout moment ;
            les nouveaux tarifs s&apos;appliquent aux licences créées après la date de modification.
          </p>
          <p className="mt-2">
            Le règlement est exigé avant ou lors de l&apos;activation de la licence, selon les modalités convenues
            lors de la demande de devis ou d&apos;accès.
          </p>
          <p className="mt-2">
            Des tarifs sur mesure peuvent être proposés pour les organisations multi-utilisateurs.
            Contactez-nous à{' '}
            <a href={`mailto:${SITE.contact_email}`} className="text-indigo-600 hover:underline">{SITE.contact_email}</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 6 — Droit de rétractation</h2>
          <p>
            Conformément à l&apos;article L. 221-28 du Code de la consommation, le droit de rétractation{' '}
            <strong>ne s&apos;applique pas</strong> aux contenus numériques fournis sur un support immatériel
            dont l&apos;exécution a commencé avec l&apos;accord préalable du consommateur et renoncement exprès à
            son droit de rétractation.
          </p>
          <p className="mt-2">Pour les Clients professionnels (B2B), le droit de rétractation ne s&apos;applique pas.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 7 — Obligations du Prestataire</h2>
          <p>{SITE.company_name} s&apos;engage à :</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Fournir l&apos;accès à l&apos;application pendant toute la durée de la licence.</li>
            <li>Assurer la disponibilité de la plateforme avec un niveau de service raisonnable.</li>
            <li>Traiter les données du Client conformément au RGPD et à la politique de confidentialité.</li>
            <li>Informer le Client de toute modification substantielle des fonctionnalités.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 8 — Obligations du Client</h2>
          <p>Le Client s&apos;engage à :</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Utiliser la plateforme dans le respect des présentes CGV et des CGU.</li>
            <li>Ne pas céder, transférer ou partager son accès à des tiers non autorisés.</li>
            <li>Ne pas tenter de contourner les mécanismes de contrôle d&apos;accès.</li>
            <li>Signaler toute faille de sécurité à <a href={`mailto:${SITE.support_email}`} className="text-indigo-600 hover:underline">{SITE.support_email}</a>.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 9 — Résiliation</h2>
          <p>
            <strong>Par le Client :</strong> Le Client peut demander la résiliation anticipée par email à{' '}
            <a href={`mailto:${SITE.contact_email}`} className="text-indigo-600 hover:underline">{SITE.contact_email}</a>.
            Aucun remboursement pro rata temporis n&apos;est accordé sauf accord exprès du Prestataire.
          </p>
          <p className="mt-2">
            <strong>Par le Prestataire :</strong> En cas de manquement grave du Client,
            {SITE.company_name} se réserve le droit de suspendre ou résilier l&apos;accès sans préavis ni remboursement.
          </p>
          <p className="mt-2">
            Les données saisies par le Client sont conservées 30 jours après expiration/résiliation avant suppression.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 10 — Propriété intellectuelle</h2>
          <p>
            La licence accordée au Client est personnelle, non exclusive et non transférable. Elle ne confère
            au Client aucun droit de propriété sur les applications ou leurs contenus.
          </p>
          <p className="mt-2">
            Les données saisies par le Client lui appartiennent. Il peut en demander l&apos;export à tout moment via{' '}
            <a href={`mailto:${SITE.contact_email}`} className="text-indigo-600 hover:underline">{SITE.contact_email}</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 11 — Responsabilité</h2>
          <p>
            La responsabilité de {SITE.company_name} est limitée aux dommages directs prouvés, dans la limite
            du montant payé par le Client au cours des 12 derniers mois.
          </p>
          <p className="mt-2">
            Les résultats fournis par les applications sont donnés à titre indicatif et ne constituent pas un conseil professionnel.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 12 — Protection des données personnelles</h2>
          <p>
            {SITE.company_name} traite les données personnelles du Client conformément au RGPD.
            Les modalités complètes sont décrites dans notre{' '}
            <a href="/politique-de-confidentialite" className="text-indigo-600 hover:underline">
              Politique de confidentialité
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 13 — Modification des CGV</h2>
          <p>
            {SITE.company_name} se réserve le droit de modifier les présentes CGV à tout moment.
            Les modifications entrent en vigueur à compter de leur publication.
            Le Client sera informé par email en cas de modification substantielle.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 14 — Médiation et règlement des litiges</h2>
          <p>
            En cas de litige, le Client s&apos;adressera en priorité à {SITE.company_name} par email à{' '}
            <a href={`mailto:${SITE.contact_email}`} className="text-indigo-600 hover:underline">{SITE.contact_email}</a>{' '}
            pour une résolution amiable.
          </p>
          <p className="mt-2">
            Pour les consommateurs, en cas d&apos;échec, vous pouvez recourir à la médiation via la plateforme européenne :{' '}
            <a href="https://ec.europa.eu/consumers/odr" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">
              https://ec.europa.eu/consumers/odr
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 15 — Droit applicable</h2>
          <p>
            Les présentes CGV sont soumises au droit français. En cas de litige persistant,
            les tribunaux français du ressort du siège social de {SITE.company_name} seront seuls compétents.
          </p>
        </section>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-1">
          <p className="text-xs text-gray-400">Dernière mise à jour : {today}</p>
          <p className="text-xs text-gray-400">
            Contact :{' '}
            <a href={`mailto:${SITE.contact_email}`} className="text-indigo-500 hover:underline">{SITE.contact_email}</a>
          </p>
        </div>
      </div>
    </div>
  )
}
