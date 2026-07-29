// Textes structurés des 12 planches de MILIEU du Bestiaire.
// Source de vérité : Sensetho_Concept_Marque/build_habitat_planches.cjs
// (régénéré via scratchpad/extract_habitats.cjs — ne pas éditer à la main).

export interface PlancheHabitat {
  caractere: string; meca: string; traduction: string; prosperent: string; souffrent: string; signaux: string
}

export const PLANCHES_HABITATS: Record<string, PlancheHabitat> = {
  savane: {
    caractere: 'Un marché vaste, en croissance — abondant mais disputé',
    meca: 'De hautes herbes à perte de vue, une lumière crue, des ressources abondantes mais convoitées : la savane nourrit les grands troupeaux comme les grands prédateurs. On y voit loin — et on y est vu de loin. La vitesse, l\'endurance et la capacité à tenir un territoire y font la différence.',
    traduction: 'Un marché large et porteur : la demande existe, les clients sont nombreux — mais tout le monde le sait. On y gagne par la vitesse d\'exécution, l\'endurance commerciale et un territoire défendu : une niche, une région, une expertise.',
    prosperent: 'Les prédateurs assumés (troupe de lions, meute de loups) · les coureurs endurants (chevaux) · les hardes organisées qui suivent la ressource.',
    souffrent: 'Les êtres lents ou repliés (la tortue hors de son rythme) · ceux qui ne tiennent aucun territoire · ceux qui confondent l\'abondance du milieu avec l\'absence de concurrence.',
    signaux: 'Croissance du marché, nouveaux entrants réguliers, guerre des talents et des parts. Quand les points d\'eau se raréfient, la savane devient désert : surveiller la pluie — les cycles d\'investissement, la démographie des clients.',
  },
  jungle: {
    caractere: 'Un marché ultra-concurrentiel, dérégulé',
    meca: 'Une végétation dense, une lumière rare qu\'il faut aller chercher, des niches à chaque étage — et des dangers partout. Dans la jungle, tout pousse vite et tout se fait manger vite : la loi du plus adapté, pas du plus fort.',
    traduction: 'Un marché foisonnant et peu régulé : opportunités constantes, concurrence féroce, règles mouvantes. On y survit par l\'agilité, l\'opportunisme et une vigilance de tous les instants — la naïveté s\'y paie comptant.',
    prosperent: 'Les adaptatifs (la pieuvre) · les alliances de circonstance · les espèces rapides à saisir une niche avant qu\'elle ne se referme.',
    souffrent: 'Les process lourds de la fourmilière quand la piste change chaque jour · ceux qui attendent que le régulateur siffle la fin de la partie · les confiants.',
    signaux: 'Marges sous pression, imitation immédiate de toute innovation, contrats perdus sans explication : la jungle ne prévient pas — elle teste en permanence.',
  },
  riviere: {
    caractere: 'Un flux continu, une cadence imposée',
    meca: 'Le courant ne s\'arrête jamais : il faut nager en permanence, ou être emporté. La rivière nourrit généreusement ceux qui tiennent son rythme — et charrie les autres.',
    traduction: 'Un marché qui impose sa cadence : flux tendu, saisonnalité forte, donneurs d\'ordres qui rythment tout. On n\'y choisit pas son tempo — on y organise l\'endurance et les relais.',
    prosperent: 'Le banc de poissons (coordination de masse dans le flux) · les gnous (l\'élan collectif) · le castor, s\'il a le droit de construire ses retenues.',
    souffrent: 'Les rythmes lents · les organisations sans relais — l\'épuisement guette · celles qui confondent la vitesse du courant avec une direction choisie.',
    signaux: 'Des équipes qui ne « sortent jamais la tête de l\'eau », des projets de fond sans cesse reportés : quand on ne peut plus s\'arrêter pour réfléchir, c\'est le courant qui décide.',
  },
  banquise: {
    caractere: 'Un secteur en déclin, des ressources qui se raréfient',
    meca: 'Le sol se réduit sous les pattes : chaque saison, la banquise rend un peu de sa surface à la mer. Les espèces qui y vivent n\'ont que trois options — se serrer, migrer, ou apprendre à nager.',
    traduction: 'Un secteur en déclin structurel : la demande s\'érode, les marges fondent, l\'urgence s\'installe. La cohésion de survie devient vitale — et la question stratégique n\'est plus « comment gagner » mais « où aller ».',
    prosperent: 'La colonie de manchots (cohésion par l\'adversité, rotation aux places exposées) · les éléphants (la mémoire des crises passées) · ceux qui préparent la migration pendant qu\'il reste de la glace.',
    souffrent: 'Ceux qui nient la fonte · les prédateurs de territoire quand le territoire disparaît · ceux qui confondent résister et rester.',
    signaux: 'Un marché qui se contracte d\'année en année, des acteurs qui se consolident, des jeunes talents qui n\'entrent plus dans le secteur : la banquise annonce sa fonte longtemps avant de céder.',
  },
  desert: {
    caractere: 'Pénurie, sobriété',
    meca: 'Peu d\'eau, peu de proies, des écarts de température extrêmes : le désert ne pardonne aucun gaspillage. Les espèces qui y vivent sont des chefs-d\'œuvre d\'économie — chaque goutte compte.',
    traduction: 'Un marché de pénurie : peu de clients, budgets rares, cycles longs. On y survit par la sobriété structurelle — coûts légers, endurance — et la connaissance exacte des points d\'eau : les rares clients solvables.',
    prosperent: 'Les sobres endurants (le cheval du désert) · les suricates (vigilance sur chaque ressource) · les chauves-souris vampires (la mutualisation qui sauve les mauvaises nuits).',
    souffrent: 'Les gros consommateurs de ressources · les structures de coûts bâties pour la savane · ceux qui attendent la pluie au lieu de s\'organiser pour la sécheresse.',
    signaux: 'Cycles de vente qui s\'allongent, décisions reportées, prix sous pression permanente. Au désert, la question n\'est pas la part de marché — c\'est l\'autonomie en eau : la trésorerie.',
  },
  poulailler: {
    caractere: 'Un marché clos et protégé — fragile',
    meca: 'Un enclos, du grain assuré, pas de prédateurs visibles : le poulailler est confortable. Mais ses habitants ont désappris la fuite et le vol — et le grillage qui protège est aussi ce qui empêche de partir quand le renard entre.',
    traduction: 'Un marché captif ou abrité : monopole local, rente réglementaire, client historique. Le confort est réel — la fragilité aussi : la protection décourage l\'adaptation, et le jour où la porte s\'ouvre (dérégulation, nouvel entrant), tout se joue très vite.',
    prosperent: 'L\'ordre de picorage (des statuts clairs dans un monde stable) · les gestionnaires rigoureux de la rente · ceux qui profitent du confort pour préparer l\'extérieur.',
    souffrent: 'Tout le monde, le jour où le renard entre · les talents qui veulent voler · l\'innovation, que rien ne récompense.',
    signaux: 'Aucun client perdu depuis des années, aucune veille concurrentielle, des process jamais remis en cause : au poulailler, le calme parfait est le signal le plus inquiétant.',
  },
  migration: {
    caractere: 'La transformation permanente',
    meca: 'Rien n\'est stable : la pluie décide, et un million et demi de gnous suivent. Le milieu lui-même est un mouvement — les rivières à franchir font partie de la route.',
    traduction: 'Une organisation ou un marché en transformation continue : réorganisations, pivots, fusions. La stabilité n\'existe plus ; la capacité à bouger ensemble devient la première compétence.',
    prosperent: 'Les hardes qui sentent la pluie (gnous, zèbres) · les éléphants (la mémoire des routes) · les étourneaux (le virage coordonné).',
    souffrent: 'Les sédentaires · ceux qui s\'épuisent à reconstruire à chaque étape ce qui sera démonté à la suivante · les individus sacrifiés aux passages de rivière — les transitions mal accompagnées.',
    signaux: 'Troisième réorganisation en deux ans, fatigue du changement, cynisme des équipes (« ça passera, comme la précédente ») : quand la migration devient errance, réinterroger la pluie qu\'on suit.',
  },
  mer: {
    caractere: 'Un milieu hostile, des externalités subies',
    meca: 'La haute mer est vaste et nourricière, mais traversée de forces qui ignorent ses habitants : cargos, filets, pollutions. Même les plus intelligents — le dauphin — y subissent des dangers qu\'ils n\'ont pas choisis.',
    traduction: 'Un environnement dominé par des forces extérieures : géants du secteur, plateformes, chocs géopolitiques, réglementation subie. Côté cité : un territoire social ou écologique qui se dégrade autour de l\'entreprise, sans qu\'elle en soit la cause.',
    prosperent: 'Les collectifs vigilants (le banc, les suricates) · ceux qui lisent les routes des cargos — la veille stratégique · les alliances : on ne détourne pas un cargo seul, mais on peut baliser ensemble.',
    souffrent: 'Les solitaires, même brillants · ceux qui croient que l\'intelligence suffit contre le tonnage · les organisations sans amers — sans repères extérieurs.',
    signaux: 'Les décisions qui comptent se prennent ailleurs ; les chocs se répètent sans être anticipés : quand toutes les vagues viennent des autres, la stratégie devient une navigation.',
  },
  estuaire: {
    caractere: 'Forte régulation, dépendance externe',
    meca: 'Deux fois par jour, la marée redistribue tout : eau douce et eau salée, fonds découverts puis noyés. L\'estuaire est l\'un des milieux les plus riches — pour qui accepte de vivre au rythme d\'une force qu\'il ne contrôle pas.',
    traduction: 'Un secteur rythmé par la régulation, la commande publique ou un donneur d\'ordres dominant : appels d\'offres, cycles budgétaires, réformes. Riche mais stressant — la ressource va et vient selon un calendrier qui n\'est pas le vôtre.',
    prosperent: 'Les adaptatifs patients (la pieuvre) · ceux qui connaissent l\'horaire des marées — l\'expertise réglementaire · les organisations qui font des réserves à marée haute.',
    souffrent: 'Ceux qui veulent maîtriser leur cap en toutes saisons · les trésoreries sans coussin · ceux qui construisent sous la ligne de marée haute.',
    signaux: 'Une activité en dents de scie calée sur les budgets publics, une dépendance à un client au-delà de 40 % : l\'estuaire nourrit bien — jusqu\'au jour où la marée change de régime (réforme, alternance, désengagement).',
  },
  foret: {
    caractere: 'Un grand ensemble, des silos, de la complexité',
    meca: 'Sous la canopée, la lumière n\'arrive qu\'à ceux qui la cherchent : des milliers de niches superposées, une richesse énorme, une visibilité presque nulle. On peut y vivre des années sans croiser son voisin d\'étage.',
    traduction: 'Une grande organisation ou un écosystème institutionnel dense : richesse interne réelle, mais silos, opacité, circuits interminables. Chacun sa niche — et personne ne voit l\'ensemble.',
    prosperent: 'Les bâtisseurs (le castor, qui ouvre des clairières) · la pieuvre (un centre qui donne le cap à des bras autonomes) · ceux qui savent lire les traces (la fourmilière outillée).',
    souffrent: 'Ceux qui ont besoin d\'être vus pour exister · les messages qui doivent traverser cinq étages de canopée · les initiatives sans parrain.',
    signaux: 'Deux services qui découvrent qu\'ils font la même chose ; l\'information qui circule mieux par l\'extérieur qu\'en interne : la forêt est riche — mais qui voit le ciel ?',
  },
  recif: {
    caractere: 'Un écosystème de partenaires, la vie locale',
    meca: 'Le récif est une ville sous-marine bâtie par ses propres habitants : chaque espèce y tient un rôle, les symbioses y sont la règle, et la santé de l\'ensemble fait la richesse de chacun. Fertile — et fragile.',
    traduction: 'Un écosystème local de partenaires interdépendants : clients, fournisseurs, associations, collectivités. L\'entreprise y vit de ses liens ; sa réputation est son oxygène. C\'est le milieu de l\'ancrage territorial réussi.',
    prosperent: 'Le poisson nettoyeur (le service régulé par la réputation) · les chauves-souris vampires (la réciprocité) · toute espèce qui rend au récif ce qu\'elle y prélève.',
    souffrent: 'Les prédateurs et les parasites — vite identifiés, durablement exclus · les anonymes qui ne tissent rien · ceux qui croient que la réputation est un discours.',
    signaux: 'Un partenaire perdu qui en entraîne deux autres ; une réputation qui blanchit comme un corail : le récif rend au centuple — et n\'oublie rien.',
  },
  vallee: {
    caractere: 'Un territoire de voisinage, un bien commun',
    meca: 'Une rivière, des pâturages, des villages : la vallée n\'appartient à personne et fait vivre tout le monde. Sa prospérité repose sur un équilibre entretenu — l\'eau prélevée en amont manque en aval.',
    traduction: 'Le territoire comme bien commun : emploi local, filières, ressources partagées. L\'entreprise y est un habitant parmi d\'autres — sa légitimité vient de sa contribution visible, pas de sa taille.',
    prosperent: 'Les contributeurs nets (le castor, dont les retenues profitent à tous) · la ruche (la délibération) · les éléphants (la mémoire du territoire).',
    souffrent: 'Les accapareurs — la vallée finit toujours par se liguer · ceux qui prélèvent sans rendre · les hors-sol.',
    signaux: 'Les jeunes du territoire qui postulent — ou ne postulent plus ; les élus qui citent l\'entreprise — ou l\'évitent : la vallée dit tout haut ce que le territoire pense tout bas.',
  },
}
