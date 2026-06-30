// Le Miroir — bestiaire détaillé, questionnaire guidé, questions ouvertes + analyse IA.
// App RSE « le-miroir » : voir src/app/rse/le-miroir et src/components/apps/LeMiroirApp.tsx.

export interface Espece { id: string; nom: string; emoji: string; trait: string; description: string }
export type Milieu = 'marché' | 'cité' | 'les deux'
export interface Habitat { id: string; nom: string; emoji: string; milieu: Milieu; sens: string; description: string }

export const ESPECES: Espece[] = [
  { id: 'manchot', nom: 'Colonie de manchots', emoji: '🐧', trait: "Cohésion par l'adversité, sans hiérarchie.",
    description: "Au cœur de l'hiver, des milliers d'individus se serrent en masse compacte et se relaient du froid vers le centre chaud : la cohésion naît de l'adversité, pas de l'affinité. Côté organisation : une équipe soudée par l'épreuve (crise, surcharge), solidaire et sans chef — mais qui peut se disperser une fois le danger passé." },
  { id: 'loup', nom: 'Meute-famille (loups)', emoji: '🐺', trait: 'Autorité parentale et coordination loyale.',
    description: "La meute est une famille : un couple parental guide, nourrit et coordonne la chasse (le « mâle alpha » est un mythe issu de loups captifs). L'autorité y est une parentalité, non une domination. Côté organisation : leadership bienveillant, rôles clairs, forte loyauté — avec un risque d'esprit de clan refermé sur lui-même." },
  { id: 'lion', nom: 'Troupe de lions', emoji: '🦁', trait: 'Division du travail par la visibilité ; succession par conquête.',
    description: "Les lionnes chassent en coopération et discrètement ; le mâle protège le territoire et prend les risques visibles. À la prise de pouvoir, le nouveau mâle élimine la lignée du précédent. Côté organisation : ceux qui créent la valeur restent invisibles derrière une figure de proue ; et chaque changement de dirigeant tend à effacer l'héritage du précédent." },
  { id: 'cheval', nom: 'Chevaux sauvages', emoji: '🐴', trait: 'Leadership distribué et vigilance partagée.',
    description: "Dans la bande, l'étalon protège mais ne décide pas forcément ; le mouvement s'initie de façon contextuelle, et chacun apporte un talent sensoriel. Les chevaux sont hypersensibles à l'état émotionnel d'autrui. Côté organisation : le chef visible n'est pas toujours le décideur réel ; la sécurité repose sur une vigilance collective et le climat émotionnel." },
  { id: 'fourmi', nom: 'Fourmilière', emoji: '🐜', trait: 'Coordination sans chef par les traces (stigmergie).',
    description: "Des millions d'individus se coordonnent sans donneur d'ordres, par les traces (phéromones) laissées dans le milieu — la stigmergie — avec des castes et une division du travail stricte. Côté organisation : on se coordonne par les process, outils et données partagés plutôt que par l'ordre hiérarchique ; robustesse et passage à l'échelle, mais rigidité et perte de sens individuel." },
  { id: 'abeille', nom: 'Ruche (abeilles)', emoji: '🐝', trait: 'Décision collective démocratique par quorum.',
    description: "Pour choisir un nid, des éclaireuses prospectent, « dansent » pour plaider leur site, et la décision se prend par quorum, par ralliement. Côté organisation : décider par exploration distribuée + débat honnête + adhésion progressive ; les rôles évoluent avec l'expérience." },
  { id: 'etourneau', nom: "Murmuration d'étourneaux", emoji: '🐦', trait: 'Alignement sans commandement, par règles locales.',
    description: "Des dizaines de milliers d'oiseaux forment des nuées ondoyantes sans chef : chacun s'ajuste à ses ~7 voisins, et un mouvement global émerge de règles locales simples. Côté organisation : agilité et alignement sans commandement central — mais pas de cap intentionnel tenu dans la durée." },
  { id: 'castor', nom: 'Castor', emoji: '🦫', trait: "Ingénieur d'écosystème : transforme le milieu pour tous.",
    description: "Espèce clé : en bâtissant des barrages, le castor transforme un ruisseau en zone humide dont dépendent quantité d'autres espèces. Côté organisation : ceux qui construisent l'infrastructure, la plateforme ou le cadre qui rendent les autres possibles ; fort effet de levier, mais risque de sur-ingénierie et de rigidité." },
  { id: 'elephant', nom: "Harde d'éléphants", emoji: '🐘', trait: "Matriarcat de la mémoire : l'autorité par le savoir.",
    description: "La harde suit la matriarche, la plus âgée, dont l'autorité tient à sa mémoire (où trouver l'eau en sécheresse, reconnaître les menaces). Côté organisation : l'autorité par le savoir accumulé et l'expérience ; la mémoire institutionnelle est l'actif vital, surtout en temps de crise." },
  { id: 'suricate', nom: 'Suricates', emoji: '🦝', trait: 'Sentinelle à tour de rôle ; vigilance partagée.',
    description: "Pendant que le groupe se nourrit, une sentinelle se poste en hauteur et lance l'alerte au moindre danger ; le rôle tourne entre les membres. Côté organisation : faire tourner la vigie, sécurité par l'alerte précoce et la confiance — chacun travaille la tête baissée parce qu'un autre regarde l'horizon." },
  { id: 'vampire', nom: 'Chauves-souris vampires', emoji: '🦇', trait: 'Réciprocité et mémoire des dettes ; entraide.',
    description: "Une chauve-souris qui n'a pas mangé reçoit du sang régurgité — mais en priorité de celles qui ont déjà partagé ; les profiteurs sont peu à peu exclus. Côté organisation : un réseau d'entraide à mémoire sociale, où le capital social est une monnaie et les passagers clandestins sont détectés." },
  { id: 'nettoyeur', nom: 'Poisson nettoyeur', emoji: '🐠', trait: 'Relation de service régulée par la réputation.',
    description: "Le labre nettoyeur déparasite de plus gros poissons à sa « station » ; il est tenté de tricher, mais sa réputation — observée par les futurs clients — le discipline. Côté organisation : la relation de service (client/fournisseur) régulée par la réputation ; tentation permanente de rogner la qualité quand personne ne regarde." },
  { id: 'coucou', nom: 'Coucou', emoji: '🪺', trait: 'Parasitisme de couvée : le passager clandestin (à détecter).',
    description: "Le coucou pond dans le nid d'une autre espèce ; son poussin éjecte les œufs de l'hôte, qui l'élève quand même. Côté organisation : le mode-ombre à savoir détecter — capter les ressources d'un collectif sans contribuer ; son pendant positif est la vigilance de l'hôte, sa capacité à repérer et rejeter le parasitisme." },
  { id: 'poule', nom: 'Ordre de picorage (poule)', emoji: '🐔', trait: 'Hiérarchie de dominance : des places figées.',
    description: "L'« ordre de picorage » : chacune sait qui elle peut picorer et qui la picore. Une fois l'ordre stable, les conflits cessent — mais les places se figent et le bas de l'échelle subit. Côté organisation : hiérarchie de statut claire et apaisante, mais immobile, qui rend chaque arrivée ou réorganisation conflictuelle." },
  { id: 'banc', nom: 'Banc de poissons', emoji: '🐟', trait: 'Dilution du risque par le nombre ; anonymat.',
    description: "Des milliers de poissons bougent comme un seul corps : se fondre dans la masse dilue le risque individuel et brouille le prédateur. Côté organisation : la sécurité par le nombre et l'anonymat — on ne dépasse pas, on suit ; mais dilution de la responsabilité et conformisme." },
  { id: 'gnou', nom: 'Harde de gnous', emoji: '🦓', trait: 'Mouvement de masse et suivisme.',
    description: "Près d'1,5 million de gnous migrent en boucle ; la masse avance sans relâche et franchit les rivières, parfois au prix de vies. Côté organisation : l'élan collectif qui fait franchir les obstacles — mais aussi le suivisme, qui peut entraîner tout le monde vers le mauvais gué." },
  { id: 'pieuvre', nom: 'Pieuvre', emoji: '🐙', trait: 'Intelligence distribuée : intention centrale, exécution locale.',
    description: "Les deux tiers de ses neurones sont dans ses bras, quasi autonomes : le cerveau fixe l'intention, les bras trouvent l'exécution localement. Côté organisation : intelligence fortement décentralisée, le centre donne le cap et des unités autonomes résolvent ; grande agilité, mais ensemble parfois illisible de l'extérieur." },
  { id: 'tortue', nom: 'Tortue', emoji: '🐢', trait: 'Repli protecteur : résiliente mais lente.',
    description: "Face à la menace, la tortue ne fuit ni ne combat : elle se rétracte dans sa carapace — défense passive, lenteur, longévité exceptionnelle. Côté organisation : protéger le cœur, ralentir, encaisser les chocs ; résilience et durabilité, mais risque d'isolement et d'immobilisme." },
]

