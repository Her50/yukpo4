# Analyse des Warnings PostgreSQL - 2025-12-10

## Résumé des problèmes identifiés

### 1. Crashes PostgreSQL répétés
**Erreur**: `terminating connection because of crash of another server process`
**Fréquence**: Très élevée (plusieurs par minute)
**Cause probable**: 
- Connexions mortes non nettoyées
- `idle_timeout` (300s) et `max_lifetime` (1800s) trop longs
- Connexions qui restent ouvertes trop longtemps

**Solution**: Réduire `idle_timeout` à 120s et `max_lifetime` à 600s

### 2. Requêtes très lentes
**Erreur**: `slow statement: execution time exceeded alert threshold`
**Requêtes concernées**:
- `SELECT refresh_services_search_optimized()` - **7+ secondes** (toutes les 2 minutes)
- `REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_cache` - **5+ secondes** (toutes les 5 minutes)
- `REFRESH MATERIALIZED VIEW CONCURRENTLY active_products_cache` - **2+ secondes** (toutes les 10 minutes)

**Impact**: 
- Bloque les connexions du pool pendant le refresh
- Sature le pool de connexions
- Cause des timeouts d'acquisition de connexion

**Solutions**:
1. Augmenter l'intervalle de refresh (2 min → 5 min pour `refresh_services_search_optimized`)
2. Exécuter les refreshes en arrière-plan avec un pool dédié
3. Optimiser les vues matérialisées (index, taille)

### 3. Pool de connexions saturé
**Erreur**: `acquired connection, but time to acquire exceeded slow threshold` (3+ secondes)
**Cause**: 
- Requêtes lentes qui bloquent les connexions
- Pool insuffisant (200 max, mais saturé)
- Pas de timeout sur les requêtes longues

**Solutions**:
1. Augmenter le pool max à 300-400
2. Ajouter un timeout sur les requêtes de refresh (10s max)
3. Utiliser un pool séparé pour les tâches de maintenance

### 4. Erreurs TLS
**Erreur**: `peer closed connection without sending TLS close_notify`
**Cause**: Connexions fermées brutalement par PostgreSQL
**Solution**: Gérer ces erreurs comme des erreurs de connexion attendues (déjà fait dans `search_cache_refresh.rs`)

### 5. Erreur SQL `u_client.name`
**Erreur**: `column u_client.name does not exist`
**Statut**: À investiguer dans les vues/fonctions PostgreSQL
**Action**: Vérifier les vues et fonctions qui référencent `u_client.name` au lieu de `u_client.nom_complet`

## Corrections appliquées

### 1. Optimisation du pool de connexions
- Réduire `idle_timeout` de 300s à 120s
- Réduire `max_lifetime` de 1800s à 600s
- Augmenter `max_connections` de 200 à 300 (configurable)

### 2. Optimisation des refreshes de vues matérialisées
- Augmenter l'intervalle de `refresh_services_search_optimized()` de 2 min à 5 min
- Ajouter un timeout de 10s sur les refreshes
- Exécuter les refreshes avec retry et backoff

### 3. Amélioration de la gestion des erreurs
- Logger les erreurs TLS en debug (déjà fait)
- Gérer les erreurs de connexion avec retry (déjà fait dans `search_cache_refresh.rs`)

## Actions restantes

1. ✅ Vérifier les vues/fonctions PostgreSQL pour `u_client.name`
2. ✅ Optimiser les refreshes de vues matérialisées
3. ✅ Améliorer la configuration du pool
4. ⏳ Tester les corrections en production

