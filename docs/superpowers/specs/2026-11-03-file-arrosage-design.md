# File d'arrosage — Spécification

Date : 2026-11-03
Statut : en relecture
Remplace : les règles G2 (déclenchement de session), G3 et G6 (planning simulé) de `2026-11-03-regroupement-sessions-design.md`. Les marges et fenêtres (§2 de ce document, y compris ses deux exceptions) sont conservées.

## 1. Objectif

Laisser l'utilisateur **choisir le moment** de sa session : une **file d'arrosage** contient en permanence les plantes qui peuvent être arrosées ; l'utilisateur la traite quand il veut. L'application ne le **notifie** que lorsqu'une plante de la file **ne peut plus attendre**.

### Décisions prises

- Une plante **entre dans la file à l'ouverture de sa fenêtre** (date idéale − marge).
- Elle devient **urgente** le dernier jour de sa fenêtre (date idéale + marge) ; au-delà elle est en retard.
- **Notification** : au plus une par jour, à l'heure réglée du logement, les jours où au moins une plante urgente n'est pas arrosée ; donc **relance chaque jour** tant qu'il en reste.
- La file est **recalculée à partir de l'historique**, jamais stockée.

### Critères de réussite

- L'écran principal montre toujours la file (jamais « pas de session »).
- Aucune notification tant qu'aucune plante n'est urgente, même si la file est pleine.
- Une plante urgente non arrosée provoque une notification chaque jour jusqu'à son arrosage.
- Moins de code qu'aujourd'hui : plus de déclenchement de session ni de planning simulé.

### Hors périmètre

Historique « date d'entrée dans la file », notifications multiples dans la journée, marge réglable par plante.

## 2. Règles

Toutes les dates sont des dates calendaires dans le fuseau du logement. La **fenêtre** d'une plante est celle définie dans la spécification de regroupement (marge 0 à 3 jours ; plante jamais arrosée : fenêtre réduite au jour même ; jours fixes arrosés en avance : occurrence consommée). Réglage « Regrouper les arrosages » désactivé : marge 0.

**F1 — Calcul sans les arrosages du jour.** Pour le jour J, chaque plante est évaluée à partir de son dernier arrosage strictement antérieur à J (inchangé).

**F2 — Contenu de la file.** La file du jour J contient toutes les plantes dont l'**ouverture ≤ J**. Chaque élément est « à faire » ou « fait » (arrosé le jour J, avec prénom et heure). Une plante arrosée le jour J reste donc affichée comme faite jusqu'au lendemain.

**F3 — Urgence.**

- `urgent` : échéance (fin de fenêtre) ≤ J ;
- `daysOverdue` : `J − dateIdéale` si J > échéance, sinon 0 ;
- `daysLeft` : `échéance − J` si non urgente, sinon 0.

**F4 — Ordre.** D'abord les urgentes (retard décroissant, puis nom), puis les autres (`daysLeft` croissant, puis nom). La pièce n'intervient plus dans l'ordre ; elle est affichée sur chaque élément.

**F5 — Prochaine entrée.** Si aucune plante n'est à faire, la prochaine entrée est la plante dont l'ouverture (calculée **avec** les arrosages du jour) est la plus proche après J : `{ date, plantName }` (ex aequo : ordre alphabétique). Aucune si le logement n'a pas de plante.

**F6 — Rappel.** À l'heure de session, si `lastReminderDate ≠ J` : réserver le jour (inchangé), puis, si la file contient au moins une plante **urgente à faire**, envoyer **une** notification :

