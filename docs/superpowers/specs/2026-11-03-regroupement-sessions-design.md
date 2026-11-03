# Regroupement automatique des sessions d'arrosage — Spécification

Date : 2026-11-03
Statut : en relecture
Complète : `2026-11-02-suivi-arrosage-design.md` (remplace les règles R3 et le calcul de la prochaine session)

## 1. Objectif

Aujourd'hui chaque plante suit son propre rythme : les dates dues se dispersent sur la semaine et produisent beaucoup de petites sessions. L'objectif est d'avoir **moins de sessions, chacune réunissant plus de plantes**, en arrosant chaque plante un peu en avance ou un peu en retard **dans une marge tolérée qui dépend de son rythme**.

### Décisions prises

- Regroupement **automatique**, sans jours de session fixes.
- Décalage autorisé **dans les deux sens** (avance et retard), dans une marge proportionnelle au rythme.
- Approche : **planification « au plus tard, en groupe »** — une session a lieu quand une plante ne peut plus attendre ; elle réunit toutes les plantes qui peuvent déjà être arrosées.
- Un réglage du logement permet de désactiver le regroupement (retour exact au comportement actuel).

### Critères de réussite

- Sur un ensemble de plantes aux rythmes variés, le nombre de jours de session diminue nettement (exemple §6 : 7 → 4 sur 12 jours).
- Aucune plante n'est arrosée hors de sa marge, sauf session manquée par l'utilisateur.
- Les plantes à rythme court (≤ 3 jours) ne sont jamais décalées.
- La session reste calculée à partir de l'historique (aucun planning stocké).
- Une seule notification par jour de session, aucune les autres jours.

### Hors périmètre

Optimisation globale sur un horizon (planification par solveur), jours de session fixes, marge réglable plante par plante.

## 2. Définitions

Toutes les dates sont des dates calendaires dans le fuseau du logement.

**Date idéale** d'une plante (inchangée, règle R1) : `nextDueDate(rythmes, dernierArrosage, aujourdhui, saisons)` — une plante jamais arrosée a pour date idéale la date du jour considéré.

**Intervalle** du rythme en vigueur à la date idéale (`rhythmOn(rythmes, dateIdéale, saisons)`) :

- `interval` : `everyDays` ;
- `weekly` : `7 × everyWeeks ÷ nombre de jours choisis` (ex. lundi + jeudi chaque semaine → 3,5 ; samedi toutes les 2 semaines → 14).

**Marge** (en jours, entier) :

- `0` si l'intervalle est ≤ 3 jours, ou si le regroupement est désactivé ;
- sinon `min(3, arrondi(0,2 × intervalle))`.

| Intervalle | 3 | 3,5 | 5 | 7 | 10 | 14 | 30 |
|---|---|---|---|---|---|---|---|
| Marge | 0 | 1 | 1 | 1 | 2 | 3 | 3 |

(`arrondi` = arrondi au plus proche, demi vers le haut : 0,7 → 1 ; 2,8 → 3.)

**Fenêtre** : `[ouverture, échéance] = [dateIdéale − marge, dateIdéale + marge]`.

Deux exceptions (ajoutées après relecture) :

- **Plante jamais arrosée** : fenêtre réduite au jour même (marge 0). Sinon, sa date idéale étant « aujourd'hui » chaque jour, sa fenêtre glisserait sans jamais se fermer.
- **Jours fixes arrosés en avance** : une occurrence dont la fenêtre contient déjà le dernier arrosage est consommée ; la date idéale suivante est cherchée après cette fenêtre (sinon la plante serait arrosée deux fois en deux jours).

## 3. Règles (remplacent R3)

**G1 — Calcul sans les arrosages du jour.** Pour le jour J, chaque plante est évaluée à partir de son dernier arrosage **strictement antérieur à J** (comme R3 aujourd'hui) : commencer à arroser ne fait pas disparaître la session.

**G2 — Déclenchement.** Il y a une session le jour J si au moins une plante a une **échéance ≤ J** (fin de fenêtre atteinte ou dépassée, ce qui inclut les plantes en retard).

**G3 — Contenu.** Si la session a lieu, elle contient toutes les plantes dont l'**ouverture ≤ J**. Chaque élément est « à faire » ou « fait » (arrosé le jour J, avec prénom et heure, comme aujourd'hui). S'il n'y a pas de session, la liste du jour est vide.

**G4 — Décalage affiché.**

- `joursAvance = max(0, dateIdéale − J)` → badge « en avance de N j » ;
- `joursRetard = J − dateIdéale` **uniquement si J > échéance**, sinon 0 → badge « en retard de N j » ;
- arroser après la date idéale mais dans la marge n'est pas signalé.

