# 💩 Poopedex

Note les toilettes publiques du monde — et attrape-les toutes.

Vernis ludique (gamification : poops, stats, badges), but réel : aider les gens à
trouver des toilettes publiques correctes grâce à un système de notation poussé
(propreté, sécurité, hygiène, inclusivité).

## Architecture

Monorepo **API-first** : le front et un futur client natif consomment la même API.

| Module | Rôle | Stack |
|--------|------|-------|
| `api/` | Backend REST, seule porte vers les données | Node + TypeScript + Fastify |
| `web/` | PWA mobile-first (« fausse app » sans store) | React + Vite + MapLibre + Tailwind |
| `packages/shared/` | Types & règles métier partagés (Zod, scoring) | TypeScript |

**Base de données** : PostgreSQL 16+ avec **PostGIS** (requêtes géospatiales = cœur du projet).
**Données toilettes** : importées d'**OpenStreetMap** (`amenity=toilets`) via Overpass,
**automatiquement** quand un user consulte une zone (cache par tuile z14, TTL 7 j).
**Carte** : MapLibre GL + tuiles vectorielles (MapTiler / Protomaps).

## Décisions clés

- **Check-in** : validé **côté serveur**. Rayon autorisé = `30 m + précision GPS`, plafonné à 50 m.
  Le GPS d'un smartphone fait 5–50 m d'erreur ; 10 m serait inutilisable.
- **Pas de photos.** Volontaire (modération, stockage, légal… et bon sens).
- **RGPD** : suppression de compte → notes **anonymisées** (conservées car utiles à tous),
  le reste (badges, amis, historique) est supprimé.
- **Notation hygiène/inclusivité** : flags factuels (savon/papier/poubelle…) → score dérivé,
  plus utile et fiable qu'une étoile subjective.
- **Ajout de toilette par un user** : placée à sa position (sur place), **1 / 24 h**,
  refusée si une toilette existe déjà à moins de **100 m** (anti-doublon).
- **Ingestion OSM** : automatique à la consultation de la carte ; ré-ingestion manuelle
  possible : `pnpm --filter @poopedex/api ingest -- <lat> <lng> [rayon_m]`.

## Lancer en dev

```bash
# 0. Dépendances + fichiers d'environnement
pnpm install
cp api/.env.example api/.env   # DATABASE_URL, JWT_SECRET…
cp web/.env.example web/.env   # VITE_API_URL, VITE_MAP_STYLE

# 1. Base : un PostGIS local (exemple Docker, port 5432 comme dans .env.example)
docker run -d --name poopedex-db -e POSTGRES_PASSWORD=poopedex \
  -e POSTGRES_USER=poopedex -e POSTGRES_DB=poopedex \
  -p 5432:5432 postgis/postgis:16-3.4

# 2. Migrations + seed des badges (lit api/.env)
pnpm db:migrate

# 3. API (port 3000)
pnpm --filter @poopedex/api dev

# 4. Web PWA (port 5173)
pnpm --filter @poopedex/web dev
```

> `pnpm db:migrate` lit `api/.env` : crée-le (étape 0) **avant** de migrer.

La carte utilise par défaut **OpenFreeMap** (tuiles OSM vectorielles, sans clé).
Le navigateur demandera l'autorisation de géolocalisation pour afficher ta position
et les toilettes autour. Pour tester sur ton téléphone, sers le front sur le réseau
local (`pnpm --filter @poopedex/web dev --host`) et ouvre l'URL depuis le mobile.
