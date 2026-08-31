/**
 * Référentiel « Conformité ECGT » — directive (UE) 2024/825 du 28 février 2024
 * « Empowering Consumers for the Green Transition » (donner aux consommateurs
 * les moyens d'agir en faveur de la transition verte).
 *
 * La directive ne crée pas un texte autonome : elle MODIFIE
 *  — la directive 2005/29/CE sur les pratiques commerciales déloyales (PCD),
 *    notamment ses articles 6 et 7 et la liste noire de son annexe I ;
 *  — la directive 2011/83/UE relative aux droits des consommateurs
 *    (informations précontractuelles : durabilité, réparabilité, mises à jour).
 *
 * ⚠️ Prudence rédactionnelle assumée : les références ci-dessous restent au
 * niveau de l'article ou de « la liste noire de l'annexe I ». Les numéros de
 * points insérés dans l'annexe I par la directive 2024/825 ne sont volontairement
 * PAS cités, faute de pouvoir les vérifier ligne à ligne dans le texte publié au
 * JOUE. Les formulations retenues sont exactes sans être inventées.
 *
 * Format : identique à ISO53001_AXES / ISO53001_NIVEAUX / BADGES du composant
 * Iso53001DiagnosticApp.tsx, mais placé dans src/lib pour être partagé entre
 * l'interface (EcgtApp.tsx) et les routes serveur (analyse IA, export Excel).
 *
 * @see docs/RSE_APP_PATTERN.md
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EcgtCritere {
  id: string
  label: string
  /** Description longue affichée dans le panneau Diagnostic. */
  description: string
  /** Base juridique — formulation prudente, jamais un numéro de point inventé. */
  reference: string
  /** Signaux à rechercher dans les contenus analysés (utilisés par l'IA). */
  signaux: string[]
}

export interface EcgtAxe {
  id: string
  label: string
  icon: string
  color: string
  colorLight: string
  weight: number
  description: string
  criteres: EcgtCritere[]
}

export type EcgtGravite = 'critique' | 'majeur' | 'mineur' | 'vigilance'
export type EcgtConstatStatut = 'ouvert' | 'corrige' | 'ecarte'
export type EcgtContenuType = 'url' | 'document' | 'image' | 'video' | 'texte'
export type EcgtContenuStatut = 'a_analyser' | 'analyse' | 'erreur'

/** Un constat de non-conformité produit par l'analyse (voir ecgt_constats). */
export interface EcgtConstat {
  critere_id: string
  gravite: EcgtGravite
  /** Citation EXACTE, verbatim, de l'extrait fautif du contenu analysé. */
  extrait: string
  probleme: string
  article_vise: string
  /** Réécriture conforme proposée, à intention commerciale conservée. */
  suggestion: string
  justification: string
}

// ─── Calendrier réglementaire ────────────────────────────────────────────────

export const ECGT_CALENDRIER = {
  adoption: '28 février 2024 — adoption de la directive (UE) 2024/825',
  transposition: '27 mars 2026 — date limite de transposition en droit national',
  application: '27 septembre 2026 — date d’application des mesures nationales de transposition',
  /** Rappel : le texte dit « Green Claims » (justification préalable des
   *  allégations environnementales) reste un projet distinct, en cours de
   *  négociation — il n'est pas couvert par ce diagnostic. */
  note: "La directive (UE) 2024/825 est le seul texte pris en compte par ce diagnostic. La proposition dite « Green Claims », relative à la justification et à la vérification préalables des allégations environnementales explicites, est un texte distinct, encore en négociation : elle n'est pas évaluée ici.",
} as const

// ─── Références juridiques admises (liste fermée pour l'IA) ──────────────────

/**
 * Seules ces formulations peuvent alimenter le champ `article_vise` d'un constat.
 * Elles sont volontairement prudentes : aucune ne cite un numéro de point de
 * l'annexe I ajouté par la directive 2024/825.
 */