**G5 — Tri** (inchangé dans l'esprit) : par pièce (« Logement » en dernier), puis retard décroissant, puis nom.

**G6 — Planning à venir.** Une fonction pure simule les jours `J+1 … J+horizon` (horizon 60 jours) : chaque jour, on applique G2/G3 ; quand une session a lieu, chaque plante incluse est considérée arrosée ce jour-là pour la suite de la simulation. Les plantes à faire aujourd'hui et non arrosées sont considérées comme toujours dues (donc dans la prochaine session). Le résultat est la liste ordonnée des sessions futures `{ date, plantIds }`.

Utilisations :

- **Prochaine session** (écran Aujourd'hui) : première session simulée → `{ date, count }`.
- **Prochain arrosage prévu** d'une plante (fiche, liste) : date de la première session (aujourd'hui compris, si la plante y est à faire) qui l'inclut. Sans session dans l'horizon : la date idéale.

**G7 — Rappel** (R5 inchangée dans son mécanisme) : à l'heure de session, une notification si la session du jour contient au moins une plante à faire. Par G2, il n'y en a donc pas les jours sans session.

**G8 — Regroupement désactivé.** Toutes les marges valent 0 : G2/G3 se réduisent exactement à l'ancienne R3 (session = plantes de date idéale ≤ J), et le planning à venir à l'ancien calcul de prochaine session.

**Inchangé** : arrosage manuel à tout moment (y compris hors session), annulation, double appui ignoré.

## 4. Modèle et API

- **Logement** : nouveau champ `groupWaterings: boolean` (défaut `true`). Migration `0003_group_waterings.sql` : `ALTER TABLE household ADD COLUMN group_waterings INTEGER NOT NULL DEFAULT 1`. Ajoutée à la liste des migrations du Worker.
- `PATCH /api/household` accepte `groupWaterings` ; `HouseholdDto` l'expose.
- `SessionItemDto` : ajoute `daysEarly: number` ; `daysOverdue` suit la nouvelle définition (G4).
- `SessionDto.next` : inchangé dans sa forme, calculé par G6.
- `PlantSummaryDto` : `nextDue` devient le **prochain arrosage prévu** (G6) ; ajoute `idealDue` (date idéale) ; `daysOverdue` suit G4 appliqué à aujourd'hui.

## 5. Interface

- **Aujourd'hui**
  - Jour de session : liste regroupée comme aujourd'hui ; badge « en avance de N j » (style discret) en plus du badge de retard.
  - Jour sans session : carte « Pas de session aujourd'hui 🌱 » suivie de « Prochaine session : jeudi · 6 plantes ».
- **Fiche plante** : « Prochain arrosage » = date prévue ; si elle diffère de la date idéale, mention « Regroupé avec les autres plantes (idéalement mercredi) ».
- **Liste des plantes** : libellé basé sur la date prévue (« aujourd'hui », « dans 3 j », « en retard » selon G4).
- **Logement → Réglages** : interrupteur « Regrouper les arrosages » avec l'aide « Avance ou retarde un peu certaines plantes, dans une marge adaptée à leur rythme, pour arroser moins souvent. »

## 6. Exemple de référence (test)

Cinq plantes en rythme « tous les N jours », toutes arrosées le lundi 2026-11-02, regroupement activé, saison unique :

| Plante | Intervalle | Marge |
|---|---|---|
| E | 3 | 0 |
| A | 5 | 1 |
| B | 7 | 1 |
| C | 10 | 2 |
| D | 14 | 3 |

Sessions attendues du 03 au 14 novembre (en simulant les arrosages lors de chaque session) :

| Date | Plantes |
|---|---|
| jeu. 05 | E |
| dim. 08 | E, A, B |
| mer. 11 | E, C |
| sam. 14 | E, A, B, D |

Soit **4 jours de session**, contre **7** sans regroupement (05, 07, 08, 09, 11, 12, 14).

## 7. Architecture

- `src/domain/grouping.ts` (nouveau, pur) : `intervalDays(rhythm)`, `margin(rhythm, grouping)`, `wateringWindow(rhythms, lastWatered, day, bounds, grouping)` → `{ ideal, opens, closes }`.
- `src/domain/session.ts` : `buildSession` réécrit selon G1–G5 (paramètre `grouping: boolean`) ; `planSessions(candidates, today, bounds, grouping, horizon = 60)` (G6) remplace `nextSessionPreview` ; `nextPlannedDate(plantId, plan, …)` utilitaire.
- `src/application/watering.ts` et `plants.ts` : passent `household.groupWaterings` au domaine ; `plants.summaries/detail` utilisent le planning pour `nextDue`.
- Dépôt SQLite du logement : lecture/écriture de `group_waterings`.
- Interface : `Today.svelte`, `PlantDetail.svelte`, `Plants.svelte`, `Household.svelte`, `lib/format.ts`.

## 8. Tests

Vitest, centrés sur le domaine :

- marges : tableau du §2 (y compris hebdomadaire 3,5 et 14, rythme court, regroupement désactivé) ;
- déclenchement : pas de session quand aucune échéance n'est atteinte, session dès qu'une échéance l'est ;
- contenu : une plante dont la fenêtre est ouverte est incluse avec `daysEarly` correct ; une plante non ouverte ne l'est pas ;
- retard : session manquée → `daysOverdue = J − dateIdéale` ;
- G1 : la session du jour reste identique après arrosage d'une de ses plantes ;
- exemple de référence §6 : sessions et contenus exacts ; 7 sessions sans regroupement ;
- G8 : regroupement désactivé ⇒ mêmes sessions que l'ancien calcul sur l'exemple ;
- planning : prochain arrosage prévu d'une plante = date de la session qui l'inclut ;
- cas d'usage : rappel non envoyé un jour sans session ; réglage `groupWaterings` persistant.
