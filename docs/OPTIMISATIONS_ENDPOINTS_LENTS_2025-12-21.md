# Optimisations des Endpoints Lents - 2025-12-21

## 🔍 Problèmes Identifiés dans les Logs

### 1. `/api/services/{id}/stats` et `/api/services/{id}/reviews` (2-3 secondes)
- **Cause**: Requêtes MongoDB sans index appropriés, scannent toute la collection `history`
- **Solution**: 
  - Limiter les résultats directement dans la requête MongoDB (au lieu de récupérer tous puis tronquer)
  - Ajouter un tri par timestamp décroissant pour récupérer les plus récents en premier
  - Limite par défaut: 100 interactions, 50 avis

### 2. `/api/search/direct` (7698 ms)
- **Cause**: 
  - Requête SQL dans `search_services_direct_fallback` utilise `array_to_string()` qui ne peut pas utiliser l'index GIN directement
  - Fallback dans `native_search_service.rs` scanne toute la table `services` avec `jsonb_array_elements`
- **Solution**:
  - Créer des index GIN sur `to_tsvector('french', array_to_string(full_vector, ' '))` et `to_tsvector('french', array_to_string(characteristic_vector, ' '))`
  - Limiter le fallback à 20 services et 5 produits par service pour éviter les scans complets

### 3. `/api/autocomplete/search-products` (3266 ms et 2937 ms)
- **Cause**: Même problème que `/api/search/direct` - `array_to_string()` ne peut pas utiliser l'index GIN
- **Solution**: Utiliser les nouveaux index GIN créés dans la migration `20251221_optimize_slow_endpoints.sql`

### 4. Requête principale dans `native_search_service.rs` (1.745 secondes)
- **Cause**: Fallback dans `native_search_service.rs` scanne toute la table `services` avec `jsonb_array_elements` sans limite
- **Solution**: Limiter le fallback à 20 services et 5 produits par service

## ✅ Corrections Appliquées

### Migration SQL: `20251221_optimize_slow_endpoints.sql`
1. **Index GIN sur `full_vector`**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_autocomplete_full_vector_tsvector_gin 
   ON autocomplete_characteristics 
   USING GIN (to_tsvector('french', array_to_string(full_vector, ' ')))
   WHERE identifiant_base = 'produits' AND is_real_product = TRUE;
   ```

2. **Index GIN sur `characteristic_vector`**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristic_vector_tsvector_gin 
   ON autocomplete_characteristics 
   USING GIN (to_tsvector('french', array_to_string(characteristic_vector, ' ')))
   WHERE identifiant_base = 'produits' AND is_real_product = TRUE;
   ```

3. **Index composite pour optimiser les JOINs**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_autocomplete_composite_search 
   ON autocomplete_characteristics (identifiant_base, is_real_product, service_id)
   WHERE identifiant_base = 'produits' AND is_real_product = TRUE;
   ```

4. **Index sur `services.is_active`**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_services_is_active 
   ON services (is_active)
   WHERE is_active = TRUE;
   ```

5. **Index sur `services.category`**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_services_category 
   ON services (category)
   WHERE is_active = TRUE AND category IS NOT NULL;
   ```

### Modifications du Code

#### `backend/src/services/interaction_service.rs`
- **`get_interactions`**: Ajout de `limit` et `sort` directement dans la requête MongoDB (limite par défaut: 100)
- **`get_reviews`**: Ajout de `limit` et `sort` directement dans la requête MongoDB (limite par défaut: 50)

#### `backend/src/services/autocomplete_search_service.rs`
- Ajout de commentaires indiquant l'utilisation des nouveaux index GIN
- Les requêtes utilisent maintenant les index `idx_autocomplete_full_vector_tsvector_gin` et `idx_autocomplete_characteristic_vector_tsvector_gin`

#### `backend/src/services/rechercher_besoin.rs`
- Ajout de commentaires indiquant l'utilisation des nouveaux index GIN dans `search_services_direct_fallback`

#### `backend/src/services/native_search_service.rs`
- Limitation du fallback à 20 services et 5 produits par service pour éviter les scans complets

## 📊 Performances Attendues

### Avant
- `/api/services/{id}/stats`: 3629 ms
- `/api/services/{id}/reviews`: 3213 ms
- `/api/search/direct`: 7698 ms
- `/api/autocomplete/search-products`: 3266 ms

### Après (attendu)
- `/api/services/{id}/stats`: < 500 ms (limite MongoDB + index)
- `/api/services/{id}/reviews`: < 300 ms (limite MongoDB + index)
- `/api/search/direct`: < 500 ms (index GIN sur full_vector)
- `/api/autocomplete/search-products`: < 200 ms (index GIN sur full_vector)

## ⚠️ Notes Importantes

1. **Index MongoDB**: Les index MongoDB sur `service_id` et `event_type` doivent être créés directement dans MongoDB, pas dans cette migration SQL. Ces index sont critiques pour les performances de `/api/services/{id}/stats` et `/api/services/{id}/reviews`.

2. **Migration automatique**: Cette migration sera exécutée automatiquement au prochain démarrage du backend grâce au système `auto_migrate`.

3. **Analyse des tables**: La migration exécute `ANALYZE` sur `autocomplete_characteristics` et `services` pour mettre à jour les statistiques du planificateur de requêtes PostgreSQL.

## 🔄 Prochaines Étapes

1. **Créer les index MongoDB**:
   ```javascript
   // Dans MongoDB shell ou Compass
   db.history.createIndex({ "service_id": 1, "event_type": 1 });
   db.history.createIndex({ "service_id": 1, "data.interaction_type": 1 });
   ```

2. **Vérifier les performances** après déploiement de la migration

3. **Monitorer les logs** pour confirmer que les temps de réponse sont améliorés