export const ECGT_ARTICLES = [
  "Liste noire de l’annexe I de la directive 2005/29/CE, complétée par la directive (UE) 2024/825 — pratique réputée déloyale en toutes circonstances",
  "Article 6, paragraphe 1, de la directive 2005/29/CE (action trompeuse), tel que modifié par la directive (UE) 2024/825 — les caractéristiques environnementales et les aspects de circularité (durabilité, réparabilité) figurent parmi les éléments visés",
  "Article 6, paragraphe 2, de la directive 2005/29/CE, tel que modifié par la directive (UE) 2024/825 — allégations portant sur la performance environnementale future et avantages présentés comme distinctifs alors qu’ils sont dépourvus de pertinence",
  "Article 7 de la directive 2005/29/CE (omission trompeuse), tel que modifié par la directive (UE) 2024/825 — informations substantielles omises sur les caractéristiques environnementales",
  "Directive 2011/83/UE relative aux droits des consommateurs, telle que modifiée par la directive (UE) 2024/825 — informations précontractuelles sur la durabilité, la réparabilité et les mises à jour logicielles",
  "Exigence transversale de gouvernance interne — pas de base textuelle directe : obligation de pouvoir démontrer l’exactitude des allégations (charge de la preuve du professionnel)",
] as const

// ─── Les 5 axes × 4 critères ─────────────────────────────────────────────────

