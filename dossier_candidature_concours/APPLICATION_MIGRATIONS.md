# Application des Migrations - Instructions

## Migration à Appliquer

**Fichier**: `backend/migrations/20251128_001_optimize_search_performance_indexes.sql`

## ⚠️ Important

La base de données est hébergée sur **Render** et n'est pas accessible localement. La migration sera appliquée automatiquement au prochain déploiement.

## ✅ Méthode Automatique (Recommandée)

### Sur Render

Les migrations SQLx sont configurées pour s'exécuter automatiquement au démarrage de l'application dans `backend/src/main.rs` (ligne ~138).

**Vérification**:
```rust
match sqlx::migrate!("./migrations").run(&pg_pool).await {
    Ok(_) => {
        log::info!("✅ Migrations SQLx standard appliquées avec succès");
    }
    // ...
}
```

**Action**: Déployer l'application sur Render. La migration sera appliquée automatiquement.

## 🔧 Méthode Manuelle (Si nécessaire)

### Via Render Dashboard

1. Aller sur https://dashboard.render.com
2. Sélectionner votre base de données PostgreSQL
3. Aller dans l'onglet "Shell" ou "Query"
4. Copier le contenu de `backend/migrations/20251128_001_optimize_search_performance_indexes.sql`
5. Coller et exécuter

### Via psql (si accès direct)

```bash
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db" -f backend/migrations/20251128_001_optimize_search_performance_indexes.sql
```

## ✅ Vérification Post-Migration

```sql
-- Vérifier les index créés
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('publicites', 'autocomplete_characteristics', 'services')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Vérifier l'extension pg_trgm
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
```

## 📊 Impact Attendu

- **Temps de recherche**: ~10s → <2s (80% ⬇️)
- **Requête publicités**: ~1.1s → <100ms (90% ⬇️)
- **Jointures**: Significativement plus rapides

## 🔄 Rollback (Si nécessaire)

```sql
DROP INDEX IF EXISTS idx_publicites_status_date_fin;
DROP INDEX IF EXISTS idx_publicites_geo_publicitaire_gist;
DROP INDEX IF EXISTS idx_autocomplete_service_real_product;
DROP INDEX IF EXISTS idx_autocomplete_location_vector_partial;
DROP INDEX IF EXISTS idx_services_gps_trgm;
DROP INDEX IF EXISTS idx_services_titre_service_trgm;
DROP INDEX IF EXISTS idx_services_description_trgm;
DROP INDEX IF EXISTS idx_services_category_trgm;
DROP INDEX IF EXISTS idx_services_produits_characteristic_vector_gin;
```

## ⏱️ Temps d'Exécution

- **Petite base** (<10k services): ~30 secondes
- **Moyenne base** (10k-100k services): ~2-5 minutes
- **Grande base** (>100k services): ~10-15 minutes

Les index sont créés en arrière-plan et n'affectent pas les performances pendant la création.

