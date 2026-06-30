// Le Miroir — bestiaire détaillé, questionnaire, questions ouvertes + analyse IA (espèce/habitat + profil sectoriel).
// App RSE « le-miroir » : voir src/app/rse/le-miroir et src/components/apps/LeMiroirApp.tsx.

export interface Espece { id: string; nom: string; emoji: string; trait: string; description: string }
export type Milieu = 'marché' | 'cité' | 'les deux'
export interface Habitat { id: string; nom: string; emoji: string; milieu: Milieu; sens: string; description: string }

export const ESPECES: Espece[] = [
  { id: 'manchot', nom: 'Colonie de manchots', emoji: '🐧', trait: "Cohésion par l'adversité, sans hiérarchie.",
    description: "Mécanisme — au cœur de l'hiver antarctique, des milliers de manchots se serrent en masse compacte et se relaient du bord glacé vers le centre chaud : une cohésion née du froid, pas de l'affection. Traduction — une équipe soudée par l'épreuve (crise, surcharge, marché hostile), solidaire sans chef, où la position la plus exposée tourne entre tous. Forces : résilience extrême, aucun bouc émissaire. Dérives : la cohésion se dissout dès que l'adversité disparaît — elle survit mais ne conquiert pas. Adéquat en cellule de crise ou en survie ; inadéquat au beau fixe, quand il faut vision et initiative." },
  { id: 'loup', nom: 'Meute-famille (loups)', emoji: '🐺', trait: 'Autorité parentale et coordination loyale.',
    description: "Mécanisme — la meute est une famille (le « mâle alpha » est un mythe issu de loups captifs) : un couple parental guide, nourrit, coordonne la chasse coopérative. Traduction — une autorité-parentalité qui protège, transmet et coordonne, plutôt qu'elle n'écrase ; performance par la loyauté autour d'un but commun. Forces : rôles clairs, capacité à « chasser » plus gros que soi. Dérives : esprit de clan, fermeture à l'extérieur ; confusion possible entre autorité et domination. Adéquat pour des équipes soudées vers un objectif ambitieux ; inadéquat quand l'ouverture et la coopération inter-équipes priment." },
  { id: 'lion', nom: 'Troupe de lions', emoji: '🦁', trait: 'Division du travail par la visibilité ; succession par conquête.',
    description: "Mécanisme — les lionnes chassent en coopération et discrètement ; le mâle protège le territoire et prend les risques visibles ; à la prise de pouvoir, le nouveau mâle élimine la lignée du précédent. Traduction — les opérateurs créent la valeur dans l'ombre derrière une figure de proue, et chaque changement de dirigeant tend à effacer l'héritage du précédent. Forces : spécialisation efficace, défense claire du territoire, courage de la figure de proue. Dérives : travail réel invisible, dépendance à un protecteur, successions brutales. Adéquat sur un marché à défendre âprement ; inadéquat dans une culture de continuité et de reconnaissance partagée." },
  { id: 'cheval', nom: 'Chevaux sauvages', emoji: '🐴', trait: 'Leadership distribué et vigilance partagée.',
    description: "Mécanisme — dans la bande, l'étalon protège mais ne décide pas forcément ; le mouvement s'initie de façon contextuelle, chacun apporte un talent sensoriel, et les chevaux sont hypersensibles à l'état émotionnel d'autrui (synchronisation cardiaque démontrée, Keeling 2009). Traduction — le chef visible n'est pas toujours le décideur réel ; la sécurité repose sur une vigilance collective et le climat émotionnel (« l'ambiance est une information »). Forces : leadership souple, réactivité, talents reconnus. Dérives : la panique se propage aussi vite que l'info ; un chef qui se croit décideur alors qu'il n'est que protecteur. Adéquat en environnement incertain valorisant les talents distribués ; inadéquat quand il faut une décision unique et rapide." },
  { id: 'fourmi', nom: 'Fourmilière', emoji: '🐜', trait: 'Coordination sans chef par les traces (stigmergie).',
    description: "Mécanisme — des millions d'individus se coordonnent sans donneur d'ordres, par les traces (phéromones) laissées dans le milieu — la stigmergie — avec castes et division du travail stricte. Traduction — on se coordonne par les process, outils et données partagés plutôt que par l'ordre hiérarchique ; l'intelligence est dans le système. Forces : robustesse (pas de point unique de défaillance), passage à l'échelle. Dérives : rigidité des castes, perte de sens individuel, emballement des « pistes ». Adéquat pour de gros volumes répétables en milieu stable ; inadéquat quand l'initiative individuelle et la créativité de rupture sont clés." },
  { id: 'abeille', nom: 'Ruche (abeilles)', emoji: '🐝', trait: 'Décision collective démocratique par quorum.',
    description: "Mécanisme — pour choisir un nid, des éclaireuses prospectent, « dansent » pour plaider leur site, et la décision se prend par quorum, par ralliement ; à l'intérieur, le travail se répartit selon l'âge. Traduction — décider par exploration distribuée, débat honnête et adhésion progressive ; les rôles évoluent avec l'expérience. Forces : décisions de qualité, forte adhésion. Dérives : lenteur si le quorum tarde ; suppose une vraie culture du débat. Adéquat pour des choix importants et peu réversibles ; inadéquat dans l'urgence vitale." },
  { id: 'etourneau', nom: "Murmuration d'étourneaux", emoji: '🐦', trait: 'Alignement sans commandement, par règles locales.',
    description: "Mécanisme — des dizaines de milliers d'oiseaux forment des nuées ondoyantes sans chef : chacun s'ajuste à ses ~7 voisins, et un mouvement global émerge de règles locales simples. Traduction — agilité et alignement sans commandement central, par quelques règles partagées et l'attention aux plus proches. Forces : agilité extrême, résilience (pas de tête à abattre). Dérives : pas de cap intentionnel tenu, risque de mimétisme aveugle. Adéquat pour des organisations distribuées à forte autonomie locale ; inadéquat quand une direction explicite doit être tenue dans la durée." },
  { id: 'castor', nom: 'Castor', emoji: '🦫', trait: "Ingénieur d'écosystème : transforme le milieu pour tous.",
    description: "Mécanisme — espèce clé : en bâtissant des barrages, le castor transforme un ruisseau en zone humide dont dépendent quantité d'autres espèces ; l'ouvrage demande un entretien continu. Traduction — ceux qui construisent l'infrastructure, la plateforme ou le cadre qui rendent les autres possibles ; valeur dans le milieu rendu possible. Forces : ténacité, fort effet de levier, vision long terme. Dérives : sur-ingénierie (« usine à gaz »), rigidité des ouvrages, entretien sans fin. Adéquat en phase de construction / scale-up ; inadéquat quand il faut légèreté et réversibilité." },
  { id: 'elephant', nom: "Harde d'éléphants", emoji: '🐘', trait: "Matriarcat de la mémoire : l'autorité par le savoir.",
    description: "Mécanisme — la harde suit la matriarche, la plus âgée, dont l'autorité tient à sa mémoire (où trouver l'eau en sécheresse, reconnaître les menaces) ; les petits sont élevés collectivement. Traduction — l'autorité par le savoir accumulé et l'expérience ; la mémoire institutionnelle est l'actif vital, surtout en crise. Forces : sagesse, stabilité, transmission intergénérationnelle. Dérives : dépendance à une personne-mémoire, conservatisme, lenteur au changement de paradigme. Adéquat en environnement à crises récurrentes ; inadéquat lors de ruptures où l'expérience passée devient un piège." },
  { id: 'suricate', nom: 'Suricates', emoji: '🦝', trait: 'Sentinelle à tour de rôle ; vigilance partagée.',
    description: "Mécanisme — pendant que le groupe se nourrit, une sentinelle se poste en hauteur et lance un cri d'alarme calibré selon le danger ; le rôle de vigie tourne. Traduction — quelqu'un veille pendant que les autres produisent, et ce rôle ingrat tourne équitablement ; la sécurité repose sur l'alerte précoce et la confiance. Forces : détection précoce, relais, alertes « au bon niveau ». Dérives : fausses alertes, épuisement si le tour ne tourne pas vraiment. Adéquat pour des métiers à risques fréquents (sécurité, conformité, qualité, cyber) ; inadéquat en milieu stable où la vigilance permanente devient anxiété." },
  { id: 'vampire', nom: 'Chauves-souris vampires', emoji: '🦇', trait: 'Réciprocité et mémoire des dettes ; entraide.',
    description: "Mécanisme — une chauve-souris qui n'a pas mangé reçoit du sang régurgité, mais en priorité de celles qui ont déjà partagé ; les profiteurs sont peu à peu exclus du réseau. Traduction — un réseau d'entraide à mémoire sociale, où le capital social est une monnaie et les passagers clandestins sont détectés. Forces : résilience face à l'aléa (mutualisation du risque), cohésion par la dette d'honneur. Dérives : comptabilité implicite virant au clientélisme, exclusion brutale des « non-donneurs ». Adéquat dans les métiers à fort aléa où l'entraide sauve ; inadéquat en milieu très transactionnel ou à fort turnover." },
  { id: 'nettoyeur', nom: 'Poisson nettoyeur', emoji: '🐠', trait: 'Relation de service régulée par la réputation.',
    description: "Mécanisme — le labre nettoyeur déparasite de plus gros poissons à sa « station » ; tenté de tricher (mordre du mucus), il est discipliné par sa réputation, car les clients observent comment il traite les autres. Traduction — la relation de service (client/fournisseur) régulée par la réputation observable ; la confiance est un actif qui se voit. Forces : création de valeur mutuelle, fidélisation. Dérives : tentation de rogner quand personne ne regarde, « effet vitrine ». Adéquat pour des relations clients/fournisseurs durables ; inadéquat sur des marchés anonymes et one-shot." },
  { id: 'coucou', nom: 'Coucou', emoji: '🪺', trait: 'Parasitisme de couvée : le passager clandestin (à détecter).',
    description: "Mécanisme — le coucou pond dans le nid d'une autre espèce ; son poussin éjecte les œufs de l'hôte, qui l'élève quand même, trompé par des signaux exagérés. Traduction — le mode-ombre à savoir détecter : capter les ressources d'un collectif sans contribuer, et évincer les projets légitimes. Forces (du point de vue de l'hôte) : la pression aiguise la vigilance et les défenses. Dérives : captation de ressources, éviction des initiatives saines, épuisement des hôtes de bonne foi. Utile uniquement comme grille de détection (« avons-nous des coucous ? ») ; jamais comme mode à cultiver." },
  { id: 'poule', nom: 'Ordre de picorage (poule)', emoji: '🐔', trait: 'Hiérarchie de dominance : des places figées.',
    description: "Mécanisme — l'« ordre de picorage » : chacune sait qui elle peut picorer et qui la picore ; une fois l'ordre établi, les conflits cessent, mais l'arrivée d'un nouvel individu relance les affrontements. Traduction — une hiérarchie de statut claire et apaisante, mais qui fige les positions et écrase le bas. Forces : clarté des statuts, prévisibilité, baisse des conflits ouverts. Dérives : immobilité sociale, souffre-douleur en bas, violence à chaque réorganisation. Adéquat en milieu stable où la clarté du rang sécurise ; inadéquat quand on veut mobilité, méritocratie et initiative venue du bas." },
  { id: 'banc', nom: 'Banc de poissons', emoji: '🐟', trait: 'Dilution du risque par le nombre ; anonymat.',
    description: "Mécanisme — des milliers de poissons bougent comme un seul corps : effet de dilution (la probabilité d'être mangé chute avec le nombre) et de confusion du prédateur. Traduction — la sécurité par la masse : l'individu réduit son risque en se fondant dans le groupe, on ne dépasse pas, on suit. Forces : protection collective, détection à plusieurs. Dérives : invisibilité de l'individu, conformisme, dilution de la responsabilité (« quelqu'un d'autre s'en occupera »). Adéquat en environnement menaçant où se fondre protège ; inadéquat quand il faut responsabilité individuelle et leadership visible." },
  { id: 'gnou', nom: 'Harde de gnous', emoji: '🦓', trait: 'Mouvement de masse et suivisme.',
    description: "Mécanisme — près d'1,5 million de gnous migrent en boucle continue, sentant la pluie à distance ; la masse franchit les rivières meurtrières en sacrifiant des individus au passage. Traduction — l'élan collectif qui fait franchir les obstacles par la masse, mais aussi le suivisme, qui peut entraîner tout le monde vers le mauvais gué. Forces : élan, flair collectif de la ressource. Dérives : suivisme aveugle, bousculades, individus sacrifiés aux transitions. Adéquat en phase de transformation de masse / marché en mouvement rapide ; inadéquat quand il faut pause, réflexion et remise en cause du cap." },
  { id: 'pieuvre', nom: 'Pieuvre', emoji: '🐙', trait: 'Intelligence distribuée : intention centrale, exécution locale.',
    description: "Mécanisme — les deux tiers des neurones de la pieuvre sont dans ses bras, quasi autonomes (un bras sectionné réagit encore) : le cerveau fixe l'intention, les bras trouvent l'exécution. Traduction — intelligence fortement décentralisée : le centre donne le cap, des unités autonomes résolvent localement. Forces : autonomie locale, agilité, résolution de problèmes. Dérives : illisibilité (que fait chaque bras ?), coordination difficile, le centre peut perdre le fil. Adéquat en environnement complexe exigeant autonomie et adaptation rapide ; inadéquat quand il faut cohérence visible et standardisation." },
  { id: 'tortue', nom: 'Tortue', emoji: '🐢', trait: 'Repli protecteur : résiliente mais lente.',
    description: "Mécanisme — face à la menace, la tortue ne fuit ni ne combat : elle se rétracte dans sa carapace — défense passive, lenteur, longévité exceptionnelle. Traduction — protéger le cœur, ralentir, encaisser les chocs ; on survit par l'endurance, pas par la confrontation. Forces : résilience, longévité, encaisse sans paniquer. Dérives : lenteur, repli/fermeture, perte de contact avec l'extérieur, immobilisme. Adéquat pour traverser une tempête ou protéger un noyau ; inadéquat quand il faut vitesse, ouverture et conquête." },
]

