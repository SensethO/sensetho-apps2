# Procédure de diligence raisonnée EUDR — Trading & Services

Version de travail 1 — 1er août 2026. Document destiné à devenir la procédure
opposable au sens de l'article 12 du règlement (UE) 2023/1115.

---

## 1. Base légale vérifiée

| Point | Valeur | Source |
|---|---|---|
| Date-butoir « zéro déforestation » | **31 décembre 2020**, inchangée | art. 2(13) |
| Entrée en application | **30 décembre 2026** — grandes et moyennes entreprises, plus micro et petites de la filière bois | art. 38 |
| | **30 juin 2027** — autres micro et petites entreprises | art. 38 |
| Conservation des pièces | **5 ans** | art. 33 |
| Géolocalisation | 6 décimales minimum ; **polygone au-delà de 4 ha**, point en deçà | art. 9 |
| Côte d'Ivoire, Ghana, Nigeria | **risque standard** — diligence complète, aucune simplification | référentiel pays du 22/05/2025 |
| Kenya | **risque faible** — diligence simplifiée | idem |

Le paquet de simplification du 4 mai 2026 n'a pas modifié le corps du règlement.
L'acte délégué du 13 juillet 2026 a retouché l'annexe I : ajout du café soluble
(conformité au 30/12/2027), exclusion du cuir et de quelques articles en
caoutchouc.

**Conséquence directe sur le calendrier envisagé** : viser une validation
« courant 2027 » place le dispositif après l'échéance. Si Trading & Services
est une grande ou moyenne entreprise, le système doit être opérationnel et
éprouvé **avant le 30 décembre 2026**.

---

## 2. Ce que la procédure proposée couvre bien

**Le double niveau de contrôle.** Un tri interne pour écarter vite les dossiers
inexploitables, puis une expertise externe pour établir la preuve. C'est
l'architecture juste, et elle est proportionnée au sens de l'article 10.

**Le refus de faire passer une image satellite libre de droits pour une preuve.**
C'est exactement la ligne à tenir. L'analyse interne est un outil de tri, jamais
un élément de preuve opposable.

**L'inclusion du travail des enfants, de la corruption et des droits fonciers
dans les audits.** Beaucoup d'opérateurs réduisent l'EUDR à la déforestation.
L'article 2(40) définit la « législation pertinente du pays de production »
comme couvrant aussi les droits d'usage des sols, les droits des tiers, le droit
du travail, les droits humains, le consentement libre, préalable et éclairé, la
fiscalité, la lutte anticorruption, les règles douanières et commerciales. Une
parcelle sans déforestation mais exploitée avec du travail d'enfants n'est pas
conforme. L'intuition est bonne.

**La présence locale pour l'authentification documentaire.** Réaliste, et
probablement la seule voie praticable dans les quatre pays visés.

---

## 3. Les corrections nécessaires

### 3.1 Le maillon manquant : relier le lot physique aux parcelles déclarées

C'est la lacune la plus sérieuse. La procédure décrit comment valider des
parcelles, jamais comment prouver que **le conteneur expédié provient de ces
parcelles-là**. En cacao ivoirien, la chaîne passe par des pisteurs et des
coopératives qui mélangent les récoltes : c'est précisément le point qu'un
contrôleur attaquera.

À mettre en place :

- **Réconciliation volumétrique** — rendement plausible par hectare × surface
  déclarée = plafond de volume achetable à ce fournisseur sur la campagne. Tout
  dépassement est une alerte bloquante.
- **Modèle de ségrégation documenté** — par coopérative, par magasin, par lot.
  Indiquer honnêtement s'il s'agit de ségrégation physique ou de bilan massique.
- **Traçabilité du bordereau d'achat** jusqu'au producteur, conservée 5 ans.

### 3.2 L'échantillonnage doit être piloté par le risque, pas par le calendrier

« Une parcelle par mois » ne se défend pas devant une autorité compétente : rien
ne relie l'effort de contrôle au niveau de risque. À remplacer par un plan
d'échantillonnage écrit :

- 100 % des parcelles classées à risque élevé au tri interne ou par l'expert ;
- un pourcentage du volume acheté, et non un nombre de parcelles ;
- tirage aléatoire documenté pour le reste, avec traçabilité de la méthode ;
- fréquence renforcée sur tout fournisseur ayant déjà fait l'objet d'un plan
  d'action.

### 3.3 Le point d'arrêt manque

