// Le Miroir — données de référence (bestiaire) + questionnaire guidé.
// App RSE « le-miroir » : voir src/app/rse/le-miroir et src/components/apps/LeMiroirApp.tsx.

export interface Espece { id: string; nom: string; emoji: string; trait: string }
export type Milieu = 'marché' | 'cité' | 'les deux'
export interface Habitat { id: string; nom: string; emoji: string; milieu: Milieu; sens: string }

export const ESPECES: Espece[] = [
  { id: 'manchot', nom: 'Colonie de manchots', emoji: '🐧', trait: "Cohésion par l'adversité, sans hiérarchie ; rotation solidaire." },
  { id: 'loup', nom: 'Meute-famille (loups)', emoji: '🐺', trait: "Autorité parentale et coordination loyale (au-delà du mythe de l'alpha)." },
  { id: 'lion', nom: 'Troupe de lions', emoji: '🦁', trait: 'Division du travail par la visibilité ; succession par conquête.' },
  { id: 'cheval', nom: 'Chevaux sauvages', emoji: '🐴', trait: 'Leadership distribué et vigilance partagée.' },
  { id: 'fourmi', nom: 'Fourmilière', emoji: '🐜', trait: 'Coordination sans chef par les traces (stigmergie) ; castes.' },
  { id: 'abeille', nom: 'Ruche (abeilles)', emoji: '🐝', trait: 'Décision collective démocratique par quorum.' },
  { id: 'etourneau', nom: "Murmuration d'étourneaux", emoji: '🐦', trait: 'Alignement sans commandement, par règles locales.' },
  { id: 'castor', nom: 'Castor', emoji: '🦫', trait: "Ingénieur d'écosystème : transforme le milieu pour tous." },
  { id: 'elephant', nom: "Harde d'éléphants", emoji: '🐘', trait: "Matriarcat de la mémoire : l'autorité par le savoir." },
  { id: 'suricate', nom: 'Suricates', emoji: '🦝', trait: 'Sentinelle à tour de rôle ; vigilance partagée.' },
  { id: 'vampire', nom: 'Chauves-souris vampires', emoji: '🦇', trait: 'Réciprocité et mémoire des dettes ; entraide.' },
  { id: 'nettoyeur', nom: 'Poisson nettoyeur', emoji: '🐠', trait: 'Relation de service régulée par la réputation.' },
  { id: 'coucou', nom: 'Coucou', emoji: '🪺', trait: 'Parasitisme de couvée : le passager clandestin (à détecter).' },
  { id: 'poule', nom: 'Ordre de picorage (poule)', emoji: '🐔', trait: 'Hiérarchie de dominance : des places figées.' },
  { id: 'banc', nom: 'Banc de poissons', emoji: '🐟', trait: 'Dilution du risque par le nombre ; anonymat.' },
  { id: 'gnou', nom: 'Harde de gnous', emoji: '🦓', trait: 'Mouvement de masse et suivisme.' },
  { id: 'pieuvre', nom: 'Pieuvre', emoji: '🐙', trait: 'Intelligence distribuée : intention centrale, exécution locale.' },
  { id: 'tortue', nom: 'Tortue', emoji: '🐢', trait: 'Repli protecteur : résiliente mais lente.' },
]

