# Corrections - Pagination et Index pour get_services_for_prestataire

## Date
2025-11-27

## Vue d'ensemble
Corrections appliquées pour optimiser `/api/prestataire/services` :
1. Ajout de pagination (page, limit)
2. Vérification et application des index existants
3. Scripts de diagnostic et correction

---

## ✅ CORRECTION 1 : Pagination ajoutée

### Fichier modifié
`backend/src/controllers/service_controller.rs`

### Changements

#### Avant
```rust
pub async fn get_services_for_prestataire(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> axum::response::Response {
    // Pas de pagination, LIMIT 200 fixe
    // ...
}
```

#### Après
```rust
#[derive(Debug, Deserialize)]
pub struct PrestataireServicesQuery {
    pub page: Option<usize>,
    pub limit: Option<usize>,
}

pub async fn get_services_for_prestataire(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(query): Query<PrestataireServicesQuery>,
) -> axum::response::Response {
    // Pagination avec valeurs par défaut
    let page = query.page.unwrap_or(0);
    let limit = query.limit.unwrap_or(20).min(100); // Max 100 par page
    let offset = page * limit;
    
    // Cache inclut page et limit dans la clé
    let cache_key = format!("services:prestataire:{}:page:{}:limit:{}", user_id, page, limit);
    
    // Requête SQL avec LIMIT et OFFSET
    // ...
    .bind(limit as i64)
    .bind(offset as i64)
    
    // Comptage total pour pagination
    let total_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM services WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(pg_pool)
        .await?;
    
    let total_pages = (total_count as f64 / limit as f64).ceil() as usize;
    
    // Réponse avec métadonnées de pagination
    json!({
        "data": result,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_count,
            "total_pages": total_pages,
            "has_next": (page + 1) < total_pages,
            "has_prev": page > 0
        }
    })
}
```

### Impact
- ✅ Réduction de la taille des réponses (20 par défaut au lieu de 200)
- ✅ Temps de réponse réduit
- ✅ Support de la pagination côté client
- ✅ Cache par page pour meilleure performance

---

## ✅ CORRECTION 2 : Vérification des migrations d'index

### Problème identifié
Les migrations d'index existent déjà mais peuvent ne pas s'exécuter :
- `20251127_120004_optimize_services_queries_indexes.sql`
- `20251126_fix_services_user_id_created_at_index.sql`
- `20251127_optimize_get_services_performance.sql` (format de nom peut poser problème)

### Scripts créés

#### 1. `backend/scripts/check_indexes.sql`
Script SQL pour diagnostiquer :
- Migrations appliquées
- Index existants
- Index manquants
- Statistiques de table

#### 2. `backend/scripts/apply_missing_indexes.sql`
Script SQL pour appliquer manuellement les index :
- Tous les index nécessaires avec `IF NOT EXISTS`
- `ANALYZE` pour mettre à jour les statistiques
- Vérification après création

#### 3. `backend/scripts/check_and_fix_indexes.ps1`
Script PowerShell interactif :
- Vérifie l'état des migrations
- Liste les index existants
- Identifie les index manquants
- Propose d'appliquer les index manquants

### Index attendus

#### Sur `services`
1. `idx_services_user_id_created_at` - (user_id, created_at DESC) WHERE is_active = true
2. `idx_services_is_active_created_at` - (is_active, created_at DESC)
3. `idx_services_user_active_created` - (user_id, is_active, created_at DESC)
4. `idx_services_data_produits_gin` - GIN sur (data->'produits')
5. `idx_services_category_active` - (category, is_active) WHERE category IS NOT NULL

#### Sur `products_lifecycle`
1. `idx_products_lifecycle_service_product` - (service_id, product_index)
2. `idx_products_lifecycle_service_product_active` - (service_id, product_index, is_active)

---

## 🔍 DIAGNOSTIC

### Commandes pour vérifier

#### 1. Vérifier les migrations appliquées
```bash
cd backend
sqlx migrate info
```

