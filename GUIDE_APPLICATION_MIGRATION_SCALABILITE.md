# 🚀 Guide d'Application - Migration Scalabilité Recherche

## ✅ Étape 1 : Appliquer la Migration SQL

### Option A : Script PowerShell (Recommandé)

```powershell
cd C:\Users\23767\yukpomnang2
.\scripts\apply_search_scalability_migration.ps1
```

### Option B : Manuel avec psql

```bash
# Se connecter à la base de données Render
psql "postgresql://user:password@host:port/database"

# Appliquer la migration
\i backend/migrations/20251202_search_scalability_improvements.sql

# Vérifier que la vue existe
SELECT EXISTS(SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized');

# Rafraîchir la vue initiale
SELECT refresh_services_search_optimized();
```

### Option C : Via Docker (si psql non disponible)

```bash
docker run -i --rm postgres psql "postgresql://user:password@host:port/database" < backend/migrations/20251202_search_scalability_improvements.sql
```

## ✅ Étape 2 : Vérifier l'Intégration dans le Code

### Vérifications

1. **AppState** : `backend/src/state.rs`
   - ✅ Champ `search_cache: Arc<SearchCacheService>` ajouté
   - ✅ Initialisation dans `AppState::new()`

2. **NativeSearchService** : `backend/src/services/native_search_service.rs`
   - ✅ Champ `search_cache_service: Option<Arc<SearchCacheService>>` ajouté
   - ✅ Vérification cache avant recherche DB
   - ✅ Mise en cache après recherche

3. **Tâche de Refresh** : `backend/src/tasks/search_cache_refresh.rs`
   - ✅ Module créé
   - ✅ Fonction `start_search_cache_refresh_task()` créée

4. **Main** : `backend/src/main.rs`
   - ✅ Démarrage de la tâche ajouté

## ✅ Étape 3 : Compiler et Tester

```bash
cd backend

# Compiler
cargo build

# Vérifier les erreurs
cargo check

# Tests (si disponibles)
cargo test search_cache
```

## ✅ Étape 4 : Déployer

### Variables d'Environnement Requises

```bash
# Redis (pour cache L2)
REDIS_URL=redis://localhost:6379

# Database (déjà configuré)
DATABASE_URL=postgresql://user:password@host:port/database
```

### Déploiement Render

1. **Push vers Git** :
```bash
git add .
git commit -m "feat: Ajout cache multi-niveaux et vue matérialisée pour scalabilité recherche"
git push origin main
```

2. **Render déploiera automatiquement** (si auto-deploy activé)

3. **Vérifier les logs** :
   - Rechercher `[SearchCacheRefresh]` dans les logs
   - Vérifier que la tâche démarre correctement
   - Vérifier que le refresh fonctionne toutes les 2 minutes

## ✅ Étape 5 : Monitoring

### Vérifier que la Vue Matérialisée Fonctionne

```sql
-- Vérifier l'existence
SELECT * FROM pg_matviews WHERE matviewname = 'services_search_optimized';

-- Vérifier le nombre de lignes
SELECT COUNT(*) FROM services_search_optimized;

-- Tester la fonction de recherche
SELECT * FROM search_services_optimized('plombier', NULL, 10);

-- Vérifier les index
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'services_search_optimized';
```

### Vérifier le Cache

```rust
// Endpoint de monitoring (à créer)
GET /api/metrics/search

// Réponse attendue:
{
  "total_requests": 1000,
  "l1_hit_rate": 0.65,
  "l2_hit_rate": 0.20,
  "l4_hit_rate": 0.05,
  "overall_hit_rate": 0.90,
  "l1_size": 8500,
  "l4_size": 500
}
```

## ✅ Étape 6 : Tests de Performance

### Test 1 : Cache Hit

```bash
# Première requête (cache miss)
curl -X POST http://localhost:3000/api/search/direct \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"texte": "plombier"}'

# Deuxième requête (cache hit - devrait être <10ms)
time curl -X POST http://localhost:3000/api/search/direct \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"texte": "plombier"}'
```

### Test 2 : Vue Matérialisée

```sql
-- Mesurer le temps d'exécution
EXPLAIN ANALYZE
SELECT * FROM search_services_optimized('plombier', NULL, 20);

-- Comparer avec recherche normale
EXPLAIN ANALYZE
SELECT * FROM search_services_gps_final('plombier', NULL, NULL, 20);
```

## 📊 Résultats Attendus

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Temps réponse (cache hit) | 200-500ms | **<10ms** | **20-50x** |
| Temps réponse (cache miss) | 200-500ms | **<50ms** | **4-10x** |
| Cache hit rate | 30-50% | **>80%** | **+60%** |
| Requêtes DB | 100% | **<20%** | **-80%** |

## 🔧 Dépannage

### Problème : Vue matérialisée non créée

```sql
-- Vérifier les erreurs
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Recréer manuellement
DROP MATERIALIZED VIEW IF EXISTS services_search_optimized CASCADE;
\i backend/migrations/20251202_search_scalability_improvements.sql
```

### Problème : Cache ne fonctionne pas

1. Vérifier Redis :
```bash
redis-cli ping
```

2. Vérifier les logs :
```bash
grep "SearchCache" logs/app.log
```

3. Vérifier l'initialisation dans AppState

### Problème : Tâche de refresh ne démarre pas

1. Vérifier les logs au démarrage :
```bash
grep "SearchCacheRefresh" logs/app.log
```

2. Vérifier que la tâche est démarrée dans `main.rs`

3. Vérifier les permissions PostgreSQL pour `REFRESH MATERIALIZED VIEW CONCURRENTLY`

## ✅ Checklist Finale

- [ ] Migration SQL appliquée
- [ ] Vue matérialisée créée et rafraîchie
- [ ] Code compilé sans erreurs
- [ ] AppState initialise SearchCacheService
- [ ] Tâche de refresh démarre automatiquement
- [ ] Cache fonctionne (vérifier logs)
- [ ] Tests de performance effectués
- [ ] Monitoring configuré

## 🎉 Prochaines Étapes

Une fois la migration appliquée et testée :

1. **Phase 2** : Implémenter pagination cursor-based
2. **Phase 3** : Ajouter rate limiting adaptatif
3. **Phase 4** : Mettre en place monitoring complet

Voir `AMELIORATIONS_SCALABILITE_RECHERCHE.md` pour les détails.