export const ECGT_AXES: EcgtAxe[] = [
  {
    id: 'allegations',
    label: 'Allégations environnementales',
    icon: '🌱',
    color: '#15803d',
    colorLight: '#dcfce7',
    weight: 0.2,
    description:
      "Toute allégation environnementale doit reposer sur des éléments scientifiques reconnus, démontrables, mesurables et vérifiables. La directive interdit les allégations génériques sans excellence environnementale démontrée, les allégations qui étendent à tout le produit un avantage limité à un aspect, et la présentation d’une obligation légale comme un avantage distinctif.",
    criteres: [
      {
        id: 'alleg-substantiation',
        label: 'Substantiation scientifique des allégations',
        description:
          "Chaque allégation environnementale s’appuie sur des éléments scientifiques largement reconnus, démontrables, mesurables et vérifiables, disponibles au moment où l’allégation est diffusée. La méthode, le périmètre, la date et la source des données sont documentés et peuvent être produits à la demande d’une autorité. Une allégation qui ne peut pas être prouvée ne doit pas être publiée.",
        reference: ECGT_ARTICLES[1],
        signaux: [
          'allégation chiffrée sans méthode ni source citée',
          '« jusqu’à X % » sans conditions de mesure',
          'comparaison sans base de comparaison explicite (par rapport à quoi, sur quelle période)',
          'renvoi vague à « des études » ou « nos analyses »',
        ],
      },
      {
        id: 'alleg-generique',
        label: 'Allégations génériques sans excellence démontrée',
        description:
          "Les allégations environnementales génériques — « écologique », « vert », « respectueux de l’environnement », « durable », « éco », « ami de la nature », « bon pour la planète », « conscient », « climatiquement responsable » — sont interdites lorsque le professionnel ne peut pas démontrer une excellence environnementale reconnue, pertinente au regard de l’allégation. Une allégation générique doit être remplacée par une allégation spécifique, précise et prouvée.",
        reference: ECGT_ARTICLES[0],
        signaux: [
          'les mots « écologique », « vert », « respectueux de l’environnement », « durable », « éco-responsable », « naturel », « propre », « zéro impact » employés seuls',
          'slogan environnemental sans précision du bénéfice ni de son périmètre',
          "excellence reconnue non démontrée (label de haut niveau, performance certifiée, classement officiel)",
        ],
      },
      {
        id: 'alleg-perimetre',
        label: 'Périmètre exact de l’allégation',
        description:
          "Une allégation qui ne porte que sur un aspect du produit (un composant, un emballage, une étape de fabrication) ou sur une partie de l’activité ne doit pas être présentée comme valant pour le produit entier, pour la gamme ou pour l’entreprise entière. Le périmètre couvert est explicite et immédiatement lisible, au même niveau de visibilité que l’allégation elle-même.",
        reference: ECGT_ARTICLES[0],
        signaux: [
          "allégation d’emballage étendue au produit (« bouteille recyclée » → « produit recyclé »)",
          '« notre entreprise est durable » à partir d’une seule initiative',
          'pourcentage de matière recyclée appliqué à l’ensemble alors qu’il ne vise qu’un composant',
          'précision du périmètre reléguée en astérisque illisible',
        ],
      },
      {
        id: 'alleg-obligation-legale',
        label: 'Obligation légale présentée comme un avantage',
        description:
          "Présenter comme un avantage distinctif de l’offre une exigence imposée par la loi à tous les produits de la catégorie concernée est une pratique interdite. Interdiction du plomb, absence de substances déjà prohibées, tri à la source, garantie légale de conformité, obligation de reprise : ces éléments ne peuvent pas être mis en avant comme un choix vertueux de l’entreprise.",
        reference: ECGT_ARTICLES[0],
        signaux: [
          '« sans substance X » alors que X est déjà interdite',
          '« conforme à la réglementation » présenté comme un engagement volontaire',
          'obligation d’étiquetage ou de collecte valorisée comme un plus produit',
        ],
      },
    ],
  },
  {
    id: 'labels',
    label: 'Labels et certifications',
    icon: '🏷️',
    color: '#b45309',
    colorLight: '#fef3c7',
    weight: 0.2,
    description:
      "Seuls sont admis les labels de durabilité établis par une autorité publique ou fondés sur un régime de certification reconnu, avec un contrôle par un tiers indépendant et compétent. Les labels d’auto-déclaration et les logos maison à l’allure officielle sont interdits, et le périmètre couvert par le label doit être transparent.",
    criteres: [
      {
        id: 'label-origine',
        label: 'Origine du label : autorité publique ou régime de certification',
        description:
          "Tout label de durabilité affiché est soit établi par une autorité publique (Écolabel européen, dispositifs nationaux), soit fondé sur un régime de certification reconnu, ouvert et transparent : référentiel public, critères objectifs, conditions d’accès non discriminatoires. Un inventaire des labels utilisés, avec leur nature juridique, est tenu à jour.",
        reference: ECGT_ARTICLES[0],
        signaux: [
          'logo « certifié » sans organisme identifiable',
          'label dont le référentiel n’est pas accessible',
          'label sectoriel dont l’adhésion est réservée aux membres d’une organisation',
        ],
      },
      {
        id: 'label-tiers',
        label: 'Contrôle par un tiers indépendant et compétent',
        description:
          "Le régime de certification qui fonde le label prévoit une vérification du respect des critères par un tiers indépendant, compétent et distinct à la fois du professionnel et du promoteur du régime. La preuve de la certification en cours de validité (attestation, numéro, périmètre, échéance) est conservée pour chaque produit concerné.",
        reference: ECGT_ARTICLES[0],
        signaux: [
          'contrôle réalisé par le fabricant lui-même ou par sa fédération',
          'attestation périmée ou couvrant un autre produit',
          '« audité » sans nom d’organisme ni date',
        ],
      },
      {
        id: 'label-autodeclaration',
        label: 'Interdiction des labels d’auto-déclaration',
        description:
          "L’affichage d’un label de durabilité qui n’est pas fondé sur un régime de certification ni établi par une autorité publique est une pratique interdite. Sont visés les logos maison, pictogrammes de feuilles, badges « éco-engagé », notes ou scores internes présentés visuellement comme des labels indépendants. Une démarche interne peut être décrite en toutes lettres, jamais mise en forme comme un label.",
        reference: ECGT_ARTICLES[0],
        signaux: [
          'pictogramme feuille, planète, badge circulaire créé par la marque',
          'score ou note maison présenté comme un label (« note verte A »)',
          'mention « label » sans propriétaire de référentiel identifié',
        ],
      },
      {
        id: 'label-perimetre',
        label: 'Transparence sur le périmètre couvert',
        description:
          "Le consommateur peut savoir sans effort ce que le label couvre : quels produits, quelles étapes du cycle de vie, quels critères. Un label obtenu pour une référence n’est pas apposé sur une gamme entière ; un label portant sur un seul critère (par exemple la gestion forestière d’un composant) n’est pas présenté comme une garantie environnementale globale.",
        reference: ECGT_ARTICLES[3],
        signaux: [
          'label affiché en page d’accueil pour une gamme dont une seule référence est certifiée',
          'absence de lien vers le référentiel ou vers le certificat',
          'label mono-critère utilisé comme caution générale',
        ],
      },
    ],
  },
  {
    id: 'carbone',
    label: 'Neutralité carbone et compensation',
    icon: '☁️',
    color: '#0e7490',
    colorLight: '#cffafe',
    weight: 0.2,
    description:
      "La directive interdit d’affirmer, sur la base d’une compensation d’émissions, qu’un produit a un impact neutre, réduit ou positif sur l’environnement en matière d’émissions de gaz à effet de serre. Les réductions réelles doivent être distinguées de la compensation, la trajectoire doit être vérifiable et les projets de compensation ne peuvent plus servir de fondement à une allégation produit.",
    criteres: [
      {
        id: 'carb-neutralite',
        label: 'Aucune allégation de neutralité fondée sur la compensation',
        description:
          "Les mentions « neutre en carbone », « neutralité carbone », « climatiquement neutre », « zéro carbone », « impact climat positif », « 100 % compensé » appliquées à un produit ou à une offre sont proscrites dès lors qu’elles reposent sur l’achat de crédits ou la compensation d’émissions. Cette interdiction figure dans la liste des pratiques réputées déloyales en toutes circonstances : elle n’admet pas de justification par la preuve.",
        reference: ECGT_ARTICLES[0],
        signaux: [
          '« produit neutre en carbone », « livraison neutre en CO₂ », « zéro carbone »',
          '« compensé à 100 % », « impact climatique nul »',
          'pictogramme CO₂ barré, planète protégée, empreinte à zéro',
        ],
      },
      {
        id: 'carb-reduction',
        label: 'Réduction réelle distinguée de la compensation',
        description:
          "Les communications séparent clairement ce qui relève d’une réduction effective des émissions (mesurée sur un périmètre défini, avec une année de référence) de ce qui relève d’un financement de projets externes. Les chiffres de réduction précisent le périmètre (scopes couverts), la base de comparaison et la méthode de calcul.",
        reference: ECGT_ARTICLES[1],
        signaux: [
          'réduction annoncée sans année de référence ni périmètre',
          'addition d’une réduction interne et de crédits achetés dans un même chiffre',
          'scope 3 exclu sans le dire',
        ],
      },
      {
        id: 'carb-trajectoire',
        label: 'Engagements futurs vérifiables',
        description:
          "Une allégation portant sur une performance environnementale future (« net zéro en 2040 », « 100 % recyclable en 2030 ») s’appuie sur des engagements clairs, objectifs, publiquement accessibles et vérifiables, décrits dans un plan de mise en œuvre détaillé, avec des jalons intermédiaires et un suivi régulier par un tiers indépendant. À défaut, l’engagement ne doit pas être communiqué.",
        reference: ECGT_ARTICLES[2],
        signaux: [
          'objectif lointain sans jalons ni plan public',
          'absence de vérification externe du suivi',
          '« nous visons », « nous ambitionnons » utilisés comme une performance acquise',
        ],
      },
      {
        id: 'carb-projets',
        label: 'Mentions des projets de compensation',
        description:
          "Le financement de projets climatiques peut être décrit factuellement (nature du projet, volume, standard, localisation) comme une contribution volontaire, à condition de ne fonder aucune allégation de neutralité ou de réduction de l’empreinte du produit et de ne pas occuper une place visuelle qui suggérerait l’inverse.",
        reference: ECGT_ARTICLES[0],
        signaux: [
          'projet de compensation mis en avant à côté du prix ou du nom du produit',
          'crédit carbone présenté comme annulant l’empreinte',
          'standard, millésime et volume des crédits non précisés',
        ],
      },
    ],
  },
  {
    id: 'durabilite',
    label: 'Durabilité, réparabilité, obsolescence',
    icon: '🔧',
    color: '#6d28d9',
    colorLight: '#ede9fe',
    weight: 0.2,
    description:
      "La durée de vie attendue et la réparabilité ne peuvent pas être présentées de manière trompeuse. Le consommateur doit être informé des mises à jour logicielles — y compris de celles qui dégradent le fonctionnement —, de la disponibilité des pièces détachées et de ses droits au titre de la garantie légale, qui ne peut jamais être vendue comme un avantage commercial.",
    criteres: [
      {
        id: 'dura-duree-vie',
        label: 'Information exacte sur la durée de vie attendue',
        description:
          "Les indications de longévité (« conçu pour durer 10 ans », « X cycles », « à vie ») reposent sur des essais documentés et des conditions d’usage précisées. Il est interdit de taire une caractéristique qui limite volontairement la durée de vie du produit, ou de laisser croire à une longévité supérieure à celle constatée.",
        reference: ECGT_ARTICLES[1],
        signaux: [
          'durée de vie annoncée sans protocole d’essai ni conditions d’usage',
          '« à vie » sans définition (vie du produit, du premier acheteur, de la gamme)',
          'limitation intégrée non divulguée (consommable bridé, compteur, verrouillage)',
        ],
      },
      {
        id: 'dura-reparabilite',
        label: 'Réparabilité et pièces détachées',
        description:
          "L’information sur la réparabilité est exacte et complète : indice ou score lorsqu’il existe, durée de disponibilité des pièces détachées, accès à la documentation technique et aux outils, réseau de réparateurs. Il est interdit de présenter un produit comme réparable alors qu’il ne l’est pas, ou de passer sous silence les restrictions techniques ou contractuelles à la réparation.",
        reference: ECGT_ARTICLES[4],
        signaux: [
          '« réparable » sans pièces détachées disponibles',
          'durée de disponibilité des pièces non indiquée',
          'réparation conditionnée au réseau agréé sans le dire',
          'assemblage collé ou soudé présenté comme démontable',
        ],
      },
      {
        id: 'dura-maj-logicielles',
        label: 'Mises à jour logicielles, y compris dégradantes',
        description:
          "La durée pendant laquelle des mises à jour logicielles sont fournies est communiquée avant l’achat. Le consommateur est informé lorsqu’une mise à jour est susceptible de dégrader le fonctionnement, l’autonomie ou les performances du produit ; l’omission de cette information, comme l’imposition d’une mise à jour non nécessaire à la conformité, relève des pratiques prohibées.",
        reference: ECGT_ARTICLES[4],
        signaux: [
          'durée de support logiciel absente de la fiche produit',
          'mise à jour dégradant l’autonomie annoncée seulement après installation',
          'fonction retirée par mise à jour sans information préalable',
        ],
      },
      {
        id: 'dura-garantie',
        label: 'Garantie légale non présentée comme un avantage',
        description:
          "La garantie légale de conformité est un droit du consommateur : elle ne peut pas être mise en avant comme un service offert par l’entreprise. Une garantie commerciale ne peut être valorisée que pour ce qu’elle ajoute réellement au droit légal, avec une distinction claire entre les deux et une information exacte sur sa durée et son contenu.",
        reference: ECGT_ARTICLES[0],
        signaux: [
          '« garantie 2 ans offerte » pour la seule garantie légale',
          'confusion entretenue entre garantie légale et garantie commerciale',
          'garantie commerciale « étendue » dont la durée réelle recouvre la garantie légale',
        ],
      },
    ],
  },
  {
    id: 'gouvernance',
    label: 'Gouvernance des communications',
    icon: '🛡️',
    color: '#be123c',
    colorLight: '#ffe4e6',
    weight: 0.2,
    description:
      "La conformité ECGT se construit avant la publication : circuit de validation des allégations, dossier de preuves conservé, équipes marketing et agences formées, veille juridique, et procédure de retrait ou de correction lorsqu’une allégation devient injustifiable.",
    criteres: [
      {
        id: 'gouv-validation',
        label: 'Validation avant publication',
        description:
          "Aucune allégation environnementale n’est publiée sans passer par un circuit de validation identifié (juridique, RSE, direction), formalisé par une check-list ECGT. Le circuit couvre tous les supports : site, fiches produit, emballages, publicités, réseaux sociaux, communiqués, argumentaires commerciaux, et s’applique aussi aux contenus produits par des agences ou des influenceurs.",
        reference: ECGT_ARTICLES[5],
        signaux: [
          'publication directe par les équipes marketing sans revue',
          'absence de check-list ou de grille de validation',
          'contenus d’agences et d’influenceurs hors du circuit',
        ],
      },
      {
        id: 'gouv-preuves',
        label: 'Dossier de preuves et conservation',
        description:
          "Chaque allégation diffusée est adossée à un dossier de preuves : source des données, méthode, périmètre, date, attestation de certification, rapport d’essai. Le dossier est conservé pendant toute la durée de diffusion de l’allégation et au-delà, et peut être produit rapidement en cas de contrôle ou de contestation. La charge de la preuve pèse sur le professionnel.",
        reference: ECGT_ARTICLES[5],
        signaux: [
          'aucune traçabilité entre une allégation publiée et sa preuve',
          'preuves dispersées, non versionnées, sans date',
          'allégation maintenue alors que la preuve a expiré',
        ],
      },
      {
        id: 'gouv-formation',
        label: 'Formation des équipes et des prestataires',
        description:
          "Les équipes marketing, communication, commerciales et achats, ainsi que les agences et prestataires, sont formées aux interdictions de la directive : allégations génériques, labels d’auto-déclaration, neutralité par compensation, obligations légales présentées comme des avantages. La formation est actualisée et tracée.",
        reference: ECGT_ARTICLES[5],
        signaux: [
          'aucune session de sensibilisation depuis l’adoption de la directive',
          'clauses contractuelles muettes vis-à-vis des agences',
          'vocabulaire interdit encore présent dans les chartes de marque',
        ],
      },
      {
        id: 'gouv-veille-retrait',
        label: 'Veille juridique et procédure de retrait',
        description:
          "Une veille suit la transposition nationale et les décisions des autorités de contrôle et de la publicité. Une procédure documentée permet de retirer ou de corriger rapidement une allégation devenue injustifiable, sur tous les supports concernés, y compris les emballages en circulation et les contenus archivés, avec un registre des corrections effectuées.",
        reference: ECGT_ARTICLES[5],
        signaux: [
          'aucune veille identifiée sur la transposition',
          'pas de délai cible de retrait ni de responsable désigné',
          'corrections effectuées sur le site mais pas sur les emballages ou les contenus tiers',
        ],
      },
    ],
  },
]