#### 2. Vérifier les index existants
```bash
psql $DATABASE_URL -f backend/scripts/check_indexes.sql
```

#### 3. Script PowerShell interactif
```powershell
cd backend
.\scripts\check_and_fix_indexes.ps1
```

### Causes possibles de non-exécution

1. **Format de nom incorrect**
   - `20251127_optimize_get_services_performance.sql` manque le numéro séquentiel
   - SQLx peut ne pas le reconnaître

2. **Migration déjà appliquée mais index supprimés**
   - Migration marquée comme appliquée dans `_sqlx_migrations`
   - Mais index supprimés manuellement ou par erreur

3. **Erreur silencieuse lors de l'exécution**
   - Migration exécutée mais erreur SQL non détectée
   - Index non créés mais migration marquée comme réussie

4. **Migration non appliquée**
   - Problème de connexion lors du démarrage
   - Erreur dans le fichier SQL

---

## 🔧 ACTIONS RECOMMANDÉES

### Étape 1 : Diagnostic
```bash
# Exécuter le script de diagnostic
cd backend
.\scripts\check_and_fix_indexes.ps1
```

### Étape 2 : Appliquer les index manquants
Si des index manquent :
```bash
# Option 1 : Via script SQL
psql $DATABASE_URL -f backend/scripts/apply_missing_indexes.sql

# Option 2 : Via sqlx migrate run (si migrations non appliquées)
cd backend
sqlx migrate run
```

### Étape 3 : Vérifier les performances
```sql
-- Tester la requête avec EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT 
    s.id,
    s.is_active,
    s.created_at,
    -- ...
FROM services s
WHERE s.user_id = 11
ORDER BY s.created_at DESC
LIMIT 20 OFFSET 0;
```

### Étape 4 : Mettre à jour le client mobile
```typescript
// mobile/src/screens/MesProduitsScreen.tsx
const servicesResponse = await apiGet('/api/prestataire/services', {
    params: {
        page: 0,
        limit: 20
    }
});

// Gérer la réponse avec pagination
if (servicesResponse.success && servicesResponse.data) {
    const services = servicesResponse.data.data || servicesResponse.data; // Support ancien format
    const pagination = servicesResponse.data.pagination;
    // ...
}
```

---

## 📊 RÉSULTATS ATTENDUS

### Avant
- Temps de réponse : > 30 secondes (timeout)
- Taille réponse : ~200 services (potentiellement très lourd)
- Requêtes SQL : > 10 secondes (slow statement warnings)

### Après
- Temps de réponse : < 2 secondes (avec index)
- Taille réponse : 20 services par défaut (configurable)
- Requêtes SQL : < 1 seconde (avec index)
- Support pagination : Oui

---

## 📝 NOTES

- Les migrations s'exécutent au démarrage du backend (voir `main.rs` ligne 138)
- Si une migration échoue, le backend continue quand même (ligne 147)
- Les index peuvent être créés manuellement sans problème (utilisation de `IF NOT EXISTS`)
- Le cache Redis est maintenant par page pour éviter les collisions

---

## 🔍 FICHIERS MODIFIÉS

1. `backend/src/controllers/service_controller.rs`
   - Ajout pagination (Query params)
   - Comptage total
   - Réponse avec métadonnées pagination

2. `backend/scripts/check_indexes.sql` (nouveau)
   - Script de diagnostic

3. `backend/scripts/apply_missing_indexes.sql` (nouveau)
   - Script d'application manuelle

4. `backend/scripts/check_and_fix_indexes.ps1` (nouveau)
   - Script PowerShell interactif

---

## ✅ PROCHAINES ÉTAPES

1. **Exécuter le diagnostic** pour vérifier l'état actuel
2. **Appliquer les index manquants** si nécessaire
3. **Tester les performances** avec EXPLAIN ANALYZE
4. **Mettre à jour le client mobile** pour utiliser la pagination
5. **Monitorer les logs** pour vérifier l'amélioration