export const HABITATS: Habitat[] = [
  { id: 'savane', nom: 'Savane ouverte', emoji: '🌾', milieu: 'marché', sens: 'Marché vaste, en croissance.',
    description: "Un marché vaste et ouvert, en croissance, où les ressources existent mais se disputent. Place aux espèces rapides et endurantes ; un territoire à conquérir." },
  { id: 'jungle', nom: 'Jungle', emoji: '🌴', milieu: 'marché', sens: 'Marché ultra-concurrentiel, dérégulé.',
    description: "Un marché foisonnant, ultra-concurrentiel et peu régulé : opportunités et dangers à chaque pas, loi du plus adapté." },
  { id: 'riviere', nom: 'Rivière / courant', emoji: '🌀', milieu: 'marché', sens: 'Flux continu, cadence imposée.',
    description: "Un flux continu qui impose sa cadence : il faut nager en permanence ou être emporté. Un marché qui pousse, sans répit." },
  { id: 'banquise', nom: 'Banquise qui fond', emoji: '🧊', milieu: 'marché', sens: 'Secteur en déclin, ressources rares.',
    description: "Un milieu qui se réduit sous les pieds : secteur en déclin, ressources qui se raréfient, sentiment d'urgence." },
  { id: 'desert', nom: 'Désert', emoji: '🏜️', milieu: 'marché', sens: 'Pénurie, sobriété.',
    description: "Pénurie et sobriété forcée : peu de ressources, survie au premier plan ; seules les espèces très adaptées (ex. les chevaux arabes) y prospèrent." },
  { id: 'poulailler', nom: 'Poulailler', emoji: '🐔', milieu: 'marché', sens: 'Marché clos et protégé, fragile.',
    description: "Un milieu clos et protégé, peu concurrentiel — confortable jusqu'à l'arrivée d'un prédateur. Un marché captif ou abrité, mais fragile. (Milieu domestiqué, à employer en conscience.)" },
  { id: 'migration', nom: 'Savane en migration', emoji: '🦓', milieu: 'les deux', sens: 'Transformation permanente.',
    description: "Tout bouge en permanence : transformation, réorganisation, mouvement de masse. Peu de stabilité ; il faut suivre le mouvement." },
  { id: 'mer', nom: 'Mer agitée (cargos)', emoji: '🌊', milieu: 'les deux', sens: 'Milieu hostile, externalités subies.',
    description: "Un milieu vaste mais hostile, traversé de forces qu'on ne contrôle pas (cargos, pollution) : externalités subies et dangers diffus." },
  { id: 'estuaire', nom: 'Estuaire (marées)', emoji: '🌫️', milieu: 'les deux', sens: 'Forte régulation, dépendance externe.',
    description: "Un milieu soumis aux marées : forte régulation et dépendance à des forces externes ; riche mais stressant. (Régulation, tutelle, contraintes.)" },
  { id: 'foret', nom: 'Forêt dense', emoji: '🌳', milieu: 'cité', sens: 'Grand ensemble, silos, complexité.',
    description: "Un grand ensemble dense et complexe : on s'y voit peu, beaucoup de niches et de silos. Richesse interne, mais opacité." },
  { id: 'recif', nom: 'Récif corallien', emoji: '🪸', milieu: 'cité', sens: 'Écosystème de partenaires, vie locale.',
    description: "Un écosystème de partenaires interdépendants, fertile mais fragile : symbioses, vie locale, coopérations. Le milieu des liens." },
  { id: 'vallee', nom: 'Vallée partagée', emoji: '🏞️', milieu: 'cité', sens: 'Territoire de voisinage, bien commun.',
    description: "Un territoire de voisinage et de bien commun partagé : ancrage local, ressource mutualisée, relations de proximité." },
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
  manchot: ['egalitaire', 'survie', 'repli'], loup: ['hierarchique', 'meneur', 'conquete'],
  lion: ['hierarchique', 'combat', 'conquete'], cheval: ['groupe-mouvant', 'vigilance', 'fuite-masse'],
  fourmi: ['colonie', 'traces', 'construction'], abeille: ['colonie', 'quorum', 'construction'],
  etourneau: ['egalitaire', 'essaim', 'adaptation'], castor: ['construction', 'egalitaire'],
  elephant: ['hierarchique', 'meneur', 'memoire'], suricate: ['egalitaire', 'vigilance'],
  vampire: ['egalitaire', 'service', 'survie'], nettoyeur: ['service', 'adaptation', 'solitaire'],
  coucou: ['solitaire', 'parasite'], poule: ['hierarchique', 'combat'],
  banc: ['groupe-mouvant', 'fuite-masse', 'essaim'], gnou: ['groupe-mouvant', 'fuite-masse'],
  pieuvre: ['solitaire', 'adaptation'], tortue: ['solitaire', 'repli', 'memoire'],
}

