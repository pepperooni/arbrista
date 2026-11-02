# Arrosoir — Spécification de conception

Date : 2026-11-02
Statut : en relecture

## 1. Objectif

Application mobile-first (PWA) permettant aux occupants d'un même logement de suivre l'arrosage de leurs plantes d'intérieur. L'application regroupe les arrosages en **sessions** : au plus une notification par jour, listant toutes les plantes à arroser, que n'importe quel occupant peut acquitter plante par plante.

### Critères de réussite

- Un occupant reçoit **une seule** notification par jour de session, jamais une par plante.
- Ouvrir la notification mène à la liste des plantes à arroser, regroupées par pièce.
- Quand un occupant acquitte une plante, elle disparaît de la session pour tous les occupants.
- Une plante peut être décrite complètement (identité, conseils, photos) et rattachée à une pièce.
- Le rythme d'arrosage reflète la saison (été / hiver).
- Installation : un conteneur, un volume de données.

### Contraintes

- Architecture minimaliste, stockage léger, un seul langage (TypeScript).
- Séparation claire des responsabilités (domaine pur, cas d'usage, adaptateurs).
- Tests ciblés sur la valeur fonctionnelle ; pas de tests d'infrastructure pour eux-mêmes.

### Hors périmètre

Plusieurs logements par instance, mode hors ligne complet (seule la coquille de l'app est mise en cache), identification de plante par photo ou IA, envoi d'e-mails, comptes avec mot de passe.

## 2. Modèle métier

### 2.1 Entités

| Entité | Attributs |
|---|---|
| **Household** (logement, unique par instance) | `name`, `inviteCode`, `sessionTime` (`HH:MM`, défaut `18:00`), `timezone` (IANA, défaut `Europe/Paris`), `summerStart` (`MM-DD`, défaut `04-01`), `winterStart` (`MM-DD`, défaut `10-01`), `lastReminderDate` (`YYYY-MM-DD` ou nul) |
| **Occupant** | `id`, `name`, `token` (secret aléatoire de 32 octets, stocké haché en SHA-256), `createdAt` |
| **Room** (pièce) | `id`, `name` (unique, non vide) |
| **Plant** | `id`, `name` (obligatoire), `scientificName?`, `description?`, `care` (voir 2.2), `roomId?` (nul = rattachée au logement), `summerRhythm` (obligatoire), `winterRhythm?` (nul = rythme d'été toute l'année), `createdAt` |
| **Photo** | `id`, `plantId`, `fileName`, `isMain`, `createdAt` |
| **Watering** (arrosage = acquittement) | `id`, `plantId`, `occupantId`, `wateredAt` (instant) |
| **PushSubscription** | `id`, `occupantId`, `endpoint` (unique), `p256dh`, `auth` |

### 2.2 Conseils d'entretien (`care`)

Champs tous facultatifs :

- `exposure` : `direct-sun` | `bright-indirect` | `partial-shade` | `shade`
- `humidity` : `low` | `medium` | `high`
- `watering` : texte libre (ex. « laisser sécher le substrat entre deux arrosages »)
- `temperature` : texte libre (ex. « 15–24 °C »)
- `notes` : texte libre

### 2.3 Rythmes d'arrosage

Un rythme est une union discriminée :

- `{ kind: "weekly", days: Weekday[] (≥ 1, 0 = lundi … 6 = dimanche), everyWeeks: entier ≥ 1, anchor: date }`
  Les jours de la semaine choisis, une semaine sur `everyWeeks`. La semaine (du lundi au dimanche) contenant `anchor` est une semaine active ; une semaine est active si le nombre de semaines qui la séparent de celle de l'ancre est multiple de `everyWeeks`. `anchor` vaut la date de création ou de modification du rythme.
- `{ kind: "interval", everyDays: entier ≥ 1 }`
  Tous les N jours après le dernier arrosage.

### 2.4 Saisons

Une date calendaire est en **été** si elle est dans `[summerStart, winterStart[` (cyclique sur l'année), sinon en **hiver**. Le rythme applicable à une date est `winterRhythm` en hiver s'il existe, sinon `summerRhythm`.

## 3. Règles de planification

Toutes les dates sont des dates calendaires dans le fuseau du logement. Le domaine ne lit jamais l'horloge système : la date courante lui est fournie.

**R1 — Prochaine date due.** Soit `L` la date du dernier arrosage de la plante (s'il existe).

- Si la plante n'a jamais été arrosée : elle est due **aujourd'hui**.
- Sinon, on cherche, en parcourant les dates `d` à partir de `L + 1` jour, la première date qui satisfait le rythme applicable à `d` (saison de `d`) :
  - `weekly` : `d` est un jour choisi d'une semaine active ;
  - `interval` : `d ≥ L + everyDays`.
- La recherche est bornée (366 jours × `everyWeeks` max) ; au-delà, c'est une erreur de programmation (rythme invalide refusé en amont).

**R2 — Retard sans cumul.** Une plante dont la date due est antérieure à aujourd'hui reste à arroser, avec un nombre de jours de retard = `aujourd'hui − date due`. Un seul arrosage la remet à jour (R1 repart de ce nouvel arrosage).

**R3 — Session du jour J.** Pour chaque plante, on calcule sa date due en ignorant les arrosages du jour J (c.-à-d. à partir du dernier arrosage antérieur à J). La session de J contient les plantes dont cette date due est ≤ J :
- **à faire** si la plante n'a pas d'arrosage le jour J ;
- **faite** sinon, avec le prénom de l'occupant et l'heure du premier arrosage du jour (« Arrosée par Léa »).

Une plante non due arrosée hors session le jour J n'apparaît pas dans la session. La session est **calculée**, jamais stockée.
Tri : par pièce (pièces par nom, puis « Logement » pour les plantes sans pièce), puis retard décroissant, puis nom.

**R4 — Acquittement.** Tout occupant peut créer un arrosage pour une plante. Un arrosage de la même plante dans la minute précédente rend l'opération idempotente (pas de doublon en cas de double appui ou d'acquittement simultané). Un arrosage peut être annulé (supprimé) ; la plante redevient due selon R1.

**R5 — Rappel de session.** À l'heure de session (`sessionTime`, fuseau du logement), si `lastReminderDate ≠ aujourd'hui` :

1. calculer la session du jour ;
2. si elle contient au moins une plante **à faire**, envoyer **une** notification à tous les abonnements push : titre « 🌿 Session d'arrosage », corps « N plante(s) à arroser aujourd'hui », lien `/` ;
3. enregistrer `lastReminderDate = aujourd'hui` (même si la session est vide).

Si le serveur démarre après l'heure de session et que le rappel du jour n'a pas été envoyé, il est envoyé au premier passage du planificateur.

**R6 — Photos.** Au plus une photo principale par plante. La première photo ajoutée devient principale. Supprimer la photo principale promeut la plus ancienne restante.

**R7 — Pièces.** Supprimer une pièce rattache ses plantes au logement (`roomId = nul`).

## 4. Accès et occupants

- **Création** : à la première ouverture, si aucun logement n'existe, l'écran d'accueil demande le nom du logement et le prénom ; le serveur crée le logement, le premier occupant et renvoie son jeton.
- **Invitation** : le lien `/join/<inviteCode>` (affiché aussi en QR code) permet de saisir un prénom ; le serveur crée l'occupant et renvoie son jeton. Le code peut être régénéré, ce qui invalide l'ancien lien (les occupants existants restent connectés).
- **Session** : le jeton est stocké dans le `localStorage` du téléphone et envoyé dans `Authorization: Bearer <token>`. Toute route `/api/*` hors création/invitation exige un jeton valide (401 sinon).
- Un occupant peut être retiré depuis l'écran Logement (son jeton et ses abonnements push sont supprimés ; ses arrosages restent dans l'historique sous son prénom).

## 5. Écrans (mobile-first)

Barre d'onglets en bas : **Aujourd'hui**, **Plantes**, **Logement**. PWA installable, thème clair/sombre selon le système, cibles tactiles ≥ 44 px.

### 5.1 Aujourd'hui

- En-tête « N plantes à arroser » + barre de progression (faites / total).
- Cartes groupées par pièce : photo principale, nom, badge « en retard de X j ».
- Bouton rond 💧 (ou balayage vers la droite) pour acquitter ; la carte passe en état « Arrosée par <prénom> » ; toast « Annuler » pendant 5 s.
- Bouton « Tout arroser » (acquitte toutes les plantes restantes de la session).
- État vide : « Tout est arrosé 🌱 » et aperçu de la prochaine session (date + nombre de plantes, recherche bornée aux 30 prochains jours).

### 5.2 Plantes

- Grille de vignettes (photo principale ou pictogramme par défaut), filtre par pièce (pastilles), recherche par nom / nom scientifique.
- **Fiche plante** : photo principale en grand, carrousel des autres photos, nom, nom scientifique, pièce, prochain arrosage, rythme(s) en clair (« Lun, Jeu · toutes les semaines »), pastilles de conseils (☀️ 💧 🌡️), description, historique des 20 derniers arrosages (« Léa · lun. 18:12 »).
- **Formulaire création / édition**, une page en sections repliables : Identité, Photos, Entretien, Rythme.
  - Photos : appareil photo ou galerie ; redimensionnement côté client (côté le plus long 1600 px, JPEG qualité 0.8) avant envoi ; ⭐ pour définir la principale ; suppression.
  - Rythme : sélecteur « Jours fixes » (L M M J V S D + « toutes les N semaines ») / « Tous les N jours » ; interrupteur « Rythme d'hiver différent » qui affiche le second sélecteur.
- Suppression d'une plante avec confirmation (supprime ses photos et son historique).

### 5.3 Logement

- Pièces : ajout, renommage, suppression (R7).
- Occupants : liste, « Inviter » (QR code + lien partageable via `navigator.share` si disponible), régénérer le code, retirer un occupant.
- Réglages : heure de session, dates de bascule des saisons, activer / désactiver les notifications sur cet appareil.
- Sur iOS hors mode installé : explication « Ajouter à l'écran d'accueil » requise pour les notifications.

## 6. Architecture

### 6.1 Pile technique

- **Runtime** : Node.js 22, TypeScript strict, ESM.
- **Serveur HTTP** : Hono (`@hono/node-server`).
- **Stockage** : SQLite via le module intégré `node:sqlite` ; migrations SQL versionnées appliquées au démarrage. Photos en fichiers sur disque.
- **Validation** : valibot.
- **Notifications** : Web Push (`web-push`), clés VAPID générées au premier démarrage et stockées dans le dossier de données.
- **Front** : Svelte 5 + Vite, `vite-plugin-pwa` (manifest + service worker gérant `push` et `notificationclick`), `qrcode` pour l'invitation.
- **Tests** : Vitest.

### 6.2 Structure et dépendances

```
src/
  domain/          pur, sans dépendance, sans I/O ni horloge
    rhythm.ts        types de rythme, validation, « la date d satisfait-elle le rythme »
    season.ts        saison d'une date, rythme applicable
    schedule.ts      prochaine date due (R1), retard (R2)
    session.ts       construction et tri de la session (R3)
    calendar.ts      utilitaires de dates calendaires (LocalDate)
    errors.ts        erreurs de domaine
  application/     cas d'usage, dépendent uniquement du domaine et des ports
    ports.ts         HouseholdRepository, OccupantRepository, RoomRepository, PlantRepository,
                     PhotoRepository, PhotoStorage, WateringRepository,
                     PushSubscriptionRepository, Notifier, Clock
    household.ts     créer le logement, rejoindre, réglages, invitation
    rooms.ts, plants.ts, photos.ts
    watering.ts      acquitter, annuler, session du jour, prochaine session
    reminder.ts      rappel de session (R5)
  infrastructure/  adaptateurs des ports
    sqlite/          connexion, migrations, dépôts
    fs-photo-storage.ts, web-push-notifier.ts, system-clock.ts, vapid.ts
  server/          entrée HTTP
    app.ts           création de l'app Hono à partir des cas d'usage (testable)
    routes/*.ts      routes fines : valider → appeler le cas d'usage → sérialiser
    auth.ts          middleware jeton
    scheduler.ts     setInterval(60 s) → reminder
    main.ts          composition racine (instancie adaptateurs + cas d'usage) et démarrage
  shared/
    api-types.ts     types DTO partagés front / serveur
web/               front Svelte (pages, composants, client API typé, service worker)
tests/
  domain/, application/, api/
```

Règle : `server` → `application` → `domain` ; `infrastructure` implémente les ports de `application`. `web` ne connaît que `shared/api-types.ts` et l'API HTTP.

### 6.3 API HTTP (JSON)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/setup` | `{ initialized: boolean }` |
| POST | `/api/setup` | créer logement + premier occupant → `{ token, occupant }` |
| POST | `/api/join/:code` | rejoindre → `{ token, occupant }` |
| GET / PATCH | `/api/household` | lire / modifier réglages |
| POST | `/api/household/invite` | régénérer le code d'invitation |
| GET | `/api/occupants` · DELETE `/api/occupants/:id` | lister / retirer |
| GET / POST | `/api/rooms` · PATCH / DELETE `/api/rooms/:id` | pièces |
| GET / POST | `/api/plants` · GET / PATCH / DELETE `/api/plants/:id` | plantes (le détail inclut photos, prochaine date due, historique) |
| POST | `/api/plants/:id/photos` (multipart) | ajouter une photo (≤ 5 Mo, JPEG/PNG/WebP) |
| POST | `/api/photos/:id/main` · DELETE `/api/photos/:id` | définir principale / supprimer |
| GET | `/api/session/today` | session du jour + aperçu de la prochaine |
| POST | `/api/plants/:id/waterings` · DELETE `/api/waterings/:id` | acquitter / annuler |
| GET | `/api/push/public-key` · POST / DELETE `/api/push/subscriptions` | Web Push |
| GET | `/photos/:fileName` | fichiers photo (noms aléatoires non devinables) |

Le reste est servi en statique depuis le build du front, avec repli sur `index.html`.

### 6.4 Exécution et déploiement

- Un seul processus Node : API, photos, front statique, planificateur.
- Variables : `PORT` (défaut 3000), `DATA_DIR` (défaut `./data`), `VAPID_SUBJECT` (mailto: ou URL, défaut `mailto:admin@localhost`).
- `DATA_DIR` contient `arrosoir.db`, `photos/`, `vapid.json` ; la sauvegarde consiste à copier ce dossier.
- `Dockerfile` multi-étapes (build front + serveur, image d'exécution Node 22 slim) ; volume `/data`.
- HTTPS requis pour Web Push et l'installation PWA (assuré par un reverse proxy, hors périmètre).

## 7. Gestion des erreurs

- Entrées HTTP validées par schémas valibot → 400 avec message lisible.
- Erreurs de domaine : `ValidationError` → 400, `NotFoundError` → 404, `UnauthorizedError` → 401 ; toute autre erreur → 500 journalisée sans détail exposé.
- Web Push : réponse 404/410 → suppression de l'abonnement ; autre échec → journalisé, n'interrompt pas l'envoi aux autres appareils ; `lastReminderDate` est enregistré même en cas d'échec partiel.
- Front : mise à jour optimiste de l'acquittement, annulée avec un toast d'erreur si le serveur répond en échec ; toast générique en cas d'erreur réseau.

## 8. Stratégie de tests

Vitest, environ 25 à 30 tests, centrés sur le comportement :

- **Domaine** : rythme hebdomadaire multi-jours ; une semaine sur N ; intervalle ; plante jamais arrosée ; retard sans cumul ; bascule été → hiver et hiver → été ; absence de rythme d'hiver ; validation des rythmes ; tri et regroupement de la session.
- **Cas d'usage** (dépôts en mémoire, horloge et notifier factices) : acquittement retire la plante de la session ; idempotence d'un double acquittement ; annulation ; rappel envoyé une seule fois par jour ; pas de notification si session vide ; rappel rattrapé après redémarrage ; suppression d'un abonnement expiré ; photo principale (R6) ; suppression de pièce (R7).
- **API bout en bout** (SQLite `:memory:`, notifier factice) : création du logement → invitation → création de plante → session du jour → acquittement par le second occupant visible par le premier ; requête sans jeton → 401.

Pas de tests unitaires des dépôts SQLite ni des composants Svelte pris isolément ; les dépôts sont couverts par les tests API.
