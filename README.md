# Légendes sans croisement — script Adobe Illustrator

**LegendesSansCroisement.jsx** v1.0.0 — range les étiquettes de légende d'un schéma, d'une vue éclatée, d'une fiche produit, d'une planche d'anatomie ou d'une infographie en **colonnes (ou rangées) propres** et trace des **traits de rappel qui ne se croisent jamais**. Chaque étiquette garde **sa** cible : le script ne choisit que l'emplacement (l'ordre) qui donne la longueur totale de traits la plus courte.

*Tidies the callout labels of a diagram, exploded view, product sheet or infographic into clean columns (or rows) and draws leader lines that never cross. Each label keeps its own target; the script only picks the slot order that gives the shortest total leader length (FR/EN dialog).*

> **Statut : non testé dans Illustrator.** La syntaxe (ES3/ES5) et la logique ont été testées hors d'Illustrator (voir « Tests »). Travaillez sur une copie de votre fichier.

## Le problème

Sur une fiche technique, un mode d'emploi, une vue éclatée ou un schéma annoté, on place 6, 10, 20 légendes reliées à des points du dessin. Illustrator n'a **aucun outil de légende** : on tire chaque trait à la main, puis on passe du temps à **démêler les traits qui se croisent**, à réordonner les étiquettes dans la colonne, à les aligner et à les espacer régulièrement. Dès qu'une pièce bouge ou qu'une légende s'ajoute, tout est à refaire.

## Ce que fait le script

1. **Appariement** de chaque étiquette (objet texte) avec sa cible, dans cet ordre :
   - par les **traits déjà tracés** : un tracé ouvert dont un bout touche une étiquette relie cette étiquette à ce qui se trouve à l'autre bout (vous pouvez donc tirer des traits grossiers, même croisés : le script les remet au propre) ;
   - par le **nom** : un objet nommé « Batterie » dans le panneau Calques va avec l'étiquette « Batterie » ;
   - par la **proximité** : les étiquettes restantes vont aux cibles restantes, avec l'appariement de distance totale minimale (posez chaque étiquette à peu près près de sa pièce).