export interface QuizOption { label: string; tags: string[] }
export interface QuizQuestion { id: string; question: string; hint: string; options: QuizOption[] }

export const QUIZ: QuizQuestion[] = [
  { id: 'social', question: "Comment cet être s'organise-t-il ?",
    hint: "La forme de son organisation sociale : qui décide, comment les rôles se répartissent, à quel point l'individu existe seul ou dans le groupe.",
    options: [
      { label: 'Plutôt seul / autonome', tags: ['solitaire'] }, { label: 'En groupe, sans vrai chef', tags: ['egalitaire'] },
      { label: 'Avec une hiérarchie, un chef', tags: ['hierarchique'] }, { label: 'Comme une colonie très spécialisée', tags: ['colonie'] },
      { label: 'En groupes mouvants', tags: ['groupe-mouvant'] } ] },
  { id: 'decision', question: 'Comment décide-t-il ou se coordonne-t-il ?',
    hint: "Le mode de décision et de coordination : un meneur qui tranche, un alignement spontané, une délibération, ou des règles/process partagés.",
    options: [
      { label: 'Un meneur entraîne', tags: ['meneur'] }, { label: "Chacun s'aligne sur ses voisins", tags: ['essaim'] },
      { label: 'On délibère ensemble', tags: ['quorum'] }, { label: 'Par des traces, des process', tags: ['traces'] } ] },
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
  { id: 'activite', label: "Activité / métier de cet être", type: 'text', hint: "Que fait-il concrètement ? Produit, service, fonction support, métier principal." },
  { id: 'marche_perimetre', label: "Périmètre de marché", type: 'choice', options: ['Local', 'Régional', 'National', 'International'], hint: "Jusqu'où s'étend son terrain de jeu économique ?" },
  { id: 'concurrence', label: "Intensité concurrentielle", type: 'choice', options: ['Faible', 'Moyenne', 'Forte', 'Dérégulée / féroce'], hint: "À quel point le marché est-il disputé ?" },
  { id: 'dynamique', label: "Dynamique du secteur", type: 'choice', options: ['En croissance', 'Stable', 'En transformation', 'En déclin'], hint: "Dans quel mouvement de fond se trouve-t-il ?" },
  { id: 'cite', label: "Ancrage dans la cité (territoire, société)", type: 'text', hint: "Lien au territoire, impact local, parties prenantes non-marchandes, contributions sociétales." },
  { id: 'comportement', label: "Comment se comporte-t-il au quotidien ?", type: 'text', hint: "Décisions, rituels, rapport aux autres, réactions au stress, gouvernance." },
  { id: 'enjeux', label: "Tensions ou enjeux actuels", type: 'text', hint: "Croissance, crise, transformation, désengagement, succession, réglementation…" },
]

// Catalogue compact transmis à l'IA pour qu'elle choisisse parmi des ids valides.
export function catalogueForAI(): string {
  const esp = ESPECES.map((e) => `- ${e.id} : ${e.nom} — ${e.trait}`).join('\n')
  const hab = HABITATS.map((h) => `- ${h.id} : ${h.nom} [${h.milieu}] — ${h.sens}`).join('\n')
  return `ESPÈCES (id : nom — trait)\n${esp}\n\nHABITATS (id : nom [milieu] — sens)\n${hab}`
}

// --- Êtres observés ---
export const ETRE_TYPES = [
  { key: 'entreprise', label: "L'entreprise" },
  { key: 'mon-service', label: 'Mon service' },
  { key: 'mon-manager', label: 'Mon manager (en tant que rôle)' },
  { key: 'autre-service', label: 'Un autre service' },
] as const