- titre `🌿 Arrosage` ;
- corps selon le nombre d'urgentes à faire (noms dans l'ordre F4) :
  - 1 : `Le Ficus ne peut plus attendre · 6 plantes dans la file`
  - 2 : `Le Ficus et le Basilic ne peuvent plus attendre · 6 plantes dans la file`
  - 3 et plus : `Le Ficus, le Basilic et 2 autres ne peuvent plus attendre · 6 plantes dans la file`
  - Le nom est précédé de « le » tel quel (pas d'accord) ; `N plantes dans la file` = éléments à faire ; `1 plante dans la file` au singulier.
- Le lendemain, la même règle s'applique : tant qu'une plante urgente n'est pas arrosée, le rappel repart chaque jour.

**F7 — Fiche plante.** `Prochain arrosage : idéalement <date idéale>` et `dans la file dès <ouverture>, urgente <échéance>` (fenêtre calculée avec les arrosages du jour). Si la plante est déjà dans la file : `dans la file depuis <ouverture>`.

**Inchangé** : arrosage manuel, « Tout arroser » (toute la file à faire), annulation, double appui ignoré, plante jamais arrosée urgente le jour même.

## 3. API

Route inchangée : `GET /api/session/today`. Réponse `QueueDto` :

```ts
type QueueItemDto = {
  plantId: string; name: string; roomName: string | null; mainPhotoUrl: string | null
  dueDate: string      // date idéale
  urgent: boolean
  daysOverdue: number
  daysLeft: number
  done: WateredDto | null
}
type QueueDto = {
  date: string
  items: QueueItemDto[]
  urgent: number        // urgentes à faire
  pending: number       // à faire
  total: number
  nextEntry: { date: string; plantName: string } | null
}
```

`PlantSummaryDto` : `nextDue` = date idéale ; `queueFrom` = ouverture ; `urgentFrom` = échéance ; `daysOverdue` (F3, à aujourd'hui). `idealDue` disparaît (redondant avec `nextDue`).

## 4. Interface

- Onglet renommé **« À arroser »** (anciennement « Aujourd'hui »), titre de page identique.
- Carte résumé : `2 urgentes · 6 dans la file` (formes singulières : `1 urgente`, `1 dans la file` ; sans urgente : `6 dans la file`), barre de progression des arrosages du jour (faits / total).
- Sections **« En priorité »** (urgentes) et **« Dans la file »** ; chaque carte montre la pièce, et un badge : `en retard de N j` (avertissement), `urgente` (avertissement) ou `encore N j` (discret).
- « Tout arroser » si au moins deux plantes à faire.
- File vide : `Rien à arroser pour l'instant 🌱` puis `Prochaine plante : Ficus, lundi`.
- Liste des plantes : `en retard de N j`, `urgente`, `dans la file` ou `dans N j` (jours avant l'entrée dans la file).
- Fiche plante : textes de F7.

## 5. Architecture

- `src/domain/queue.ts` (nouveau) : `buildQueue(candidates, day, bounds, grouping): QueueItem[]` (F1–F4) et `nextQueueEntry(plants, day, bounds, grouping)` (F5).
- `src/domain/session.ts` et ses tests sont **supprimés** (`buildSession`, `planSessions`) ; `SessionCandidate` est déplacé dans `queue.ts` sous le nom `QueueCandidate`.
- `src/domain/grouping.ts` : inchangé.
- `src/application/schedule.ts` : `loadSchedule` renvoie la file, la prochaine entrée et les fenêtres « avec les arrosages du jour » ; `plannedDate` disparaît.
- `src/application/watering.ts` : `today()` renvoie `QueueDto`.
- `src/application/reminder.ts` : condition F6 et texte F6 (`reminderPayload(urgentNames, queueSize)`).
- `src/application/plants.ts` : champs F7.
- Interface : `TabBar.svelte`, `Today.svelte`, `SessionCard.svelte`, `Plants.svelte`, `PlantDetail.svelte`, `lib/format.ts`.

## 6. Tests

- File : contenu (ouverture ≤ J), éléments faits conservés (F1/F2), urgence et retard, `daysLeft`, ordre F4.
- Prochaine entrée : plante la plus proche, file vide, logement sans plante.
- Plante jamais arrosée : urgente le jour même.
- Réglage désactivé : la file ne contient que les plantes dont la date idéale ≤ J.
- Rappel : aucune notification avec une file pleine sans urgente ; une notification si une urgente est à faire ; relance le lendemain si elle n'est pas arrosée ; aucune si elle a été arrosée ; textes pour 1, 2 et 3 urgentes, singulier/pluriel de la file.
- Fiche plante : `nextDue`, `queueFrom`, `urgentFrom`.