export const HABITATS: Habitat[] = [
  { id: 'savane', nom: 'Savane ouverte', emoji: '🌾', milieu: 'marché', sens: 'Marché vaste, en croissance, concurrence claire.' },
  { id: 'jungle', nom: 'Jungle', emoji: '🌴', milieu: 'marché', sens: 'Marché ultra-concurrentiel, dérégulé.' },
  { id: 'riviere', nom: 'Rivière / courant', emoji: '🌀', milieu: 'marché', sens: 'Flux continu, cadence imposée.' },
  { id: 'banquise', nom: 'Banquise qui fond', emoji: '🧊', milieu: 'marché', sens: 'Secteur en déclin, ressources rares.' },
  { id: 'desert', nom: 'Désert', emoji: '🏜️', milieu: 'marché', sens: 'Pénurie, sobriété ; seuls les adaptés prospèrent.' },
  { id: 'poulailler', nom: 'Poulailler', emoji: '🐔', milieu: 'marché', sens: 'Marché clos et protégé, fragile (milieu domestiqué).' },
  { id: 'migration', nom: 'Savane en migration', emoji: '🦓', milieu: 'les deux', sens: 'Transformation permanente, mouvement de masse.' },
  { id: 'mer', nom: 'Mer agitée (cargos)', emoji: '🌊', milieu: 'les deux', sens: 'Milieu hostile, externalités subies.' },
  { id: 'estuaire', nom: 'Estuaire (marées)', emoji: '🌫️', milieu: 'les deux', sens: 'Forte régulation, dépendance à des forces externes.' },
  { id: 'foret', nom: 'Forêt dense', emoji: '🌳', milieu: 'cité', sens: 'Grand ensemble, silos, complexité.' },
  { id: 'recif', nom: 'Récif corallien', emoji: '🪸', milieu: 'cité', sens: 'Écosystème de partenaires, vie locale, symbioses.' },
  { id: 'vallee', nom: 'Vallée partagée', emoji: '🏞️', milieu: 'cité', sens: 'Territoire de voisinage, bien commun.' },
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
export interface QuizQuestion { id: string; question: string; options: QuizOption[] }

export const QUIZ: QuizQuestion[] = [
  { id: 'social', question: "Comment cet être s'organise-t-il ?", options: [
    { label: 'Plutôt seul / autonome', tags: ['solitaire'] }, { label: 'En groupe, sans vrai chef', tags: ['egalitaire'] },
    { label: 'Avec une hiérarchie, un chef', tags: ['hierarchique'] }, { label: 'Comme une colonie très spécialisée', tags: ['colonie'] },
    { label: 'En groupes mouvants', tags: ['groupe-mouvant'] } ] },
  { id: 'decision', question: 'Comment décide-t-il ou se coordonne-t-il ?', options: [
    { label: 'Un meneur entraîne', tags: ['meneur'] }, { label: "Chacun s'aligne sur ses voisins", tags: ['essaim'] },
    { label: 'On délibère ensemble', tags: ['quorum'] }, { label: 'Par des traces, des process', tags: ['traces'] } ] },
  { id: 'danger', question: 'Face au danger ou au changement, il…', options: [
    { label: 'Fuit avec la masse', tags: ['fuite-masse'] }, { label: 'Se replie, se protège', tags: ['repli'] },
    { label: 'Veille, alerte', tags: ['vigilance'] }, { label: 'Combat, défend', tags: ['combat'] },
    { label: "S'adapte, se camoufle", tags: ['adaptation'] } ] },
  { id: 'visee', question: 'Ce qui le meut avant tout :', options: [
    { label: 'Conquérir, gagner', tags: ['conquete'] }, { label: 'Survivre ensemble', tags: ['survie'] },
    { label: 'Construire, transformer', tags: ['construction'] }, { label: 'Transmettre, la mémoire', tags: ['memoire'] },
    { label: 'Rendre service, réciprocité', tags: ['service'] } ] },
]

export function suggererEspeces(tags: string[], n = 3): { id: string; score: number }[] {
  if (tags.length === 0) return []
  return ESPECES.map((e) => ({ id: e.id, score: (ESPECE_TAGS[e.id] || []).filter((t) => tags.includes(t)).length }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, n)
}

// --- Êtres observés ---
export const ETRE_TYPES = [
  { key: 'entreprise', label: "L'entreprise" },
  { key: 'mon-service', label: 'Mon service' },
  { key: 'mon-manager', label: 'Mon manager (en tant que rôle)' },
  { key: 'autre-service', label: 'Un autre service' },
] as const