export const HABITATS: Habitat[] = [
  { id: 'savane', nom: 'Savane ouverte', emoji: '🌾', milieu: 'marché', sens: 'Marché vaste, en croissance.',
    description: "Un marché vaste et ouvert, en croissance, où les ressources sont abondantes mais disputées. La place revient aux espèces rapides, endurantes et capables de tenir un territoire. Y prospèrent les prédateurs assumés (lion, loup) ; y peinent les êtres lents ou repliés." },
  { id: 'jungle', nom: 'Jungle', emoji: '🌴', milieu: 'marché', sens: 'Marché ultra-concurrentiel, dérégulé.',
    description: "Un marché foisonnant, ultra-concurrentiel et peu régulé : opportunités et dangers à chaque pas, loi du plus adapté. Récompense l'agilité, l'opportunisme et la combativité ; punit la lenteur et la naïveté. Milieu des requins, renards et caméléons." },
  { id: 'riviere', nom: 'Rivière / courant', emoji: '🌀', milieu: 'marché', sens: 'Flux continu, cadence imposée.',
    description: "Un flux continu qui impose sa cadence : il faut nager en permanence ou être emporté. Marché qui pousse, sans répit, où l'on n'arrête jamais. Favorise l'endurance et la coordination de masse ; épuise les rythmes lents." },
  { id: 'banquise', nom: 'Banquise qui fond', emoji: '🧊', milieu: 'marché', sens: 'Secteur en déclin, ressources rares.',
    description: "Un milieu qui se réduit sous les pieds : secteur en déclin, ressources qui se raréfient, sentiment d'urgence. Exige cohésion de survie et capacité à se relayer dans l'effort. Met à l'épreuve tout le monde — souvent l'habitat des colonies de manchots." },
  { id: 'desert', nom: 'Désert', emoji: '🏜️', milieu: 'marché', sens: 'Pénurie, sobriété.',
    description: "Pénurie et sobriété forcée : peu de ressources, survie au premier plan. Seules les espèces très adaptées y prospèrent (comme les chevaux arabes, faits pour ce milieu). Récompense l'endurance et l'économie de moyens ; épuise les gros consommateurs de ressources." },
  { id: 'poulailler', nom: 'Poulailler', emoji: '🐔', milieu: 'marché', sens: 'Marché clos et protégé, fragile.',
    description: "Un milieu clos et protégé, peu concurrentiel — confortable jusqu'à l'arrivée d'un prédateur. Marché captif ou abrité (monopole local, rente, niche réglementée), mais fragile et vite déséquilibré. Milieu domestiqué, à employer en conscience : le confort y masque la vulnérabilité." },
  { id: 'migration', nom: 'Savane en migration', emoji: '🦓', milieu: 'les deux', sens: 'Transformation permanente.',
    description: "Tout bouge en permanence : transformation, réorganisation, mouvement de masse. Peu de stabilité ; il faut suivre le mouvement collectif. Favorise les hardes (gnous, zèbres) et la mémoire des routes (éléphants) ; déstabilise les rythmes sédentaires." },
  { id: 'mer', nom: 'Mer agitée (cargos)', emoji: '🌊', milieu: 'les deux', sens: 'Milieu hostile, externalités subies.',
    description: "Un milieu vaste mais hostile, traversé de forces qu'on ne contrôle pas (cargos, pollution) : externalités subies et dangers diffus. Côté cité, c'est l'image d'une entreprise dont l'environnement social/écologique se dégrade autour d'elle. Épuise même les leaders intelligents (le dauphin parmi les cargos)." },
  { id: 'estuaire', nom: 'Estuaire (marées)', emoji: '🌫️', milieu: 'les deux', sens: 'Forte régulation, dépendance externe.',
    description: "Un milieu soumis aux marées : forte régulation et dépendance à des forces externes (tutelle, normes, donneur d'ordres unique). Riche mais stressant, rythmé par des cycles qu'on ne maîtrise pas. Favorise les espèces adaptatives et patientes ; pénalise celles qui ont besoin de maîtriser leur cap." },
  { id: 'foret', nom: 'Forêt dense', emoji: '🌳', milieu: 'cité', sens: 'Grand ensemble, silos, complexité.',
    description: "Un grand ensemble dense et complexe : on s'y voit peu, beaucoup de niches et de silos. Richesse interne mais opacité — typique des grandes organisations cloisonnées. Favorise les bâtisseurs (castor) et les intelligences distribuées (pieuvre) ; perd les êtres qui ont besoin de visibilité." },
  { id: 'recif', nom: 'Récif corallien', emoji: '🪸', milieu: 'cité', sens: 'Écosystème de partenaires, vie locale.',
    description: "Un écosystème de partenaires interdépendants, fertile mais fragile : symbioses, vie locale, coopérations. Le milieu des liens (cité) où l'entreprise tisse son ancrage et sa réputation. Récompense le mutualisme (poisson nettoyeur) et la réciprocité ; fragilisé par les comportements prédateurs ou parasites." },
  { id: 'vallee', nom: 'Vallée partagée', emoji: '🏞️', milieu: 'cité', sens: 'Territoire de voisinage, bien commun.',
    description: "Un territoire de voisinage et de bien commun partagé : ancrage local, ressource mutualisée, relations de proximité. Le milieu de l'entreprise bien intégrée à sa cité, contributrice au territoire. Récompense la coopération et la gouvernance partagée ; rejette l'accaparement." },
]