2. **Cibles** possibles : des **points d'ancrage** sélectionnés avec l'outil Sélection directe (seulement certains points d'un tracé), de **petits repères** (cercles, objets : leur centre), ou le **bout libre** d'un trait tiré depuis une étiquette.
3. **Disposition** au choix :
   - **colonnes gauche + droite** (chaque cible va du côté le plus proche), colonne à gauche, colonne à droite, **rangées haut + bas**, rangée en haut, rangée en bas : les étiquettes sont alignées au bord du dessin (marge réglable), placées au plus près de la hauteur de leur cible sans se chevaucher (ou réparties régulièrement), écarts selon la taille réelle de chaque étiquette ;
   - **garder les places** : les étiquettes restent aux emplacements que vous avez choisis, mais le script **échange** celles dont les traits se croisent ;
   - **ne pas déplacer** : trace seulement les traits depuis le bord de chaque étiquette.
4. **Traits** : coudés (départ horizontal de longueur réglable, puis oblique vers la cible) ou droits, écart texte → trait, épaisseur, point au bout (diamètre réglable) ou rien, noir (CMJN ou RVB selon le document) ou couleur du texte de l'étiquette. Les traits sont réunis dans un groupe « Traits de légende » placé au-dessus des étiquettes.
5. **Relance** : sélectionnez les étiquettes et les anciens traits (sans les cibles) puis relancez — les cibles sont lues au bout des traits, les anciens traits et points sont remplacés. Pratique après avoir déplacé une pièce ou ajouté une légende.
6. **Analyser** (dans la fenêtre) ne modifie rien : nombre d'étiquettes et de cibles, méthode d'appariement, étiquettes sans cible et cibles sans étiquette, croisements des traits actuels, croisements et longueur totale après, étiquettes qui se chevaucheraient, traits qui passeraient sur une autre étiquette, étiquettes qui sortiraient du plan de travail.

### Pourquoi les traits ne se croisent pas

Pour chaque colonne, le script calcule le coût (la longueur du trait) de chaque étiquette dans chaque emplacement et résout l'**affectation de coût minimal** (algorithme hongrois). Or, si deux traits droits se croisaient, échanger leurs deux départs raccourcirait strictement le total (inégalité triangulaire) : **un appariement de longueur totale minimale n'a donc aucun croisement**. Avec le trait coudé, le même raisonnement s'applique aux parties obliques, et les départs horizontaux restent dans le couloir entre la colonne et le dessin. Les colonnes gauche et droite ne peuvent pas se croiser entre elles (chaque côté reste de son côté du centre). Les positions des étiquettes sont trouvées par régression isotone (placement le plus proche des cibles sans chevauchement). En mode « garder les places », des échanges 2-opt suppriment les croisements restants.

## Pourquoi c'est nouveau

Vérifié avant d'écrire le script (octobre 2026) :

- **Illustrator** n'a pas d'outil de légende ni de traits de rappel automatiques ; le natif se limite au dessin manuel.
- **Labeler** (Candy1sh, GitHub) crée des étiquettes et des traits dans quatre directions à partir d'une liste, en escalier, sans lien avec des cibles ni contrôle des croisements.
- **AI Dimension** (SaidAuita, extension CEP) et les scripts de cotation (« AI measurment ») tracent des cotes et des lignes de repère pour un objet, sans ranger plusieurs légendes ni éviter les croisements.
- **illustrator-quote-plugin** (xuanheScript) annote des matériaux et dimensions, sans disposition des légendes.
- **creold** (catalogue complet, dont DrawPolyline), **Josh Duncan** et **Alexander Ladygin** (recherche de code « callout » / « leader » dans leurs dépôts) : rien pour les légendes reliées sans croisement.
- **MAPublisher LabelPro** (Avenza, payant) place les étiquettes de **cartes** à partir de données SIG ; ce n'est pas la mise en colonne de légendes d'un schéma ou d'un produit.
- Le placement de légendes en bordure avec traits non croisés existe dans des **bibliothèques web** (Eunoia, « boundary labeling » en recherche), pas dans Illustrator sur des textes et des tracés existants.
- Recherches GitHub « illustrator leader lines », « illustrator callout script », « leader line labels illustrator » : aucun résultat pertinent.

Idée écartée lors de la même recherche car déjà existante : contrôle de la hauteur des chiffres de la quantité nette selon la quantité (le script **ArtPreflight** le fait déjà pour Illustrator, et Esko Preflight contrôle une hauteur d'x minimale).

## Installation

- **Sans installer** : Fichier > Scripts > Autre script… puis choisissez `LegendesSansCroisement.jsx`.
- **Installé** : copiez le fichier dans le dossier `Presets/<langue>/Scripts` d'Illustrator (par exemple `Adobe Illustrator 2026/Presets/fr_FR/Scripts`), redémarrez Illustrator ; le script apparaît dans Fichier > Scripts.

## Utilisation

1. Placez les étiquettes (objets texte **non groupés**) à peu près près de leurs pièces, ou tirez un trait grossier depuis chaque étiquette.
2. Sélectionnez les étiquettes **et** les cibles : avec l'outil Sélection directe (A), cliquez les points visés en gardant Maj ; ou sélectionnez de petits repères ; ou les traits. Ne sélectionnez pas tout le dessin (chaque objet sélectionné serait pris pour une cible).
3. Lancez le script, choisissez la disposition, cliquez **Analyser** pour voir le résultat, puis **Appliquer**.
4. Pour annuler : Édition > Annuler.

Les réglages sont mémorisés dans un petit fichier texte du dossier de préférences de l'utilisateur. Les objets verrouillés ou masqués sont ignorés ; si le calque des étiquettes est verrouillé, rien n'est modifié.

## Compatibilité

Illustrator CC 2018 à 2026 (ExtendScript, ScriptUI), Windows et macOS. Dialogue en français ou en anglais selon la langue d'Illustrator. Aucun appel réseau, aucune collecte de données.

## Tests

Tests hors Illustrator (Node.js), dans `tests/` : `node tests/test-moteur.js` et `node tests/test-dom-simule.js`.

- **Moteur** (124 580 vérifications) : algorithme hongrois comparé à la force brute sur 400 matrices ; placement sans chevauchement (faisabilité, optimalité locale, positions déjà correctes inchangées) sur 500 cas ; 3 000 dispositions aléatoires (6 modes, coudé/droit, répartition près des cibles/régulière, écarts réels) : **0 croisement**, 0 chevauchement, aucun trait sur une autre étiquette, chaque trait finit sur sa cible, écart texte → trait respecté ; longueur totale minimale vérifiée par force brute ; « garder les places » sur 1 500 cas : 6 893 croisements sans échange → 0 avec échanges ; appariement par trait, par nom, par proximité.
- **DOM simulé** (36 vérifications, objets Illustrator factices) : fiche produit de 6 légendes sur des points d'ancrage, relance avec remplacement des anciens traits, messages (aucun document, rien de sélectionné, pas d'étiquette, pas de cible, anglais, Annuler, calque verrouillé), document RVB, couleur du texte, mode « ne pas déplacer », réglages enregistrés et relus.

Ces tests ne remplacent pas un essai dans Illustrator : **non testé dans Illustrator**.

## Licence

MIT © 2026 Amirouche Amwanes
