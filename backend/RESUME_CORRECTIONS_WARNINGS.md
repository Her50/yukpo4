# Résumé des Corrections des Warnings PostgreSQL - 2025-12-10

## Problèmes identifiés et corrigés

### ✅ 1. Crashes PostgreSQL répétés
**Problème**: `terminating connection because of crash of another server process`
**Cause**: Connexions mortes non nettoyées, timeouts trop longs
**Correction appliquée**:
- `idle_timeout` réduit de 300s à **120s** (2 min)
- `max_lifetime` réduit de 1800s à **600s** (10 min)
- Fichier modifié: `backend/src/main.rs` (lignes 92-93)

### ✅ 2. Requêtes très lentes
**Problème**: `refresh_services_search_optimized()` prend 7+ secondes
**Correction appliquée**:
- Intervalle de refresh augmenté de 2 min à **5 min** (configurable via `SEARCH_CACHE_REFRESH_INTERVAL_SECS`)
- Timeout de 10s ajouté sur les refreshes pour éviter de bloquer le pool
- Fichier modifié: `backend/src/tasks/search_cache_refresh.rs`

### ✅ 3. Pool de connexions saturé
**Problème**: `time to acquire exceeded slow threshold` (3+ secondes)
**Correction appliquée**:
- Pool max augmenté de 200 à **300** (configurable via `DB_POOL_SIZE`)
- Fichier modifié: `backend/src/main.rs` (ligne 73)

### ✅ 4. Erreurs TLS
**Problème**: `peer closed connection without sending TLS close_notify`
**Correction appliquée**:
- Gestion des erreurs TLS déjà implémentée dans `search_cache_refresh.rs` avec retry et backoff
- Erreurs loggées en debug (non critiques)

### ✅ 5. Erreur SQL `u_client.name`
**Problème**: `column u_client.name does not exist`
**Action**: Migration SQL créée pour diagnostiquer le problème
- Fichier créé: `backend/migrations/20251210_fix_u_client_name_error.sql`
- Cette migration vérifie toutes les vues/fonctions PostgreSQL qui référencent `u_client.name`
- À exécuter pour identifier la source du problème

## Fichiers modifiés

1. **`backend/src/main.rs`**:
   - Pool max: 200 → 300
   - `idle_timeout`: 300s → 120s
   - `max_lifetime`: 1800s → 600s
   - Commentaires mis à jour

2. **`backend/src/tasks/search_cache_refresh.rs`**:
   - Intervalle de refresh: 2 min → 5 min (configurable)
   - Timeout de 10s ajouté sur les refreshes
   - Gestion améliorée des timeouts

3. **`backend/migrations/20251210_fix_u_client_name_error.sql`**:
   - Migration de diagnostic pour l'erreur `u_client.name`

## Variables d'environnement ajoutées

- `SEARCH_CACHE_REFRESH_INTERVAL_SECS`: Intervalle de refresh du cache de recherche (défaut: 300s = 5 min)
- `DB_POOL_SIZE`: Taille max du pool de connexions (défaut: 300)

## Actions restantes

1. ⏳ Exécuter la migration `20251210_fix_u_client_name_error.sql` pour diagnostiquer l'erreur `u_client.name`
2. ⏳ Tester les corrections en production
3. ⏳ Monitorer les logs pour vérifier la réduction des warnings

## Impact attendu

- **Réduction des crashes PostgreSQL**: Connexions nettoyées plus rapidement (120s au lieu de 300s)
- **Réduction des timeouts d'acquisition**: Pool plus grand (300 au lieu de 200)
- **Réduction de la charge**: Refreshes moins fréquents (5 min au lieu de 2 min)
- **Meilleure stabilité**: Timeout sur les refreshes pour éviter les blocages