export const VERDICTS = [
  { value: 1, label: 'Inadéquat' },
  { value: 2, label: 'Plutôt inadéquat' },
  { value: 3, label: 'Plutôt adéquat' },
  { value: 4, label: 'Pleinement adéquat' },
] as const

export const especeById = (id: string) => ESPECES.find((e) => e.id === id)
export const habitatById = (id: string) => HABITATS.find((h) => h.id === id)
export const habitatsPourMilieu = (m: 'marché' | 'cité') => HABITATS.filter((h) => h.milieu === m || h.milieu === 'les deux')

// --- Questionnaire guidé (aide au choix de l'espèce) ---
export const ESPECE_TAGS: Record<string, string[]> = {
  manchot: ['egalitaire', 'survie', 'repli', 'adversite'], loup: ['hierarchique', 'meneur', 'conquete', 'parental'],
  lion: ['hierarchique', 'combat', 'conquete', 'predateur'], cheval: ['groupe-mouvant', 'vigilance', 'fuite-masse', 'distribue'],
  fourmi: ['colonie', 'traces', 'construction'], abeille: ['colonie', 'quorum', 'construction', 'democratie'],
  etourneau: ['egalitaire', 'essaim', 'adaptation', 'agile'], castor: ['construction', 'egalitaire', 'batisseur'],
  elephant: ['hierarchique', 'meneur', 'memoire', 'sagesse'], suricate: ['egalitaire', 'vigilance', 'sentinelle'],
  vampire: ['egalitaire', 'service', 'survie', 'reciprocite'], nettoyeur: ['service', 'adaptation', 'solitaire', 'reputation'],
  coucou: ['solitaire', 'parasite'], poule: ['hierarchique', 'combat', 'statut-fige'],
  banc: ['groupe-mouvant', 'fuite-masse', 'essaim', 'anonymat'], gnou: ['groupe-mouvant', 'fuite-masse', 'suivisme'],
  pieuvre: ['solitaire', 'adaptation', 'distribue'], tortue: ['solitaire', 'repli', 'memoire', 'lenteur'],
}

