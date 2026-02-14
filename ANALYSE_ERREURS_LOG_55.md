# 📊 Analyse des Erreurs - Log 55

## 🔍 Erreurs Identifiées

### 1. ❌ `column e.status does not exist`
- **Erreur** : `process_scheduler global promos failed: Database("error returned from database: column e.status does not exist")`
- **Service** : `global_promo_service`
- **Fonction** : `process_scheduler_inner` → probablement dans une des fonctions appelées
- **Hypothèse** : Une requête utilise `e` comme alias pour `global_promo_events` au lieu de `ev`

### 2. ❌ `column "last_error" does not exist`
- **Erreur** : `[SocialDistribution] Fetch jobs error: Database("error returned from database: column \"last_error\" does not exist")`
- **Service** : `social_distribution_service`
- **Table** : `social_publication_jobs`
- **Colonne** : `last_error`

## ✅ Points Positifs

- ✅ **Redis fonctionne** : `✅ [Redis] Health check réussi - Redis disponible`
- ✅ **Pas d'erreurs Redis timeout** (timeout 10s fonctionne)
- ✅ **Vue matérialisée rafraîchie** : `✅ Vue matérialisée services_search_optimized_v2 rafraîchie`

## 🔍 Analyse

### Problème 1 : `e.status` pour `global_promo_events`

Les requêtes dans `global_promo_service.rs` utilisent :
- `e` = alias pour `global_promo_entries`
- `ev` = alias pour `global_promo_events`

Mais l'erreur dit `column e.status does not exist` - cela signifie qu'une requête utilise probablement `e` comme alias pour `global_promo_events` quelque part.

**Hypothèse** : Il y a peut-être une requête qui utilise `FROM global_promo_events e` au lieu de `FROM global_promo_events ev`.

### Problème 2 : `last_error` manquant

La colonne `last_error` existe dans la migration SQL `00000017_create_social_media_tables.sql` (ligne 55), mais elle n'est peut-être pas ajoutée automatiquement par `auto_migrate.rs`.

## 🎯 Actions à Prendre

1. Chercher toutes les requêtes qui utilisent `FROM global_promo_events e` (sans `v`)
2. Vérifier si `last_error` est ajoutée dans `ensure_social_publication_jobs_columns()`
3. Vérifier si la vue matérialisée `global_promo_catalog_cache` doit être rafraîchie

