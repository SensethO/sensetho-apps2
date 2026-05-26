export const metadata = { title: "Conditions Générales d'Utilisation — Sens'ethO Apps" }

const SITE = {
  brand_name:    "Sens'ethO Apps",
  company_name:  'SCDB PRO SARL',
  contact_email: 'sylvain.cassaro@sensetho.com',
  support_email: 'sylvain.cassaro@sensetho.com',
  website_url:   'https://apps.sensetho.com',
}

export default function CGUPage() {
  const today = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
        Conditions Générales d&apos;Utilisation
      </h1>
      <p className="text-sm text-gray-400 mb-10">
        En vigueur à compter du 1<sup>er</sup> janvier 2025 — Applicables à toute utilisation de la plateforme {SITE.website_url}
      </p>

      <div className="space-y-10 text-sm text-gray-700 dark:text-gray-300">

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 1 — Objet et champ d&apos;application</h2>
          <p>
            Les présentes Conditions Générales d&apos;Utilisation (ci-après « CGU ») régissent l&apos;accès et
            l&apos;utilisation de la plateforme {SITE.brand_name}, éditée par {SITE.company_name}.
          </p>
          <p className="mt-2">
            Tout utilisateur accédant à la plateforme, qu&apos;il soit client, collaborateur ou simple visiteur,
            accepte sans réserve les présentes CGU.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 2 — Accès à la plateforme</h2>
          <p>
            L&apos;accès aux applications {SITE.brand_name} est soumis à la création d&apos;un compte utilisateur
            et à l&apos;attribution d&apos;une licence valide par l&apos;administrateur de l&apos;organisation.
          </p>
          <p className="mt-2">
            L&apos;utilisateur est responsable de la confidentialité de ses identifiants de connexion.
            Tout accès effectué depuis son compte est réputé être le sien.
          </p>
          <p className="mt-2">
            En cas de perte ou de compromission des identifiants, l&apos;utilisateur doit contacter
            immédiatement son administrateur ou l&apos;équipe {SITE.brand_name} à{' '}
            <a href={`mailto:${SITE.support_email}`} className="text-indigo-600 hover:underline">{SITE.support_email}</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 3 — Compte utilisateur</h2>
          <p>
            Les comptes sont créés et gérés par l&apos;administrateur de l&apos;organisation cliente.
            Chaque utilisateur est associé à une organisation et dispose de droits définis par son rôle.
          </p>
          <p className="mt-2">
            L&apos;utilisateur s&apos;engage à fournir des informations exactes et à les maintenir à jour.
            Tout compte créé avec des informations frauduleuses pourra être supprimé sans préavis.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 4 — Utilisation des applications</h2>
          <p>L&apos;utilisateur s&apos;engage à utiliser les applications {SITE.brand_name} conformément à leur destination et à :</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Ne pas utiliser la plateforme à des fins illicites ou contraires aux bonnes mœurs.</li>
            <li>Ne pas tenter d&apos;accéder à des données ou fonctionnalités non autorisées.</li>
            <li>Ne pas perturber le fonctionnement de la plateforme ou de ses serveurs.</li>
            <li>Ne pas reproduire, copier ou revendre tout ou partie des applications sans autorisation.</li>
            <li>Respecter les droits de propriété intellectuelle de {SITE.company_name} et de ses partenaires.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 5 — Données saisies par l&apos;utilisateur</h2>
          <p>
            L&apos;utilisateur est responsable des données qu&apos;il saisit dans les applications
            (diagnostics, analyses, documents, etc.). Il garantit qu&apos;il dispose des droits nécessaires
            pour les traiter via la plateforme.
          </p>
          <p className="mt-2">
            {SITE.company_name} n&apos;est pas responsable des erreurs, inexactitudes ou illicéités
            dans les données saisies par les utilisateurs.
          </p>
          <p className="mt-2">
            Les données saisies sont accessibles par l&apos;administrateur de l&apos;organisation et
            peuvent faire l&apos;objet d&apos;un export sur demande.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 6 — Disponibilité du service</h2>
          <p>
            {SITE.company_name} s&apos;efforce de maintenir la plateforme disponible 24h/24, 7j/7.
            Des interruptions peuvent survenir pour maintenance, mise à jour ou en cas de force majeure.
          </p>
          <p className="mt-2">
            {SITE.company_name} ne peut être tenu responsable d&apos;une indisponibilité temporaire
            de la plateforme, quelle qu&apos;en soit la cause.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 7 — Résultats et limites des applications</h2>
          <p>
            Les diagnostics, analyses et résultats fournis par les applications {SITE.brand_name}
            sont générés à partir des données saisies par l&apos;utilisateur et des référentiels intégrés
            (ISO 26000, CSRD, VSME, etc.).
          </p>
          <p className="mt-2">
            Ces résultats sont <strong>donnés à titre indicatif</strong> et ne constituent pas
            un conseil professionnel certifié (juridique, financier, fiscal, RSE ou autre).
            L&apos;utilisateur reste seul responsable des décisions prises sur la base de ces résultats.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 8 — Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble des éléments constitutifs de la plateforme {SITE.brand_name} — interfaces,
            code source, algorithmes, contenus, marques, logos — sont la propriété exclusive de
            {' '}{SITE.company_name} ou de ses partenaires et sont protégés par le droit de la propriété intellectuelle.
          </p>
          <p className="mt-2">
            La licence accordée à l&apos;utilisateur est limitée à un usage strictement personnel et
            professionnel, dans le cadre de son organisation. Toute reproduction ou exploitation
            commerciale sans autorisation expresse est interdite.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 9 — Protection des données personnelles</h2>
          <p>
            {SITE.company_name} traite les données personnelles des utilisateurs dans le respect du RGPD.
            Les modalités complètes sont décrites dans notre{' '}
            <a href="/politique-de-confidentialite" className="text-indigo-600 hover:underline">
              Politique de confidentialité
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 10 — Suspension et résiliation du compte</h2>
          <p>
            {SITE.company_name} se réserve le droit de suspendre ou de supprimer tout compte utilisateur
            en cas de violation des présentes CGU, sans préavis ni indemnité.
          </p>
          <p className="mt-2">
            L&apos;utilisateur peut demander la suppression de son compte à tout moment en contactant{' '}
            <a href={`mailto:${SITE.contact_email}`} className="text-indigo-600 hover:underline">{SITE.contact_email}</a>.
            Les données seront conservées 30 jours après la suppression du compte avant effacement définitif.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 11 — Modification des CGU</h2>
          <p>
            {SITE.company_name} se réserve le droit de modifier les présentes CGU à tout moment.
            Les utilisateurs seront informés par email en cas de modification substantielle.
            La poursuite de l&apos;utilisation de la plateforme après notification vaut acceptation des nouvelles CGU.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Article 12 — Droit applicable et juridiction</h2>
          <p>
            Les présentes CGU sont soumises au droit français. En cas de litige relatif à leur interprétation
            ou exécution, les parties s&apos;efforceront de trouver une solution amiable avant tout recours judiciaire.
          </p>
          <p className="mt-2">
            À défaut d&apos;accord amiable, les tribunaux du ressort du siège social de {SITE.company_name}
            seront seuls compétents.
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