export interface QuizOption { label: string; tags: string[] }
export interface QuizQuestion { id: string; question: string; hint: string; options: QuizOption[]; showIf?: (tags: string[]) => boolean }

export const QUIZ: QuizQuestion[] = [
  { id: 'social', question: "Comment cet être s'organise-t-il ?",
    hint: "La forme de son organisation sociale : qui décide, comment les rôles se répartissent, à quel point l'individu existe seul ou dans le groupe.",
    options: [
      { label: 'Plutôt seul / autonome', tags: ['solitaire'] }, { label: 'En groupe, sans vrai chef', tags: ['egalitaire'] },
      { label: 'Avec une hiérarchie, un chef', tags: ['hierarchique'] }, { label: 'Comme une colonie très spécialisée', tags: ['colonie'] },
      { label: 'En groupes mouvants', tags: ['groupe-mouvant'] } ] },

  // ── Affinages conditionnels selon le type d'organisation ──
  { id: 'hierarchie', question: 'Cette autorité est plutôt…', hint: "Précise la nature du pouvoir hiérarchique.",
    showIf: (t) => t.includes('hierarchique'),
    options: [
      { label: 'Parentale, bienveillante (protège, transmet)', tags: ['parental'] },
      { label: 'Prédatrice, tournée vers la conquête', tags: ['predateur', 'conquete'] },
      { label: 'Figée par le statut / l\'ancienneté', tags: ['statut-fige'] },
      { label: "Fondée sur l'expérience et la mémoire", tags: ['sagesse', 'memoire'] } ] },
  { id: 'cohesion', question: 'Sa cohésion tient surtout…', hint: "Ce qui soude le groupe sans chef.",
    showIf: (t) => t.includes('egalitaire'),
    options: [
      { label: "À l'adversité partagée (on survit ensemble)", tags: ['adversite', 'survie'] },
      { label: "À un alignement spontané, agile", tags: ['agile', 'essaim'] },
      { label: 'À la vigilance mutuelle (on se surveille)', tags: ['sentinelle', 'vigilance'] },
      { label: "À l'entraide réciproque (donnant-donnant)", tags: ['reciprocite', 'service'] },
      { label: 'À la construction commune', tags: ['batisseur', 'construction'] } ] },
  { id: 'solo', question: 'Ce solitaire est plutôt…', hint: "Précise la posture de l'être autonome.",
    showIf: (t) => t.includes('solitaire'),
    options: [
      { label: 'Adaptatif, intelligent, agile', tags: ['adaptation', 'distribue'] },
      { label: 'Sur la défensive, lent, protégé', tags: ['repli', 'lenteur'] },
      { label: 'Profiteur (vit aux dépens des autres)', tags: ['parasite'] },
      { label: 'Au service des autres (réputation)', tags: ['service', 'reputation'] } ] },
  { id: 'masse', question: 'Dans ce mouvement de masse…', hint: "Précise le comportement collectif mouvant.",
    showIf: (t) => t.includes('groupe-mouvant'),
    options: [
      { label: 'On se fond dans le nombre pour se protéger', tags: ['anonymat', 'fuite-masse'] },
      { label: 'On suit le flux coûte que coûte', tags: ['suivisme', 'fuite-masse'] },
      { label: 'Les talents restent reconnus, la vigilance partagée', tags: ['distribue', 'vigilance'] } ] },
  { id: 'colonie', question: 'Cette colonie fonctionne par…', hint: "Précise le mode de coordination de la colonie.",
    showIf: (t) => t.includes('colonie'),
    options: [
      { label: 'Des traces / des process (sans chef)', tags: ['traces'] },
      { label: 'Une décision collective, un quorum', tags: ['quorum', 'democratie'] } ] },

  { id: 'danger', question: 'Face au danger ou au changement, il…',
    hint: "Sa réaction au stress et à la menace : fuir, se protéger, veiller, combattre, ou s'adapter. C'est souvent là que le comportement réel se révèle.",
    options: [
      { label: 'Fuit avec la masse', tags: ['fuite-masse'] }, { label: 'Se replie, se protège', tags: ['repli'] },
      { label: 'Veille, alerte', tags: ['vigilance'] }, { label: 'Combat, défend', tags: ['combat'] },
      { label: "S'adapte, se camoufle", tags: ['adaptation'] } ] },
  { id: 'visee', question: 'Ce qui le meut avant tout :',
    hint: "Son moteur profond, ce qui oriente ses choix au quotidien — au-delà du discours officiel.",
    options: [
      { label: 'Conquérir, gagner', tags: ['conquete'] }, { label: 'Survivre ensemble', tags: ['survie'] },
      { label: 'Construire, transformer', tags: ['construction'] }, { label: 'Transmettre, la mémoire', tags: ['memoire'] },
      { label: 'Rendre service, réciprocité', tags: ['service'] } ] },
]

