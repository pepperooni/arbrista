# Arrosoir 🌿

Arrosoir est une application mobile (PWA) pour suivre l'arrosage des plantes de la maison, à plusieurs.

- **Fiches plantes** : nom, nom scientifique, description, conseils (exposition, humidité, température…) et photos, dont une photo principale qui identifie la plante.
- **Pièces** : chaque plante appartient au logement, et on peut la ranger dans une pièce.
- **Rythmes d'arrosage** : jours fixes (par ex. lundi et jeudi, toutes les N semaines) ou « tous les N jours après le dernier arrosage ». Un rythme d'hiver distinct est possible.
- **Sessions d'arrosage** : chaque jour, l'application regroupe les plantes dues ou en retard en une seule liste. Une seule notification par session est envoyée, jamais une par plante.
- **Partage** : tous les occupants du logement voient la même session, et chacun peut acquitter une plante (« Arrosée par Léa »).

## Démarrer en local

Prérequis : Node.js 22.18 ou plus récent.

```bash
npm install
npm run dev:server   # API sur http://localhost:3000
npm run dev:web      # interface sur http://localhost:5173 (avec rechargement à chaud)
```

Ouvrez http://localhost:5173, créez le logement, puis invitez les autres occupants depuis l'onglet **Logement** (QR code ou lien).

Pour servir l'application complète comme en production :

```bash
npm run build && npm start   # http://localhost:3000
```

## Tests

```bash
npm test             # tests métier et API (Vitest)
npm run typecheck    # TypeScript côté serveur
npm run check        # TypeScript et Svelte côté interface
```

Les tests couvrent le comportement métier : calcul des dates d'arrosage, saisons, sessions, acquittement partagé, rappel unique et parcours de l'API. Ils tournent sur une base SQLite en mémoire.

## Déploiement (Docker)

```bash
docker build -t arrosoir .
docker run -d --name arrosoir -p 3000:3000 -v arrosoir-data:/data arrosoir
```

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port HTTP |
| `DATA_DIR` | `./data` (`/data` dans l'image) | Base SQLite, photos et clés de notification |
| `VAPID_SUBJECT` | `mailto:admin@localhost` | Contact transmis aux services de notification. Mettez votre adresse. |

- **HTTPS est obligatoire** pour les notifications et l'installation sur l'écran d'accueil. Placez un reverse proxy devant le conteneur (Caddy, Traefik, nginx…).
- **iPhone** : les notifications ne fonctionnent qu'après « Partager → Sur l'écran d'accueil » (iOS 16.4 ou plus récent).
- **Sauvegarde** : copiez le dossier de données (`arrosoir.db`, `photos/`, `vapid.json`). Si vous perdez `vapid.json`, chaque appareil devra réactiver ses notifications.

## Architecture

Un seul langage (TypeScript), un seul processus Node, un fichier SQLite.

```
src/domain/          Règles métier pures : dates, rythmes, saisons, échéances, sessions
src/application/     Cas d'usage et ports (interfaces vers le stockage, l'horloge, les notifications)
src/infrastructure/  Adaptateurs : SQLite (node:sqlite), fichiers photo, Web Push
src/server/          API HTTP (Hono), authentification par jeton, planificateur, composition
src/shared/          Types échangés entre l'API et l'interface
web/                 Interface Svelte 5 (PWA) : pages, composants, service worker
tests/               Vitest : domaine, cas d'usage, API
```

**Règle de dépendances** : `server` dépend de `application`, qui dépend de `domain`. `infrastructure` implémente les ports définis par `application`. Le domaine ne fait aucune entrée-sortie et ne lit jamais l'horloge : la date courante lui est toujours fournie.

**Sessions** : une session n'est pas stockée. Elle est recalculée à partir de l'historique des arrosages, qui reste la seule source de vérité. Le planificateur vérifie chaque minute si l'heure de session est passée et envoie au plus un rappel par jour, même après un redémarrage.

La conception détaillée se trouve dans `docs/superpowers/specs/`.