L'article 4 interdit de mettre le produit sur le marché lorsque la diligence
révèle un risque non négligeable. La procédure décrit des plans d'action
correctifs, ce qui est juste pour le progrès continu, mais elle ne comporte
aucune décision de blocage. Il faut un statut explicite **« achat interdit »**,
prononcé par une personne nommée, journalisé, et qui empêche techniquement le
dépôt d'une DDS.

### 3.4 Le Kenya relève d'un autre régime

Classé à risque faible, il ouvre droit à la diligence simplifiée : collecte des
informations de l'article 9, sans obligation d'évaluation ni d'atténuation des
risques. Appliquer la procédure africaine complète au Kenya consomme des moyens
sans contrepartie réglementaire. À traiter par un régime distinct, révisable si
le classement change.

### 3.5 Le système de diligence raisonnée lui-même

L'article 12 impose un système formalisé, **réexaminé au moins une fois par an**.
S'y ajoute, pour les entreprises qui ne sont pas des PME, la désignation d'un
responsable de la conformité et une fonction d'audit indépendante (art. 11(3)).
La procédure décrit des activités ; il manque le document qui les gouverne, son
propriétaire, et la preuve de son réexamen annuel.

### 3.6 Deux dates ne suffisent pas à couvrir 2020-aujourd'hui

Comparer une image de 2020 à une image récente laisse passer une déforestation
survenue en 2022 puis replantée. Il faut une série annuelle, ou mieux, un jeu
d'alertes daté — ce que fournit déjà l'indicateur de perturbation post-2020 de
Whisp intégré à l'application.

### 3.7 Contrôles automatiques à ajouter au tri interne

Aux quatre contrôles envisagés, ajouter :

- système de coordonnées WGS84 (EPSG:4326) et précision ≥ 6 décimales ;
- anneaux fermés, absence d'auto-intersection et de sommets dupliqués ;
- polygone obligatoire au-delà de 4 ha ;
- surface calculée cohérente avec la surface déclarée ;
- parcelle effectivement située dans le pays déclaré ;
- **recouvrement entre parcelles** — double déclaration d'une même terre ;
- **polygone identique chez deux fournisseurs différents** ;
- recouvrement avec aires protégées et territoires autochtones ;
- surface implausible au regard du type d'exploitation ;
- couverture nuageuse et date réelle de l'image récente.

### 3.8 Corruption

Le sujet ne se traite pas par une bonne pratique locale mais par une règle
écrite : aucun paiement de facilitation, quelle que soit la pratique du pays ;
remontée immédiate au siège ; consignation dans l'application. Pour une société
française, la loi Sapin II s'applique en parallèle — et un paiement destiné à
obtenir l'authentification d'un document serait à la fois une infraction Sapin II
et un défaut de légalité au sens de l'article 2(40).

### 3.9 Le certificat remis à l'agriculteur

Utile comme levier de progrès, à condition qu'il ne soit jamais présenté comme
une preuve de conformité EUDR. Seule la déclaration de diligence raisonnée de
l'opérateur porte une valeur juridique.

### 3.10 « Bêta » n'est pas un statut acceptable

Une autorité compétente n'auditera pas un outil expérimental. Le système doit
garantir la conservation 5 ans, l'inaltérabilité des pièces, un journal des
décisions et une capacité d'export à la demande. Ces propriétés sont à
démontrer, pas à promettre.

---

## 4. Séquence proposée

| Étape | Échéance | Livrable |
|---|---|---|
| Détermination de la catégorie de taille de T&S | immédiat | conditionne le 30/12/2026 ou le 30/06/2027 |
| Système de diligence raisonnée formalisé (art. 12) | T+1 mois | document, propriétaire, revue annuelle |
| Tri interne outillé | T+1 mois | contrôles du 3.7 dans l'application |
| Contrat cadre avec l'expert déforestation | T+2 mois | périmètre, délais, format de preuve |
| Procédures documentaires par pays | T+2 mois | 4 fiches pays |
| Réconciliation volumétrique | T+3 mois | modèle et seuils |
| Plan d'échantillonnage d'audit | T+3 mois | méthode écrite |
| Questionnaires et fiches d'audit | T+3 mois | par poste |
| Répétition générale sur une campagne réelle | T+4 mois | avant le 30/12/2026 |

---

## 5. Points ouverts

- Catégorie de taille de Trading & Services au sens de l'article 38.
- Volume et nombre de parcelles concernés par campagne.
- Statut exact dans la chaîne : opérateur, mandataire, ou commerçant en aval —
  les obligations diffèrent.
- Choix de l'expert déforestation externe (Satelligence évalué le 01/08/2026).
