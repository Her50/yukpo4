# Staging Backend – Yukpo Delivery

Ce guide décrit les étapes pour disposer d’un backend stable afin de faire tourner les tests E2E (Detox/Maestro) sans mock.

## 1. Environnement isolé

1. Provisionner une base PostgreSQL dédiée au staging (ex. `yukpo_staging`), avec les extensions `postgis`, `pgcrypto`, `uuid-ossp`.
2. Déployer le backend Rust (binaire principal) sur une VM ou un namespace Kubernetes séparé avec les variables :
   ```
   DATABASE_URL=postgres://user:pass@host/yukpo_staging
   REDIS_URL=redis://host:6379/
   MONGODB_URL=mongodb://host:27017
   ENABLE_STAGING_DEMO_SEED=true          # optionnel : seed auto via auto_migrate
   ```
3. Activer les migrations auto : le binaire appelle `run_auto_migrations` au démarrage. Vérifier qu’aucune erreur n’est levée.
4. Exposer l’API via un endpoint HTTPS (ex. `https://staging.api.yukpo.com`) et, si nécessaire, configurer un sandbox LiveKit/Live streaming pour ne pas impacter la production.

## 2. Seeds déterministes

Le script `backend/scripts/seed_delivery_staging.sql` insère :

- un client `staging-client@yukpo.com`,
- un coursier `staging-courier@yukpo.com` (statut approved, engin moto),
- une livraison shopping (statut `accepted`) alignée sur les coordonnées utilisées dans les tests Detox/Maestro.

### Exécution

```
psql "$DATABASE_URL" -f backend/scripts/seed_delivery_staging.sql
```

Idéalement exécuter ce script avant chaque campagne E2E (via job CI) pour garantir un état propre. Le script utilise `ON CONFLICT` pour rester idempotent.  
> Alternative : activer `ENABLE_STAGING_DEMO_SEED=true` pour laisser `auto_migrate` injecter automatiquement ces données à chaque démarrage.

## 3. Pipeline CI

1. Ajouter un job GitHub Actions (ou Hetzner CI) qui :
   - déploie la dernière image backend sur le staging,
   - exécute le seed ci-dessus.
2. Mettre à jour les secrets GitHub (`STAGING_DATABASE_URL`, `STAGING_API_URL`, etc.).
3. Lancer ensuite les suites Detox/Maestro avec :
   ```
   EXPO_PUBLIC_API_BASE_URL=https://staging.api.yukpo.com \
   EXPO_PUBLIC_WS_BASE_URL=wss://staging.api.yukpo.com \
   npm run detox:test:android
   ```

## 4. Nettoyage & reset

Pour garantir un état reproductible :

- option 1 : réinitialiser la base après chaque suite (`DROP DATABASE` / `CREATE DATABASE` + migrations + seed),
- option 2 : conserver la base mais supprimer la livraison staging après usage (`DELETE FROM deliveries WHERE metadata->>'seed' = 'staging_delivery'`).

## 5. Modules pendants

Avant d’exposer le staging aux E2E, vérifier :

- `live_stream_service` / `live_flash_sale_service` : la compilation est revenue au vert, mais planifier une campagne de tests dédiés (LiveKit, SRS) pour garantir que les endpoints ne cassent pas (`cargo test --features live-stream` si un feature flag est ajouté).
- Observabilité : Sentry, Prometheus (`/metrics/delivery`), logs JSON.

Une fois ces éléments en place, vous pouvez désactiver le mock Detox et consommer directement le backend staging.

