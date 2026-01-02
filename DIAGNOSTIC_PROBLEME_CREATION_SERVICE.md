# 🔍 Diagnostic - Problème Création de Service

**Date**: 2025-12-30  
**Problème**: Échec de création de produits/services avec erreurs "Network request failed" et "Aborted"

## 📊 Analyse des Logs Backend

### 1. Requêtes `/api/services/create` qui échouent

Les logs montrent des requêtes qui retournent rapidement (82-607ms) avec seulement **508 bytes** de réponse :

```
[POST] yukpomnang.onrender.com/api/services/create
responseTimeMS=82 responseBytes=508
responseTimeMS=607 responseBytes=508
responseTimeMS=94 responseBytes=508
```

**Analyse** : 508 bytes correspond probablement à une réponse d'erreur `{"error": "..."}` (BadRequest 400), ce qui suggère que :
- La validation échoue côté backend
- Le payload est rejeté avant traitement

### 2. Base de données surchargée ⚠️ CRITIQUE

#### Pool de connexions saturé
```
"acquired connection, but time to acquire exceeded slow threshold"
aquired_after_secs=5.064704189 (jusqu'à 5 secondes d'attente!)
```

#### Requêtes SQL très lentes
- `REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_cache`: **8.7 secondes**
- `refresh_services_search_optimized()`: **11 secondes**
- `SELECT FROM deliveries`: **1-2 secondes** (devrait être <100ms)
- `UPDATE delivery_matching_queue`: **1-2 secondes**
- `SELECT 1` (test de connexion): **1-2 secondes** (très mauvais signe!)

#### Connexions qui crashent
```
"terminating connection because of crash of another server process"
"error communicating with database: peer closed connection without sending TLS close_notify"
```

### 3. Problèmes de configuration

Le pool de connexions est configuré avec :
- `max_connections`: 50
- `min_connections`: 10
- `acquire_timeout`: 30 secondes
- `max_lifetime`: 180 secondes (3 minutes)
- `idle_timeout`: 120 secondes (2 minutes)

Mais malgré cela, le pool est saturé, indiquant soit :
1. Trop de requêtes simultanées
2. Des requêtes qui prennent trop de temps (bloquent les connexions)
3. Des connexions qui ne sont pas libérées correctement

## 🔧 Solutions Recommandées

### Solution 1 : Améliorer la gestion d'erreur côté client ✅ FAIT

**Fichiers modifiés** :
- `mobile/src/services/api.ts` : Meilleure détection des erreurs réseau/timeout
- `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx` : Messages d'erreur plus clairs

**Améliorations** :
- Détection des codes d'erreur `TIMEOUT` et `NETWORK_ERROR`
- Retry automatique pour erreurs réseau temporaires
- Messages utilisateur contextuels avec conseils pratiques

### Solution 2 : Optimiser le pool de connexions DB (À FAIRE)

**Problème** : Le pool est saturé malgré 50 connexions max.

**Recommandations** :

1. **Réduire le timeout d'acquisition** pour échouer plus vite si le pool est saturé :
   ```rust
   .acquire_timeout(std::time::Duration::from_secs(10)) // Au lieu de 30s
   ```

2. **Ajouter un circuit breaker** pour éviter de surcharger la DB :
   - Si plus de 80% des connexions sont occupées, rejeter les nouvelles requêtes
   - Retourner une erreur 503 (Service Unavailable) au lieu d'attendre

3. **Optimiser les requêtes lentes** :
   - Indexer les colonnes fréquemment utilisées dans `deliveries`
   - Optimiser `refresh_services_search_optimized()` (prend 11 secondes!)
   - Exécuter les refresh materialized views en arrière-plan (cron job)

### Solution 3 : Améliorer la validation backend (À FAIRE)

**Problème** : Les requêtes échouent avec 508 bytes (probablement BadRequest).

**Actions** :
1. Ajouter des logs détaillés dans `valider_service_json` pour voir exactement pourquoi la validation échoue
2. Vérifier que les erreurs de validation sont bien retournées au client avec un message clair
3. Ajouter une validation précoce (côté client) pour éviter d'envoyer des payloads invalides

### Solution 4 : Monitoring et alertes (À FAIRE)

**Recommandations** :
1. Monitorer le taux d'utilisation du pool de connexions
2. Alerter si > 80% des connexions sont occupées
3. Logger toutes les requêtes `/api/services/create` qui échouent avec le payload complet (pour debugging)
4. Ajouter des métriques de latence DB par type de requête

## 🎯 Actions Immédiates

### Priorité 1 (CRITIQUE)
1. ✅ Améliorer la gestion d'erreur côté client (FAIT)
2. 🔴 Ajouter des logs détaillés dans `creer_service` pour voir pourquoi les requêtes échouent
3. 🔴 Optimiser les requêtes SQL lentes (surtout `refresh_services_search_optimized()`)

### Priorité 2 (IMPORTANT)
4. ⚠️ Réduire le timeout d'acquisition du pool DB à 10s
5. ⚠️ Ajouter un circuit breaker pour le pool DB
6. ⚠️ Exécuter les refresh materialized views en arrière-plan (cron)

### Priorité 3 (AMÉLIORATION)
7. 📊 Ajouter monitoring du pool de connexions
8. 📊 Logger les payloads complets des requêtes qui échouent
9. 📊 Optimiser les index sur la table `deliveries`

## 📝 Notes

- Les logs montrent que le problème principal est la saturation de la base de données
- Les requêtes qui échouent sont probablement rejetées à cause de timeouts d'acquisition de connexion
- Il faut soit optimiser les requêtes SQL, soit augmenter les ressources DB (upgrade plan Render)

## 🔗 Fichiers concernés

- `backend/src/controllers/service_controller.rs` : Handler `/api/services/create`
- `backend/src/services/creer_service.rs` : Logique de création et validation
- `backend/src/main.rs` : Configuration du pool DB
- `mobile/src/services/api.ts` : Client API mobile
- `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx` : Formulaire de création