// ─── Niveaux de maturité ─────────────────────────────────────────────────────

export const ECGT_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Non conforme',      description: "Pratique interdite constatée ou sujet non traité",                       pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',       text: 'text-gray-600 dark:text-gray-400' },
  { value: 1, shortLabel: '1',  label: 'Initial',           description: "Sujet identifié, aucune règle ni preuve formalisée",                      pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',        text: 'text-red-700 dark:text-red-400' },
  { value: 2, shortLabel: '2',  label: 'En développement',  description: "Règles en cours de déploiement, couverture partielle des supports",       pct: 0.5,  color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20',  text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'Conforme',          description: "Exigence appliquée sur tous les supports, preuves disponibles",           pct: 0.75, color: '#22c55e', bg: 'bg-green-50 dark:bg-green-900/20',    text: 'text-green-700 dark:text-green-400' },
  { value: 4, shortLabel: '4',  label: 'Exemplaire',        description: "Exigence maîtrisée, contrôlée et vérifiée par un tiers",                  pct: 1,    color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20',      text: 'text-blue-700 dark:text-blue-400' },
]

export const ECGT_BADGES = [
  { label: 'Exemplaire',       min: 85, color: '#3b82f6', icon: '🏆' },
  { label: 'Conforme',         min: 60, color: '#16a34a', icon: '✅' },
  { label: 'En développement', min: 30, color: '#f97316', icon: '🔧' },
  { label: 'Insuffisant',      min: 0,  color: '#dc2626', icon: '⚠️' },
]

// ─── Gravités des constats ───────────────────────────────────────────────────

export const ECGT_GRAVITES: {
  value: EcgtGravite
  label: string
  description: string
  color: string
  bg: string
  text: string
}[] = [
  {
    value: 'critique',
    label: 'Critique',
    description:
      "Pratique figurant dans la liste noire de l’annexe I : déloyale en toutes circonstances, aucune justification possible. Retrait immédiat.",
    color: '#dc2626',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
  },
  {
    value: 'majeur',
    label: 'Majeur',
    description:
      "Allégation trompeuse ou omission substantielle très probable en l’état : correction nécessaire avant la date d’application.",
    color: '#f97316',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-400',
  },
  {
    value: 'mineur',
    label: 'Mineur',
    description:
      "Formulation imprécise ou preuve incomplète : à corriger, sans risque immédiat de qualification en pratique déloyale.",
    color: '#eab308',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  {
    value: 'vigilance',
    label: 'Vigilance',
    description:
      "Point d’attention : conforme en apparence mais dépendant d’une preuve à vérifier ou d’une interprétation nationale de la transposition.",
    color: '#0ea5e9',
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    text: 'text-sky-700 dark:text-sky-400',
  },
]

// ─── Types de contenus analysables ───────────────────────────────────────────

export const ECGT_CONTENU_TYPES: {
  value: EcgtContenuType
  label: string
  icon: string
  hint: string
}[] = [
  { value: 'url',      label: 'Page web',    icon: '🌐', hint: "Le texte visible de la page est extrait automatiquement (40 000 caractères maximum)." },
  { value: 'document', label: 'Document',    icon: '📄', hint: "PDF envoyé à l’analyse en vision. Les autres formats doivent être convertis en PDF ou collés en texte." },
  { value: 'image',    label: 'Visuel',      icon: '🖼️', hint: "Affiche, bannière, visuel de packaging : analysé en vision (PNG, JPEG, WebP, GIF)." },
  { value: 'video',    label: 'Vidéo',       icon: '🎬', hint: "La vidéo n’est pas transcrite : collez le script, la voix off ou les sous-titres dans le texte source." },
  { value: 'texte',    label: 'Texte collé', icon: '✍️', hint: "Slogan, argumentaire, publication réseaux sociaux, communiqué : analysé tel quel." },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const ECGT_CRITERES = ECGT_AXES.flatMap(a => a.criteres)
export const ECGT_CRITERE_IDS = ECGT_CRITERES.map(c => c.id)

export function findEcgtCritere(critereId: string): { axe: EcgtAxe; critere: EcgtCritere } | null {
  for (const axe of ECGT_AXES) {
    const critere = axe.criteres.find(c => c.id === critereId)
    if (critere) return { axe, critere }
  }
  return null
}

export function calculateEcgtScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of ECGT_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (ECGT_NIVEAUX[n]?.pct ?? 0) / nb
    }
    total += axeScore * axe.weight
  }
  return Math.round(total * 100)
}

export function ecgtBadge(score: number) {
  return ECGT_BADGES.find(b => score >= b.min) ?? ECGT_BADGES[ECGT_BADGES.length - 1]
}