export function suggererEspeces(tags: string[], n = 3): { id: string; score: number }[] {
  if (tags.length === 0) return []
  return ESPECES.map((e) => ({ id: e.id, score: (ESPECE_TAGS[e.id] || []).filter((t) => tags.includes(t)).length }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, n)
}

// --- Questions ouvertes (contexte pour l'analyse IA) ---
export interface OpenQuestion { id: string; label: string; type: 'text' | 'choice'; hint?: string; options?: string[] }
export const OPEN_QUESTIONS: OpenQuestion[] = [
  { id: 'activite', label: "Activité / secteur de cet être", type: 'text', hint: "Métier principal, secteur d'activité (le plus précis possible : code NAF, branche, type de produits/services)." },
  { id: 'marche_perimetre', label: "Périmètre de marché", type: 'choice', options: ['Local', 'Régional', 'National', 'International'], hint: "Jusqu'où s'étend son terrain de jeu économique ?" },
  { id: 'concurrence', label: "Intensité concurrentielle", type: 'choice', options: ['Faible', 'Moyenne', 'Forte', 'Dérégulée / féroce'], hint: "À quel point le marché est-il disputé ?" },
  { id: 'dynamique', label: "Dynamique du secteur", type: 'choice', options: ['En croissance', 'Stable', 'En transformation', 'En déclin'], hint: "Dans quel mouvement de fond se trouve-t-il ?" },
  { id: 'cite', label: "Ancrage dans la cité (territoire, société)", type: 'text', hint: "Lien au territoire, impact local, parties prenantes non-marchandes, contributions sociétales." },
  { id: 'comportement', label: "Comment se comporte-t-il au quotidien ?", type: 'text', hint: "Décisions, rituels, rapport aux autres, réactions au stress, gouvernance." },
  { id: 'enjeux', label: "Tensions ou enjeux actuels", type: 'text', hint: "Croissance, crise, transformation, désengagement, succession, réglementation, recrutement…" },
]

// Catalogue compact transmis à l'IA pour qu'elle choisisse parmi des ids valides.
export function catalogueForAI(): string {
  const esp = ESPECES.map((e) => `- ${e.id} : ${e.nom} — ${e.trait}`).join('\n')
  const hab = HABITATS.map((h) => `- ${h.id} : ${h.nom} [${h.milieu}] — ${h.sens}`).join('\n')
  return `ESPÈCES (id : nom — trait)\n${esp}\n\nHABITATS (id : nom [milieu] — sens)\n${hab}`
}

export const SECTEUR_DISCLAIMER =
  "Profil sectoriel généré par l'IA à titre indicatif (ordres de grandeur, non contractuels). À recouper avec des sources de référence : DARES, Insee, branches professionnelles, baromètres (Empreinte Humaine/OpinionWay, Ayming…)."

// --- Êtres observés ---
export const ETRE_TYPES = [
  { key: 'entreprise', label: "L'entreprise" },
  { key: 'mon-service', label: 'Mon service' },
  { key: 'mon-manager', label: 'Mon manager (en tant que rôle)' },
  { key: 'autre-service', label: 'Un autre service' },
] as const
