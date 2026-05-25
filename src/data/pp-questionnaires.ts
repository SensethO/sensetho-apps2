import { QuestionDimension } from '@/types/parties-prenantes'

export interface QuestionTemplate {
  id: string
  esrs: string
  esrs_name: string
  category: 'E' | 'S' | 'G'
  dimension: QuestionDimension
  target: 'internal' | 'external' | 'all'
  text: string
  help?: string
}

export interface ESRSTopic {
  id: string
  name: string
  category: 'E' | 'S' | 'G'
  icon: string
  description: string
  questions: QuestionTemplate[]
}

export const ESRS_TOPICS: ESRSTopic[] = [
  {
    id: 'E1',
    name: 'Changement climatique',
    category: 'E',
    icon: '🌡️',
    description: 'Émissions GES scopes 1-2-3, adaptation climatique, risques physiques et de transition énergétique',
    questions: [
      { id: 'E1-I1', esrs: 'E1', esrs_name: 'Changement climatique', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure les émissions de gaz à effet de serre (Scope 1 et 2) de votre organisation contribuent-elles au changement climatique ?', help: '1 = très faiblement, 5 = fortement (secteur intensif en énergie)' },
      { id: 'E1-I2', esrs: 'E1', esrs_name: 'Changement climatique', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure les émissions indirectes (Scope 3) de votre chaîne de valeur (achats, logistique, utilisation des produits) sont-elles significatives ?', help: 'Inclure amont et aval de la chaîne de valeur' },
      { id: 'E1-I3', esrs: 'E1', esrs_name: 'Changement climatique', category: 'E', dimension: 'impact', target: 'all', text: 'Votre organisation dispose-t-elle d\'une stratégie de réduction des émissions GES avec des objectifs chiffrés et un calendrier défini ?' },
      { id: 'E1-I4', esrs: 'E1', esrs_name: 'Changement climatique', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure vos produits ou services permettent-ils à vos clients de réduire leurs propres émissions (impact positif potentiel) ?' },
      { id: 'E1-F1', esrs: 'E1', esrs_name: 'Changement climatique', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure votre organisation est-elle exposée à des risques financiers liés à la transition bas-carbone (taxes carbone, marchés d\'émissions, évolutions réglementaires) ?', help: 'Évaluer la probabilité et la magnitude de ces risques' },
      { id: 'E1-F2', esrs: 'E1', esrs_name: 'Changement climatique', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure votre organisation est-elle exposée à des risques physiques liés au changement climatique (inondations, sécheresse, événements extrêmes) affectant vos actifs ou opérations ?' },
      { id: 'E1-F3', esrs: 'E1', esrs_name: 'Changement climatique', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure les opportunités liées à la transition énergétique (nouvelles offres vertes, efficacité énergétique, ENR) représentent-elles un potentiel de croissance pour votre activité ?' },
      { id: 'E1-G1', esrs: 'E1', esrs_name: 'Changement climatique', category: 'E', dimension: 'general', target: 'all', text: 'Dans quelle mesure le changement climatique est-il une priorité stratégique pour votre organisation dans les 3 prochaines années ?' },
    ],
  },
  {
    id: 'E2',
    name: 'Pollution',
    category: 'E',
    icon: '🏭',
    description: 'Pollution atmosphérique, aquatique, terrestre, substances préoccupantes et microplastiques',
    questions: [
      { id: 'E2-I1', esrs: 'E2', esrs_name: 'Pollution', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure vos activités génèrent-elles des émissions de polluants atmosphériques (NOx, SO2, COV, particules fines) au-delà des seuils réglementaires ?' },
      { id: 'E2-I2', esrs: 'E2', esrs_name: 'Pollution', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure vos rejets aquatiques (effluents industriels, eaux usées) ont-ils un impact sur la qualité de l\'eau et les écosystèmes aquatiques ?' },
      { id: 'E2-I3', esrs: 'E2', esrs_name: 'Pollution', category: 'E', dimension: 'impact', target: 'all', text: 'Votre organisation utilise-t-elle des substances chimiques préoccupantes (SVHC, perturbateurs endocriniens, PFAS) dans ses produits ou procédés ?' },
      { id: 'E2-I4', esrs: 'E2', esrs_name: 'Pollution', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure vos activités contribuent-elles à la contamination des sols (déversements, stockage produits dangereux, sites industriels) ?' },
      { id: 'E2-F1', esrs: 'E2', esrs_name: 'Pollution', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure votre organisation est-elle exposée à des risques financiers liés à des réglementations antipollution plus strictes (investissements requis, amendes potentielles) ?' },
      { id: 'E2-F2', esrs: 'E2', esrs_name: 'Pollution', category: 'E', dimension: 'financial', target: 'all', text: 'Quel est le risque de passif environnemental (coûts de dépollution, responsabilité civile) lié aux pollutions passées ou actuelles de votre organisation ?' },
      { id: 'E2-F3', esrs: 'E2', esrs_name: 'Pollution', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure le risque réputationnel lié à des incidents de pollution pourrait-il affecter votre activité commerciale ?' },
      { id: 'E2-G1', esrs: 'E2', esrs_name: 'Pollution', category: 'E', dimension: 'general', target: 'all', text: 'Dans quelle mesure la gestion de la pollution est-elle une priorité pour les parties prenantes de votre organisation ?' },
    ],
  },
  {
    id: 'E3',
    name: 'Eau et ressources marines',
    category: 'E',
    icon: '💧',
    description: 'Consommation d\'eau, qualité de l\'eau, ressources marines et écosystèmes aquatiques',
    questions: [
      { id: 'E3-I1', esrs: 'E3', esrs_name: 'Eau et ressources marines', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure votre organisation prélève-t-elle de l\'eau dans des zones de stress hydrique ou à disponibilité limitée ?' },
      { id: 'E3-I2', esrs: 'E3', esrs_name: 'Eau et ressources marines', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure vos rejets d\'eaux usées ou traitées affectent-ils la qualité des masses d\'eau réceptrices (rivières, nappes, mer) ?' },
      { id: 'E3-I3', esrs: 'E3', esrs_name: 'Eau et ressources marines', category: 'E', dimension: 'impact', target: 'all', text: 'Votre organisation dispose-t-elle de mesures de réduction de la consommation d\'eau (recyclage, optimisation des procédés) ?' },
      { id: 'E3-F1', esrs: 'E3', esrs_name: 'Eau et ressources marines', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure votre activité est-elle exposée à des risques financiers liés à la pénurie d\'eau (augmentation des coûts d\'accès, restrictions d\'usage) ?' },
      { id: 'E3-F2', esrs: 'E3', esrs_name: 'Eau et ressources marines', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure les réglementations sur l\'usage et la qualité de l\'eau pourraient-elles imposer des investissements significatifs à votre organisation ?' },
      { id: 'E3-G1', esrs: 'E3', esrs_name: 'Eau et ressources marines', category: 'E', dimension: 'general', target: 'all', text: 'Dans quelle mesure la gestion responsable de l\'eau est-elle un enjeu pertinent pour votre secteur d\'activité ?' },
    ],
  },
  {
    id: 'E4',
    name: 'Biodiversité et écosystèmes',
    category: 'E',
    icon: '🌿',
    description: 'Changement d\'utilisation des terres, espèces, déforestation, espèces exotiques envahissantes',
    questions: [
      { id: 'E4-I1', esrs: 'E4', esrs_name: 'Biodiversité et écosystèmes', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure vos activités ou votre chaîne d\'approvisionnement sont-elles localisées dans ou à proximité de zones sensibles pour la biodiversité (zones protégées, zones humides, forêts primaires) ?' },
      { id: 'E4-I2', esrs: 'E4', esrs_name: 'Biodiversité et écosystèmes', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure vos opérations contribuent-elles à la perte de biodiversité (artificialisation des sols, fragmentation des habitats, déforestation) ?' },
      { id: 'E4-I3', esrs: 'E4', esrs_name: 'Biodiversité et écosystèmes', category: 'E', dimension: 'impact', target: 'all', text: 'Votre organisation mesure-t-elle son empreinte sur la biodiversité et a-t-elle fixé des objectifs de réduction ou de compensation ?' },
      { id: 'E4-F1', esrs: 'E4', esrs_name: 'Biodiversité et écosystèmes', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure votre activité dépend-elle de services écosystémiques (eau douce, pollinisation, stabilisation des sols) dont la dégradation constitue un risque financier ?' },
      { id: 'E4-F2', esrs: 'E4', esrs_name: 'Biodiversité et écosystèmes', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure l\'évolution de la réglementation sur la biodiversité (SBTN, COP15, taxe sur l\'artificialisation) pourrait-elle générer des contraintes ou surcoûts pour votre activité ?' },
      { id: 'E4-G1', esrs: 'E4', esrs_name: 'Biodiversité et écosystèmes', category: 'E', dimension: 'general', target: 'all', text: 'Dans quelle mesure la préservation de la biodiversité est-elle un sujet de préoccupation pour vos parties prenantes (clients, investisseurs, régulateurs) ?' },
    ],
  },
  {
    id: 'E5',
    name: 'Économie circulaire',
    category: 'E',
    icon: '♻️',
    description: 'Ressources entrantes/sortantes, déchets, produits et matériaux en fin de vie',
    questions: [
      { id: 'E5-I1', esrs: 'E5', esrs_name: 'Économie circulaire', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure votre organisation consomme-t-elle des matières premières vierges qui pourraient être remplacées par des matières recyclées ou renouvelables ?' },
      { id: 'E5-I2', esrs: 'E5', esrs_name: 'Économie circulaire', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure le volume de déchets générés par vos activités (déchets dangereux, déchets non recyclés, emballages) est-il significatif ?' },
      { id: 'E5-I3', esrs: 'E5', esrs_name: 'Économie circulaire', category: 'E', dimension: 'impact', target: 'all', text: 'Dans quelle mesure vos produits sont-ils conçus selon les principes d\'écoconception (durabilité, réparabilité, recyclabilité, modularité) ?' },
      { id: 'E5-I4', esrs: 'E5', esrs_name: 'Économie circulaire', category: 'E', dimension: 'impact', target: 'all', text: 'Votre organisation propose-t-elle des services de reprise, de réparation ou de valorisation en fin de vie pour ses produits ?' },
      { id: 'E5-F1', esrs: 'E5', esrs_name: 'Économie circulaire', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure la volatilité des prix des matières premières constitue-t-elle un risque financier significatif pour votre activité ?' },
      { id: 'E5-F2', esrs: 'E5', esrs_name: 'Économie circulaire', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure les réglementations sur les déchets et la responsabilité élargie des producteurs (REP) génèrent-elles des obligations financières croissantes pour votre organisation ?' },
      { id: 'E5-F3', esrs: 'E5', esrs_name: 'Économie circulaire', category: 'E', dimension: 'financial', target: 'all', text: 'Dans quelle mesure les modèles d\'affaires circulaires (location, économie de fonctionnalité, remanufacturing) représentent-ils une opportunité de développement pour votre organisation ?' },
      { id: 'E5-G1', esrs: 'E5', esrs_name: 'Économie circulaire', category: 'E', dimension: 'general', target: 'all', text: 'Dans quelle mesure la transition vers une économie circulaire est-elle une attente forte de la part de vos clients et partenaires commerciaux ?' },
    ],
  },
  {
    id: 'S1',
    name: 'Effectifs propres',
    category: 'S',
    icon: '👥',
    description: 'Conditions de travail, égalité des chances, santé et sécurité, droits fondamentaux des salariés',
    questions: [
      { id: 'S1-I1', esrs: 'S1', esrs_name: 'Effectifs propres', category: 'S', dimension: 'impact', target: 'internal', text: 'Dans quelle mesure votre organisation garantit-elle des conditions de travail équitables (rémunération digne, temps de travail raisonnable, sécurité de l\'emploi) à l\'ensemble de ses salariés ?' },
      { id: 'S1-I2', esrs: 'S1', esrs_name: 'Effectifs propres', category: 'S', dimension: 'impact', target: 'internal', text: 'Dans quelle mesure l\'égalité de traitement (rémunération H/F, accès à la formation, diversité) est-elle effective au sein de votre organisation ?' },
      { id: 'S1-I3', esrs: 'S1', esrs_name: 'Effectifs propres', category: 'S', dimension: 'impact', target: 'internal', text: 'Dans quelle mesure vos politiques de santé et sécurité au travail réduisent-elles efficacement les accidents et maladies professionnelles ?' },
      { id: 'S1-I4', esrs: 'S1', esrs_name: 'Effectifs propres', category: 'S', dimension: 'impact', target: 'internal', text: 'Dans quelle mesure votre organisation investit-elle dans la formation, le développement des compétences et l\'employabilité de ses salariés ?' },
      { id: 'S1-I5', esrs: 'S1', esrs_name: 'Effectifs propres', category: 'S', dimension: 'impact', target: 'internal', text: 'Dans quelle mesure les mécanismes de dialogue social (représentants du personnel, négociations collectives) sont-ils effectifs et respectés dans votre organisation ?' },
      { id: 'S1-F1', esrs: 'S1', esrs_name: 'Effectifs propres', category: 'S', dimension: 'financial', target: 'all', text: 'Dans quelle mesure le turnover, les difficultés de recrutement ou les conflits sociaux constituent-ils un risque financier pour votre organisation ?' },
      { id: 'S1-F2', esrs: 'S1', esrs_name: 'Effectifs propres', category: 'S', dimension: 'financial', target: 'all', text: 'Dans quelle mesure la performance sociale (engagement, bien-être) est-elle corrélée à la productivité et à la compétitivité de votre organisation ?' },
      { id: 'S1-G1', esrs: 'S1', esrs_name: 'Effectifs propres', category: 'S', dimension: 'general', target: 'all', text: 'Dans quelle mesure les conditions de travail et la politique RH de votre organisation constituent-elles un sujet de préoccupation pour vos parties prenantes ?' },
    ],
  },
  {
    id: 'S2',
    name: 'Travailleurs de la chaîne de valeur',
    category: 'S',
    icon: '🔗',
    description: 'Conditions de travail et droits humains chez les fournisseurs, sous-traitants et toute la chaîne d\'approvisionnement',
    questions: [
      { id: 'S2-I1', esrs: 'S2', esrs_name: 'Travailleurs de la chaîne de valeur', category: 'S', dimension: 'impact', target: 'all', text: 'Dans quelle mesure votre organisation contrôle-t-elle et garantit-elle les conditions de travail chez ses fournisseurs et sous-traitants (audits, clauses contractuelles, certification) ?' },
      { id: 'S2-I2', esrs: 'S2', esrs_name: 'Travailleurs de la chaîne de valeur', category: 'S', dimension: 'impact', target: 'all', text: 'Dans quelle mesure votre chaîne d\'approvisionnement est-elle exposée à des risques de travail forcé, de travail des enfants ou de violations des droits humains fondamentaux ?' },
      { id: 'S2-I3', esrs: 'S2', esrs_name: 'Travailleurs de la chaîne de valeur', category: 'S', dimension: 'impact', target: 'all', text: 'Votre organisation a-t-elle mis en place une politique de devoir de vigilance formalisée couvrant ses fournisseurs et sous-traitants ?' },
      { id: 'S2-F1', esrs: 'S2', esrs_name: 'Travailleurs de la chaîne de valeur', category: 'S', dimension: 'financial', target: 'all', text: 'Dans quelle mesure les risques sociaux dans votre chaîne d\'approvisionnement (scandales, boycotts, disruptions) constituent-ils une menace pour votre activité commerciale ?' },
      { id: 'S2-F2', esrs: 'S2', esrs_name: 'Travailleurs de la chaîne de valeur', category: 'S', dimension: 'financial', target: 'all', text: 'Dans quelle mesure la loi sur le devoir de vigilance et les évolutions réglementaires sur la chaîne de valeur (CSDDD) créent-elles des obligations de conformité coûteuses pour votre organisation ?' },
      { id: 'S2-G1', esrs: 'S2', esrs_name: 'Travailleurs de la chaîne de valeur', category: 'S', dimension: 'general', target: 'all', text: 'Dans quelle mesure les conditions sociales dans votre chaîne d\'approvisionnement constituent-elles un sujet de préoccupation prioritaire pour vos clients et investisseurs ?' },
    ],
  },
  {
    id: 'S3',
    name: 'Communautés affectées',
    category: 'S',
    icon: '🏘️',
    description: 'Impacts sur les communautés locales, populations autochtones, riverains et territoires',
    questions: [
      { id: 'S3-I1', esrs: 'S3', esrs_name: 'Communautés affectées', category: 'S', dimension: 'impact', target: 'external', text: 'Dans quelle mesure vos activités génèrent-elles des nuisances pour les riverains et communautés locales (bruit, trafic, odeurs, risques industriels) ?' },
      { id: 'S3-I2', esrs: 'S3', esrs_name: 'Communautés affectées', category: 'S', dimension: 'impact', target: 'external', text: 'Dans quelle mesure votre organisation contribue-t-elle positivement au développement économique et social des territoires où elle est implantée (emploi local, achats locaux, mécénat) ?' },
      { id: 'S3-I3', esrs: 'S3', esrs_name: 'Communautés affectées', category: 'S', dimension: 'impact', target: 'all', text: 'Votre organisation consulte-t-elle les communautés locales et les parties prenantes territoriales avant de prendre des décisions qui les affectent ?' },
      { id: 'S3-F1', esrs: 'S3', esrs_name: 'Communautés affectées', category: 'S', dimension: 'financial', target: 'all', text: 'Dans quelle mesure les risques de contentieux, plaintes ou mouvements d\'opposition des communautés locales (syndrome NIMBY) constituent-ils une menace pour vos projets de développement ?' },
      { id: 'S3-F2', esrs: 'S3', esrs_name: 'Communautés affectées', category: 'S', dimension: 'financial', target: 'all', text: 'Dans quelle mesure la perte de "licence sociale d\'exploitation" auprès des communautés locales constitue-t-elle un risque opérationnel et financier significatif ?' },
      { id: 'S3-G1', esrs: 'S3', esrs_name: 'Communautés affectées', category: 'S', dimension: 'general', target: 'all', text: 'Dans quelle mesure votre organisation entretient-elle des relations structurées et régulières avec les communautés locales et acteurs du territoire ?' },
    ],
  },
  {
    id: 'S4',
    name: 'Consommateurs et utilisateurs finaux',
    category: 'S',
    icon: '🛒',
    description: 'Sécurité des produits, vie privée des consommateurs, information loyale et accessibilité',
    questions: [
      { id: 'S4-I1', esrs: 'S4', esrs_name: 'Consommateurs et utilisateurs finaux', category: 'S', dimension: 'impact', target: 'external', text: 'Dans quelle mesure vos produits et services sont-ils soumis à des processus rigoureux de contrôle de la sécurité et de la conformité réglementaire avant leur mise sur le marché ?' },
      { id: 'S4-I2', esrs: 'S4', esrs_name: 'Consommateurs et utilisateurs finaux', category: 'S', dimension: 'impact', target: 'external', text: 'Dans quelle mesure votre organisation garantit-elle la protection des données personnelles de ses clients et utilisateurs (RGPD, confidentialité, sécurité des données) ?' },
      { id: 'S4-I3', esrs: 'S4', esrs_name: 'Consommateurs et utilisateurs finaux', category: 'S', dimension: 'impact', target: 'external', text: 'Dans quelle mesure vos communications marketing sont-elles transparentes, loyales et exemptes d\'allégations trompeuses ou de greenwashing ?' },
      { id: 'S4-F1', esrs: 'S4', esrs_name: 'Consommateurs et utilisateurs finaux', category: 'S', dimension: 'financial', target: 'all', text: 'Dans quelle mesure votre organisation est-elle exposée à des risques de rappels de produits, de litiges consommateurs ou d\'actions en responsabilité produit ?' },
      { id: 'S4-F2', esrs: 'S4', esrs_name: 'Consommateurs et utilisateurs finaux', category: 'S', dimension: 'financial', target: 'all', text: 'Dans quelle mesure les réglementations sur la sécurité des produits (GPSR, directive machine) et la protection des consommateurs imposent-elles des contraintes de conformité croissantes à votre organisation ?' },
      { id: 'S4-G1', esrs: 'S4', esrs_name: 'Consommateurs et utilisateurs finaux', category: 'S', dimension: 'general', target: 'all', text: 'Dans quelle mesure la satisfaction, la fidélité et la confiance des consommateurs constituent-elles un facteur déterminant de la performance de votre organisation ?' },
    ],
  },
  {
    id: 'G1',
    name: 'Conduite des affaires',
    category: 'G',
    icon: '⚖️',
    description: 'Éthique des affaires, culture d\'entreprise, anti-corruption, gestion des fournisseurs, transparence fiscale',
    questions: [
      { id: 'G1-I1', esrs: 'G1', esrs_name: 'Conduite des affaires', category: 'G', dimension: 'impact', target: 'internal', text: 'Dans quelle mesure votre organisation dispose-t-elle d\'un code d\'éthique formalisé, diffusé et effectivement respecté par l\'ensemble du personnel ?' },
      { id: 'G1-I2', esrs: 'G1', esrs_name: 'Conduite des affaires', category: 'G', dimension: 'impact', target: 'internal', text: 'Dans quelle mesure votre organisation a-t-elle mis en place des dispositifs de prévention de la corruption et du trafic d\'influence (loi Sapin II, programme de conformité, formation) ?' },
      { id: 'G1-I3', esrs: 'G1', esrs_name: 'Conduite des affaires', category: 'G', dimension: 'impact', target: 'internal', text: 'Votre organisation dispose-t-elle d\'un système d\'alerte interne (whistleblowing) accessible, confidentiel et effectivement utilisé ?' },
      { id: 'G1-I4', esrs: 'G1', esrs_name: 'Conduite des affaires', category: 'G', dimension: 'impact', target: 'internal', text: 'Dans quelle mesure votre organisation gère-t-elle de façon transparente et documentée les conflits d\'intérêts au niveau de la direction et du conseil d\'administration ?' },
      { id: 'G1-I5', esrs: 'G1', esrs_name: 'Conduite des affaires', category: 'G', dimension: 'impact', target: 'all', text: 'Dans quelle mesure votre politique fiscale est-elle transparente et responsable (pas d\'optimisation fiscale agressive, publication des paiements d\'impôts) ?' },
      { id: 'G1-F1', esrs: 'G1', esrs_name: 'Conduite des affaires', category: 'G', dimension: 'financial', target: 'all', text: 'Dans quelle mesure votre organisation est-elle exposée à des risques financiers liés à des manquements éthiques (amendes réglementaires, sanctions pénales, poursuites judiciaires) ?' },
      { id: 'G1-F2', esrs: 'G1', esrs_name: 'Conduite des affaires', category: 'G', dimension: 'financial', target: 'all', text: 'Dans quelle mesure la réputation éthique de votre organisation influence-t-elle positivement l\'accès au capital (investisseurs ESG, financements verts, conditions bancaires) ?' },
      { id: 'G1-G1', esrs: 'G1', esrs_name: 'Conduite des affaires', category: 'G', dimension: 'general', target: 'all', text: 'Dans quelle mesure la gouvernance et l\'éthique des affaires constituent-elles un critère de différenciation et de confiance pour vos parties prenantes clés ?' },
    ],
  },
]

export const STAKEHOLDER_TYPES = [
  { value: 'employés', label: 'Employés & managers', category: 'interne' as const, icon: '👔' },
  { value: 'syndicats', label: 'Représentants syndicaux / CSE', category: 'interne' as const, icon: '🤝' },
  { value: 'actionnaires', label: 'Actionnaires / investisseurs', category: 'externe' as const, icon: '💼' },
  { value: 'clients', label: 'Clients & distributeurs', category: 'externe' as const, icon: '🛒' },
  { value: 'fournisseurs', label: 'Fournisseurs & sous-traitants', category: 'externe' as const, icon: '🔗' },
  { value: 'banques', label: 'Banques & établissements financiers', category: 'externe' as const, icon: '🏦' },
  { value: 'ong', label: 'ONG & associations', category: 'externe' as const, icon: '🌍' },
  { value: 'communautés', label: 'Communautés locales / riverains', category: 'externe' as const, icon: '🏘️' },
  { value: 'régulateurs', label: 'Régulateurs & autorités publiques', category: 'externe' as const, icon: '⚖️' },
  { value: 'médias', label: 'Médias & journalistes', category: 'externe' as const, icon: '📰' },
  { value: 'concurrents', label: 'Associations professionnelles', category: 'externe' as const, icon: '🏭' },
  { value: 'experts', label: 'Experts & académiques', category: 'externe' as const, icon: '🎓' },
  { value: 'autre', label: 'Autre', category: 'externe' as const, icon: '👤' },
]

export const MATERIALITY_THRESHOLD = 50
